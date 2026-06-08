#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
#define KEEPERS_WASM_NOEXCEPT noexcept
#else
#define KEEPERS_WASM_NOEXCEPT
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef enum KeepersStatus {
    KEEPERS_STATUS_OK = 0,
    KEEPERS_STATUS_INVALID_ARGUMENT = 1,
    KEEPERS_STATUS_OVERFLOW = 2,
    KEEPERS_STATUS_ALLOCATION_FAILURE = 3,
    KEEPERS_STATUS_INTERNAL_ERROR = 4,
    KEEPERS_STATUS_INSUFFICIENT_CAPACITY = 5
} KeepersStatus;

typedef struct KeepersPhotoAnalysis {
    size_t id;
    double sharpness;
    double mean_luminance;
    double shadow_clipping_ratio;
    double highlight_clipping_ratio;
    double contrast;
    uint64_t difference_hash;
} KeepersPhotoAnalysis;

typedef struct KeepersPhotoHash {
    size_t id;
    uint64_t hash;
} KeepersPhotoHash;

typedef struct KeepersSimilarityGroup {
    size_t member_offset;
    size_t member_count;
} KeepersSimilarityGroup;

typedef struct KeepersPhotoMetrics {
    size_t id;
    double sharpness;
    double mean_luminance;
    double shadow_clipping_ratio;
    double highlight_clipping_ratio;
    double contrast;
} KeepersPhotoMetrics;

typedef struct KeepersPhotoQualityScore {
    size_t id;
    double normalized_sharpness;
    double exposure_score;
    double normalized_contrast;
    double overall_score;
} KeepersPhotoQualityScore;

int keepers_api_version(void) KEEPERS_WASM_NOEXCEPT;

uint8_t* keepers_allocate(size_t size) KEEPERS_WASM_NOEXCEPT;

void keepers_deallocate(void* pointer) KEEPERS_WASM_NOEXCEPT;

KeepersStatus keepers_analyze_photo(
    size_t id,
    const uint8_t* pixels,
    size_t pixel_buffer_size,
    size_t width,
    size_t height,
    size_t channels,
    KeepersPhotoAnalysis* output
) KEEPERS_WASM_NOEXCEPT;

// Count pointers are required. Null output arrays are valid only for size
// queries with matching zero capacities.
KeepersStatus keepers_group_similar_photos(
    const KeepersPhotoHash* photos,
    size_t photo_count,
    unsigned int maximum_distance,
    KeepersSimilarityGroup* groups,
    size_t group_capacity,
    size_t* group_count,
    size_t* members,
    size_t member_capacity,
    size_t* member_count
) KEEPERS_WASM_NOEXCEPT;

// output_count is required. A null output array is valid only for a size query
// with zero output capacity.
KeepersStatus keepers_rank_photo_quality(
    const KeepersPhotoMetrics* photos,
    size_t photo_count,
    KeepersPhotoQualityScore* output,
    size_t output_capacity,
    size_t* output_count
) KEEPERS_WASM_NOEXCEPT;

size_t keepers_photo_analysis_size(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_id(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_sharpness(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_mean_luminance(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_shadow_clipping_ratio(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_highlight_clipping_ratio(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_contrast(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_analysis_offset_difference_hash(
    void
) KEEPERS_WASM_NOEXCEPT;

size_t keepers_photo_hash_size(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_hash_offset_id(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_hash_offset_hash(void) KEEPERS_WASM_NOEXCEPT;

size_t keepers_similarity_group_size(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_similarity_group_offset_member_offset(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_similarity_group_offset_member_count(
    void
) KEEPERS_WASM_NOEXCEPT;

size_t keepers_photo_metrics_size(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_metrics_offset_id(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_metrics_offset_sharpness(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_metrics_offset_mean_luminance(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_metrics_offset_shadow_clipping_ratio(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_metrics_offset_highlight_clipping_ratio(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_metrics_offset_contrast(void) KEEPERS_WASM_NOEXCEPT;

size_t keepers_photo_quality_score_size(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_quality_score_offset_id(void) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_quality_score_offset_normalized_sharpness(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_quality_score_offset_exposure_score(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_quality_score_offset_normalized_contrast(
    void
) KEEPERS_WASM_NOEXCEPT;
size_t keepers_photo_quality_score_offset_overall_score(
    void
) KEEPERS_WASM_NOEXCEPT;

#ifdef __cplusplus
}
#endif

#undef KEEPERS_WASM_NOEXCEPT
