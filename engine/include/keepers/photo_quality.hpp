#pragma once

#include <cstddef>
#include <span>
#include <vector>

namespace keepers {

struct PhotoMetrics {
    std::size_t id;
    double sharpness;
    double mean_luminance;
    double shadow_clipping_ratio;
    double highlight_clipping_ratio;
    double contrast;
};

struct PhotoQualityScore {
    std::size_t id;
    double normalized_sharpness;
    double exposure_score;
    double normalized_contrast;
    double overall_score;
};

// Sharpness values should be computed from images standardized to a common
// analysis resolution.
[[nodiscard]] std::vector<PhotoQualityScore> rank_photo_quality(
    std::span<const PhotoMetrics> photos
);

}
