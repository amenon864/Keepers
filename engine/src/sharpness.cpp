#include <keepers/sharpness.hpp>

#include <algorithm>
#include <limits>
#include <stdexcept>

namespace {

std::size_t checked_multiply(std::size_t left, std::size_t right)
{
    if (left != 0 && right > std::numeric_limits<std::size_t>::max() / left) {
        throw std::overflow_error{"image dimensions overflow"};
    }

    return left * right;
}

}

namespace keepers {

double laplacian_variance(
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

    if (width < 3 || height < 3) {
        throw std::invalid_argument{
            "image must be at least 3x3 for Laplacian variance"
        };
    }

    double sum = 0.0;
    double sum_of_squares = 0.0;
    std::size_t count = 0;

    for (std::size_t y = 1; y < height - 1; ++y) {
        for (std::size_t x = 1; x < width - 1; ++x) {
            const std::size_t index = y * width + x;
            const std::uint8_t left = grayscale[index - 1];
            const std::uint8_t right = grayscale[index + 1];
            const std::uint8_t above = grayscale[index - width];
            const std::uint8_t below = grayscale[index + width];
            const std::uint8_t center = grayscale[index];

            const int response =
                static_cast<int>(left) +
                static_cast<int>(right) +
                static_cast<int>(above) +
                static_cast<int>(below) -
                4 * static_cast<int>(center);
            const double value = static_cast<double>(response);

            sum += value;
            sum_of_squares += value * value;
            ++count;
        }
    }

    const double mean = sum / static_cast<double>(count);
    const double variance =
        sum_of_squares / static_cast<double>(count) - mean * mean;

    return std::max(0.0, variance);
}

}
