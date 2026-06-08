#pragma once

#include <cstddef>
#include <cstdint>
#include <span>

namespace keepers {

[[nodiscard]] double laplacian_variance(
    std::span<const std::uint8_t> grayscale,
    std::size_t width,
    std::size_t height
);

}
