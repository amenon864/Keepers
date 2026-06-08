#include <keepers/difference_hash.hpp>

#include <array>
#include <bit>
#include <limits>
#include <stdexcept>

namespace {

constexpr std::size_t hash_width = 9;
constexpr std::size_t hash_height = 8;
constexpr std::size_t hash_comparisons_per_row = hash_width - 1;

std::size_t checked_multiply(std::size_t left, std::size_t right)
{
    if (left != 0 && right > std::numeric_limits<std::size_t>::max() / left) {
        throw std::overflow_error{"image dimensions overflow"};
    }

    return left * right;
}

std::size_t map_coordinate(
    std::size_t destination,
    std::size_t source_size,
    std::size_t destination_size
)
{
    const std::size_t coordinate = destination * source_size / destination_size;
    return coordinate < source_size ? coordinate : source_size - 1;
}

std::array<std::uint8_t, hash_width * hash_height> resize_nearest(
    std::span<const std::uint8_t> grayscale,
    std::size_t width,
    std::size_t height
)
{
    std::array<std::uint8_t, hash_width * hash_height> resized{};

    for (std::size_t y = 0; y < hash_height; ++y) {
        const std::size_t source_y = map_coordinate(y, height, hash_height);

        for (std::size_t x = 0; x < hash_width; ++x) {
            const std::size_t source_x = map_coordinate(x, width, hash_width);
            resized[y * hash_width + x] =
                grayscale[source_y * width + source_x];
        }
    }

    return resized;
}

}

namespace keepers {

std::uint64_t difference_hash(
    std::span<const std::uint8_t> grayscale,
    std::size_t width,
    std::size_t height
)
{
    if (width == 0) {
        throw std::invalid_argument{"image width must be greater than zero"};
    }

    if (height == 0) {
        throw std::invalid_argument{"image height must be greater than zero"};
    }

    const std::size_t expected_size = checked_multiply(width, height);

    if (grayscale.size() != expected_size) {
        throw std::invalid_argument{
            "grayscale buffer size must match image dimensions"
        };
    }

    const auto resized = resize_nearest(grayscale, width, height);
    std::uint64_t hash = 0;
    std::size_t bit_index = 0;

    // Bits are assigned row-major: top-to-bottom, left-to-right, bit 0 first.
    for (std::size_t y = 0; y < hash_height; ++y) {
        for (std::size_t x = 0; x < hash_comparisons_per_row; ++x) {
            const std::uint8_t left = resized[y * hash_width + x];
            const std::uint8_t right = resized[y * hash_width + x + 1];

            if (left < right) {
                hash |= std::uint64_t{1} << bit_index;
            }

            ++bit_index;
        }
    }

    return hash;
}

unsigned int hamming_distance(std::uint64_t left, std::uint64_t right) noexcept
{
    return static_cast<unsigned int>(std::popcount(left ^ right));
}

}
