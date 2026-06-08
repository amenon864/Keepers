#pragma once

#include <cstdint>
#include <span>

namespace burstpick {

struct ExposureMetrics {
    double mean_luminance;
    double shadow_clipping_ratio;
    double highlight_clipping_ratio;
};

[[nodiscard]] ExposureMetrics analyze_exposure(
    std::span<const std::uint8_t> grayscale
);

[[nodiscard]] double percentile_contrast(
    std::span<const std::uint8_t> grayscale
);

}
