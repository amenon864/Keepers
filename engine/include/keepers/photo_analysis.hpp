#pragma once

#include <cstddef>
#include <cstdint>

#include <keepers/image_view.hpp>

namespace keepers {

struct PhotoAnalysis {
    std::size_t id;
    double sharpness;
    double mean_luminance;
    double shadow_clipping_ratio;
    double highlight_clipping_ratio;
    double contrast;
    std::uint64_t difference_hash;
};

// Standardize images to a common analysis resolution before calling this when
// sharpness values will later be compared.
[[nodiscard]] PhotoAnalysis analyze_photo(
    std::size_t id,
    const ImageView& image
);

}
