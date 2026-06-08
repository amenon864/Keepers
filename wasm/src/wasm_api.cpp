#include <keepers/wasm_api.h>

#include <keepers/image_view.hpp>
#include <keepers/photo_analysis.hpp>
#include <keepers/photo_quality.hpp>
#include <keepers/similarity_grouping.hpp>

#include <cstddef>
#include <cstdint>
#include <limits>
#include <new>
#include <span>
#include <stdexcept>
#include <vector>

namespace {

bool checked_byte_size(std::size_t count, std::size_t element_size)
{
    return (
        element_size == 0 ||
        count <= std::numeric_limits<std::size_t>::max() / element_size
    );
}

KeepersStatus translate_current_exception() noexcept
{
    try {
        throw;
    } catch (const std::invalid_argument&) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    } catch (const std::overflow_error&) {
        return KEEPERS_STATUS_OVERFLOW;
    } catch (const std::bad_alloc&) {
        return KEEPERS_STATUS_ALLOCATION_FAILURE;
    } catch (...) {
        return KEEPERS_STATUS_INTERNAL_ERROR;
    }
}

std::vector<keepers::PhotoHash> copy_photo_hashes(
    const KeepersPhotoHash* photos,
    std::size_t photo_count
)
{
    std::vector<keepers::PhotoHash> native_photos;
    native_photos.reserve(photo_count);

    for (std::size_t index = 0; index < photo_count; ++index) {
        native_photos.push_back(
            keepers::PhotoHash{
                photos[index].id,
                photos[index].hash
            }
        );
    }

    return native_photos;
}

std::vector<keepers::PhotoMetrics> copy_photo_metrics(
    const KeepersPhotoMetrics* photos,
    std::size_t photo_count
)
{
    std::vector<keepers::PhotoMetrics> native_photos;
    native_photos.reserve(photo_count);

    for (std::size_t index = 0; index < photo_count; ++index) {
        native_photos.push_back(
            keepers::PhotoMetrics{
                photos[index].id,
                photos[index].sharpness,
                photos[index].mean_luminance,
                photos[index].shadow_clipping_ratio,
                photos[index].highlight_clipping_ratio,
                photos[index].contrast
            }
        );
    }

    return native_photos;
}

std::size_t count_group_members(
    const std::vector<keepers::SimilarityGroup>& groups
)
{
    std::size_t total = 0;

    for (const keepers::SimilarityGroup& group : groups) {
        if (
            group.size() >
            std::numeric_limits<std::size_t>::max() - total
        ) {
            throw std::overflow_error{"similarity group member count overflow"};
        }

        total += group.size();
    }

    return total;
}

}

extern "C" int keepers_api_version(void) noexcept
{
    return 1;
}

extern "C" std::uint8_t* keepers_allocate(std::size_t size) noexcept
{
    if (size == 0) {
        return nullptr;
    }

    return new (std::nothrow) std::uint8_t[size];
}

extern "C" void keepers_deallocate(void* pointer) noexcept
{
    delete[] static_cast<std::uint8_t*>(pointer);
}

extern "C" KeepersStatus keepers_analyze_photo(
    std::size_t id,
    const std::uint8_t* pixels,
    std::size_t pixel_buffer_size,
    std::size_t width,
    std::size_t height,
    std::size_t channels,
    KeepersPhotoAnalysis* output
) noexcept
{
    if (output == nullptr) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    *output = KeepersPhotoAnalysis{};

    if (pixels == nullptr && pixel_buffer_size > 0) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    try {
        const std::span<const std::uint8_t> pixel_span{
            pixels,
            pixel_buffer_size
        };
        const keepers::ImageView image{
            pixel_span,
            width,
            height,
            channels
        };
        const keepers::PhotoAnalysis analysis =
            keepers::analyze_photo(id, image);

        *output = KeepersPhotoAnalysis{
            analysis.id,
            analysis.sharpness,
            analysis.mean_luminance,
            analysis.shadow_clipping_ratio,
            analysis.highlight_clipping_ratio,
            analysis.contrast,
            analysis.difference_hash
        };

        return KEEPERS_STATUS_OK;
    } catch (const std::invalid_argument&) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    } catch (const std::overflow_error&) {
        return KEEPERS_STATUS_OVERFLOW;
    } catch (const std::bad_alloc&) {
        return KEEPERS_STATUS_ALLOCATION_FAILURE;
    } catch (...) {
        return KEEPERS_STATUS_INTERNAL_ERROR;
    }
}

