#pragma once

#include <cstdint>
#include <vector>

#include <burstpick/image_view.hpp>

namespace burstpick {

[[nodiscard]] std::vector<std::uint8_t> to_grayscale(
    const ImageView& image
);

}
