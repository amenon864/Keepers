#pragma once

#include <cstddef>
#include <cstdint>
#include <span>

namespace keepers {

// ImageView does not own pixels; callers must keep the storage alive.
class ImageView {
public:
    ImageView(
        std::span<const std::uint8_t> pixels,
        std::size_t width,
        std::size_t height,
        std::size_t channels
    );

    [[nodiscard]] std::span<const std::uint8_t> pixels() const noexcept;
    [[nodiscard]] std::size_t width() const noexcept;
    [[nodiscard]] std::size_t height() const noexcept;
    [[nodiscard]] std::size_t channels() const noexcept;
    [[nodiscard]] std::size_t pixel_count() const noexcept;
    [[nodiscard]] std::size_t required_size() const noexcept;

private:
    std::span<const std::uint8_t> pixels_;
    std::size_t width_;
    std::size_t height_;
    std::size_t channels_;
    std::size_t pixel_count_;
};

}
