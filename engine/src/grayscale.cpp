#include <keepers/grayscale.hpp>

#include <cmath>
#include <span>
#include <stdexcept>

namespace {

std::uint8_t to_luminance(
    std::uint8_t red,
    std::uint8_t green,
    std::uint8_t blue
)
{
    const double luminance =
        0.2126 * red +
        0.7152 * green +
        0.0722 * blue;

    return static_cast<std::uint8_t>(std::lround(luminance));
}

}

namespace keepers {

std::vector<std::uint8_t> to_grayscale(const ImageView& image)
{
    const std::size_t channels = image.channels();

    if (channels != 3 && channels != 4) {
        throw std::invalid_argument{
            "grayscale conversion requires RGB or RGBA input"
        };
    }

    const std::size_t pixel_count = image.pixel_count();
    const std::span<const std::uint8_t> pixels = image.pixels();

    std::vector<std::uint8_t> grayscale(pixel_count);

    for (std::size_t index = 0; index < pixel_count; ++index) {
        const std::size_t offset = index * channels;
        const std::uint8_t red = pixels[offset];
        const std::uint8_t green = pixels[offset + 1];
        const std::uint8_t blue = pixels[offset + 2];

        grayscale[index] = to_luminance(red, green, blue);
    }

    return grayscale;
}

}
