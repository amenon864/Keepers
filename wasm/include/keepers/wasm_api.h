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
    KEEPERS_STATUS_INTERNAL_ERROR = 4
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

#ifdef __cplusplus
}
#endif

#undef KEEPERS_WASM_NOEXCEPT
