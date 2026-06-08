#pragma once

#include <cstdint>
#include <vector>

#include <keepers/image_view.hpp>

namespace keepers {

[[nodiscard]] std::vector<std::uint8_t> to_grayscale(
    const ImageView& image
);

}
