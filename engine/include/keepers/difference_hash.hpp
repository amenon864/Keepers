#pragma once

#include <cstddef>
#include <cstdint>
#include <span>

namespace keepers {

[[nodiscard]] std::uint64_t difference_hash(
    std::span<const std::uint8_t> grayscale,
    std::size_t width,
    std::size_t height
);

[[nodiscard]] unsigned int hamming_distance(
    std::uint64_t left,
    std::uint64_t right
) noexcept;

}
