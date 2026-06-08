#include <burstpick/image_view.hpp>

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

namespace burstpick {

ImageView::ImageView(
    std::span<const std::uint8_t> pixels,
    std::size_t width,
    std::size_t height,
    std::size_t channels
)
    : pixels_{}
    , width_{width}
    , height_{height}
    , channels_{channels}
    , pixel_count_{}
{
    if (width == 0) {
        throw std::invalid_argument{"image width must be greater than zero"};
    }

    if (height == 0) {
        throw std::invalid_argument{"image height must be greater than zero"};
    }

    if (channels == 0) {
        throw std::invalid_argument{"image channels must be greater than zero"};
    }

    pixel_count_ = checked_multiply(width, height);
    const std::size_t required_pixel_values = checked_multiply(
        pixel_count_,
        channels
    );

    if (pixels.size() < required_pixel_values) {
        throw std::invalid_argument{"pixel buffer is smaller than image size"};
    }

    pixels_ = pixels.first(required_pixel_values);
}

std::span<const std::uint8_t> ImageView::pixels() const noexcept
{
    return pixels_;
}

std::size_t ImageView::width() const noexcept
{
    return width_;
}

std::size_t ImageView::height() const noexcept
{
    return height_;
}

std::size_t ImageView::channels() const noexcept
{
    return channels_;
}

std::size_t ImageView::pixel_count() const noexcept
{
    return pixel_count_;
}

std::size_t ImageView::required_size() const noexcept
{
    return pixels_.size();
}

}
