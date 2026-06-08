#pragma once

#include <cstddef>
#include <cstdint>
#include <span>

namespace burstpick {

[[nodiscard]] double laplacian_variance(
    std::span<const std::uint8_t> grayscale,
    std::size_t width,
    std::size_t height
);

}
