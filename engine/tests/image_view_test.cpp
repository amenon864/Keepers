#include <catch2/catch_test_macros.hpp>

#include <array>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>

#include <burstpick/image_view.hpp>

TEST_CASE("ImageView exposes metadata and pixels for a valid RGB image")
{
    const std::array<std::uint8_t, 12> pixels{
        1, 2, 3,
        4, 5, 6,
        7, 8, 9,
        10, 11, 12
    };

    const burstpick::ImageView view{pixels, 2, 2, 3};

    REQUIRE(view.width() == 2);
    REQUIRE(view.height() == 2);
    REQUIRE(view.channels() == 3);
    REQUIRE(view.pixel_count() == 4);
    REQUIRE(view.required_size() == 12);
    REQUIRE(view.pixels().size() == 12);
    REQUIRE(view.pixels()[0] == 1);
    REQUIRE(view.pixels()[5] == 6);
    REQUIRE(view.pixels()[11] == 12);
}

TEST_CASE("ImageView exposes metadata for a valid RGBA image")
{
    const std::array<std::uint8_t, 8> pixels{
        10, 20, 30, 40,
        50, 60, 70, 80
    };

    const burstpick::ImageView view{pixels, 1, 2, 4};

    REQUIRE(view.width() == 1);
    REQUIRE(view.height() == 2);
    REQUIRE(view.channels() == 4);
    REQUIRE(view.pixel_count() == 2);
    REQUIRE(view.required_size() == 8);
    REQUIRE(view.pixels().size() == 8);
}

TEST_CASE("ImageView rejects zero width")
{
    const std::array<std::uint8_t, 1> pixels{1};

    REQUIRE_THROWS_AS(
        burstpick::ImageView(pixels, 0, 1, 1),
        std::invalid_argument
    );
}

TEST_CASE("ImageView rejects zero height")
{
    const std::array<std::uint8_t, 1> pixels{1};

    REQUIRE_THROWS_AS(
        burstpick::ImageView(pixels, 1, 0, 1),
        std::invalid_argument
    );
}

TEST_CASE("ImageView rejects zero channels")
{
    const std::array<std::uint8_t, 1> pixels{1};

    REQUIRE_THROWS_AS(
        burstpick::ImageView(pixels, 1, 1, 0),
        std::invalid_argument
    );
}

TEST_CASE("ImageView rejects an undersized pixel buffer")
{
    const std::array<std::uint8_t, 11> pixels{};

    REQUIRE_THROWS_AS(
        burstpick::ImageView(pixels, 2, 2, 3),
        std::invalid_argument
    );
}

TEST_CASE("ImageView rejects width-height overflow")
{
    const std::array<std::uint8_t, 1> pixels{};
    constexpr std::size_t max_size = std::numeric_limits<std::size_t>::max();

    REQUIRE_THROWS_AS(
        burstpick::ImageView(pixels, max_size, 2, 1),
        std::overflow_error
    );
}

TEST_CASE("ImageView rejects channel multiplication overflow")
{
    const std::array<std::uint8_t, 1> pixels{};
    constexpr std::size_t max_size = std::numeric_limits<std::size_t>::max();

    REQUIRE_THROWS_AS(
        burstpick::ImageView(pixels, (max_size / 2) + 1, 1, 2),
        std::overflow_error
    );
}

TEST_CASE("ImageView excludes trailing data from oversized buffers")
{
    const std::array<std::uint8_t, 15> pixels{
        0, 1, 2,
        3, 4, 5,
        6, 7, 8,
        9, 10, 11,
        99, 100, 101
    };

    const burstpick::ImageView view{pixels, 2, 2, 3};

    REQUIRE(view.required_size() == 12);
    REQUIRE(view.pixels().size() == view.required_size());
    REQUIRE(view.pixels().back() == 11);
}

TEST_CASE("ImageView refers to the source buffer without copying")
{
    std::vector<std::uint8_t> pixels{1, 2, 3, 4};
    const burstpick::ImageView view{pixels, 2, 1, 2};

    pixels[2] = 42;

    REQUIRE(view.pixels()[2] == 42);
}