extern "C" KeepersStatus keepers_group_similar_photos(
    const KeepersPhotoHash* photos,
    std::size_t photo_count,
    unsigned int maximum_distance,
    KeepersSimilarityGroup* groups,
    std::size_t group_capacity,
    std::size_t* group_count,
    std::size_t* members,
    std::size_t member_capacity,
    std::size_t* member_count
) noexcept
{
    if (group_count == nullptr || member_count == nullptr) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    *group_count = 0;
    *member_count = 0;

    if (photos == nullptr && photo_count > 0) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    const bool size_query =
        groups == nullptr &&
        group_capacity == 0 &&
        members == nullptr &&
        member_capacity == 0;

    if (!size_query) {
        if (
            (groups == nullptr && group_capacity > 0) ||
            (members == nullptr && member_capacity > 0) ||
            groups == nullptr ||
            members == nullptr
        ) {
            return KEEPERS_STATUS_INVALID_ARGUMENT;
        }
    }

    if (
        !checked_byte_size(photo_count, sizeof(KeepersPhotoHash)) ||
        !checked_byte_size(group_capacity, sizeof(KeepersSimilarityGroup)) ||
        !checked_byte_size(member_capacity, sizeof(std::size_t))
    ) {
        return KEEPERS_STATUS_OVERFLOW;
    }

    try {
        const std::vector<keepers::PhotoHash> native_photos =
            copy_photo_hashes(photos, photo_count);
        const std::vector<keepers::SimilarityGroup> native_groups =
            keepers::group_similar_photos(native_photos, maximum_distance);
        const std::size_t required_group_count = native_groups.size();
        const std::size_t required_member_count =
            count_group_members(native_groups);

        if (
            !checked_byte_size(
                required_group_count,
                sizeof(KeepersSimilarityGroup)
            ) ||
            !checked_byte_size(required_member_count, sizeof(std::size_t))
        ) {
            return KEEPERS_STATUS_OVERFLOW;
        }

        *group_count = required_group_count;
        *member_count = required_member_count;

        if (size_query) {
            return KEEPERS_STATUS_OK;
        }

        if (
            group_capacity < required_group_count ||
            member_capacity < required_member_count
        ) {
            return KEEPERS_STATUS_INSUFFICIENT_CAPACITY;
        }

        std::size_t member_offset = 0;

        for (
            std::size_t group_index = 0;
            group_index < native_groups.size();
            ++group_index
        ) {
            const keepers::SimilarityGroup& group = native_groups[group_index];

            groups[group_index] = KeepersSimilarityGroup{
                member_offset,
                group.size()
            };

            for (const std::size_t id : group) {
                members[member_offset] = id;
                ++member_offset;
            }
        }

        return KEEPERS_STATUS_OK;
    } catch (...) {
        return translate_current_exception();
    }
}

extern "C" KeepersStatus keepers_rank_photo_quality(
    const KeepersPhotoMetrics* photos,
    std::size_t photo_count,
    KeepersPhotoQualityScore* output,
    std::size_t output_capacity,
    std::size_t* output_count
) noexcept
{
    if (output_count == nullptr) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    *output_count = 0;

    if (photos == nullptr && photo_count > 0) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    const bool size_query = output == nullptr && output_capacity == 0;

    if (!size_query && output == nullptr) {
        return KEEPERS_STATUS_INVALID_ARGUMENT;
    }

    if (
        !checked_byte_size(photo_count, sizeof(KeepersPhotoMetrics)) ||
        !checked_byte_size(output_capacity, sizeof(KeepersPhotoQualityScore))
    ) {
        return KEEPERS_STATUS_OVERFLOW;
    }

    try {
        const std::vector<keepers::PhotoMetrics> native_photos =
            copy_photo_metrics(photos, photo_count);
        const std::vector<keepers::PhotoQualityScore> native_scores =
            keepers::rank_photo_quality(native_photos);
        const std::size_t required_output_count = native_scores.size();

        if (
            !checked_byte_size(
                required_output_count,
                sizeof(KeepersPhotoQualityScore)
            )
        ) {
            return KEEPERS_STATUS_OVERFLOW;
        }

        *output_count = required_output_count;

        if (size_query) {
            return KEEPERS_STATUS_OK;
        }

        if (output_capacity < required_output_count) {
            return KEEPERS_STATUS_INSUFFICIENT_CAPACITY;
        }

        for (std::size_t index = 0; index < native_scores.size(); ++index) {
            const keepers::PhotoQualityScore& score = native_scores[index];

            output[index] = KeepersPhotoQualityScore{
                score.id,
                score.normalized_sharpness,
                score.exposure_score,
                score.normalized_contrast,
                score.overall_score
            };
        }

        return KEEPERS_STATUS_OK;
    } catch (...) {
        return translate_current_exception();
    }
}

