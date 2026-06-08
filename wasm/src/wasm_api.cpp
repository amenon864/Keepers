#include <keepers/wasm_api.h>

#include <keepers/image_view.hpp>
#include <keepers/photo_analysis.hpp>

#include <cstddef>
#include <cstdint>
#include <new>
#include <span>
#include <stdexcept>

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