extern "C" std::size_t keepers_photo_analysis_size(void) noexcept
{
    return sizeof(KeepersPhotoAnalysis);
}

extern "C" std::size_t keepers_photo_analysis_offset_id(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, id);
}

extern "C" std::size_t keepers_photo_analysis_offset_sharpness(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, sharpness);
}

extern "C" std::size_t
keepers_photo_analysis_offset_mean_luminance(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, mean_luminance);
}

extern "C" std::size_t
keepers_photo_analysis_offset_shadow_clipping_ratio(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, shadow_clipping_ratio);
}

extern "C" std::size_t
keepers_photo_analysis_offset_highlight_clipping_ratio(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, highlight_clipping_ratio);
}

extern "C" std::size_t keepers_photo_analysis_offset_contrast(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, contrast);
}

extern "C" std::size_t
keepers_photo_analysis_offset_difference_hash(void) noexcept
{
    return offsetof(KeepersPhotoAnalysis, difference_hash);
}

extern "C" std::size_t keepers_photo_hash_size(void) noexcept
{
    return sizeof(KeepersPhotoHash);
}

extern "C" std::size_t keepers_photo_hash_offset_id(void) noexcept
{
    return offsetof(KeepersPhotoHash, id);
}

extern "C" std::size_t keepers_photo_hash_offset_hash(void) noexcept
{
    return offsetof(KeepersPhotoHash, hash);
}

extern "C" std::size_t keepers_similarity_group_size(void) noexcept
{
    return sizeof(KeepersSimilarityGroup);
}

extern "C" std::size_t
keepers_similarity_group_offset_member_offset(void) noexcept
{
    return offsetof(KeepersSimilarityGroup, member_offset);
}

extern "C" std::size_t
keepers_similarity_group_offset_member_count(void) noexcept
{
    return offsetof(KeepersSimilarityGroup, member_count);
}

extern "C" std::size_t keepers_photo_metrics_size(void) noexcept
{
    return sizeof(KeepersPhotoMetrics);
}

extern "C" std::size_t keepers_photo_metrics_offset_id(void) noexcept
{
    return offsetof(KeepersPhotoMetrics, id);
}

extern "C" std::size_t keepers_photo_metrics_offset_sharpness(void) noexcept
{
    return offsetof(KeepersPhotoMetrics, sharpness);
}

extern "C" std::size_t
keepers_photo_metrics_offset_mean_luminance(void) noexcept
{
    return offsetof(KeepersPhotoMetrics, mean_luminance);
}

extern "C" std::size_t
keepers_photo_metrics_offset_shadow_clipping_ratio(void) noexcept
{
    return offsetof(KeepersPhotoMetrics, shadow_clipping_ratio);
}

extern "C" std::size_t
keepers_photo_metrics_offset_highlight_clipping_ratio(void) noexcept
{
    return offsetof(KeepersPhotoMetrics, highlight_clipping_ratio);
}

extern "C" std::size_t keepers_photo_metrics_offset_contrast(void) noexcept
{
    return offsetof(KeepersPhotoMetrics, contrast);
}

extern "C" std::size_t keepers_photo_quality_score_size(void) noexcept
{
    return sizeof(KeepersPhotoQualityScore);
}

extern "C" std::size_t keepers_photo_quality_score_offset_id(void) noexcept
{
    return offsetof(KeepersPhotoQualityScore, id);
}

extern "C" std::size_t
keepers_photo_quality_score_offset_normalized_sharpness(void) noexcept
{
    return offsetof(KeepersPhotoQualityScore, normalized_sharpness);
}

extern "C" std::size_t
keepers_photo_quality_score_offset_exposure_score(void) noexcept
{
    return offsetof(KeepersPhotoQualityScore, exposure_score);
}

extern "C" std::size_t
keepers_photo_quality_score_offset_normalized_contrast(void) noexcept
{
    return offsetof(KeepersPhotoQualityScore, normalized_contrast);
}

extern "C" std::size_t
keepers_photo_quality_score_offset_overall_score(void) noexcept
{
    return offsetof(KeepersPhotoQualityScore, overall_score);
}
