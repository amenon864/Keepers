#include <catch2/catch_test_macros.hpp>

#include <array>
#include <cstdint>
#include <stdexcept>
#include <vector>

#include <keepers/grayscale.hpp>
#include <keepers/image_view.hpp>

TEST_CASE("to_grayscale converts a black RGB pixel")
{
    const std::array<std::uint8_t, 3> pixels{0, 0, 0};
    const keepers::ImageView image{pixels, 1, 1, 3};

    const std::vector<std::uint8_t> grayscale =
        keepers::to_grayscale(image);

    REQUIRE(grayscale == std::vector<std::uint8_t>{0});
}

TEST_CASE("to_grayscale converts a white RGB pixel")
{
    const std::array<std::uint8_t, 3> pixels{255, 255, 255};
    const keepers::ImageView image{pixels, 1, 1, 3};

    const std::vector<std::uint8_t> grayscale =
        keepers::to_grayscale(image);

    REQUIRE(grayscale == std::vector<std::uint8_t>{255});
}

TEST_CASE("to_grayscale converts RGB primary colors")
{
    const std::array<std::uint8_t, 9> pixels{
        255, 0, 0,
        0, 255, 0,
        0, 0, 255
    };
    const keepers::ImageView image{pixels, 3, 1, 3};

    const std::vector<std::uint8_t> grayscale =
        keepers::to_grayscale(image);

    REQUIRE(grayscale == std::vector<std::uint8_t>{54, 182, 18});
}

TEST_CASE("to_grayscale converts multiple RGB pixels in order")
{
    const std::array<std::uint8_t, 12> pixels{
        10, 20, 30,
        120, 90, 60,
        200, 100, 50,
        5, 250, 125
    };
    const keepers::ImageView image{pixels, 2, 2, 3};

    const std::vector<std::uint8_t> grayscale =
        keepers::to_grayscale(image);

    REQUIRE(grayscale.size() == 4);
    REQUIRE(grayscale == std::vector<std::uint8_t>{19, 94, 118, 189});
}

TEST_CASE("to_grayscale ignores alpha for RGBA input")
{
    const std::array<std::uint8_t, 8> pixels{
        80, 120, 160, 0,
        80, 120, 160, 255
    };
    const keepers::ImageView image{pixels, 2, 1, 4};

    const std::vector<std::uint8_t> grayscale =
        keepers::to_grayscale(image);

    REQUIRE(grayscale == std::vector<std::uint8_t>{114, 114});
}

TEST_CASE("to_grayscale rejects unsupported channel counts")
{
    const std::array<std::uint8_t, 1> grayscale_pixel{128};
    const std::array<std::uint8_t, 2> two_channel_pixel{128, 255};
    const std::array<std::uint8_t, 5> five_channel_pixel{1, 2, 3, 4, 5};

    const keepers::ImageView one_channel{
        grayscale_pixel,
        1,
        1,
        1
    };
    const keepers::ImageView two_channels{
        two_channel_pixel,
        1,
        1,
        2
    };
    const keepers::ImageView five_channels{
        five_channel_pixel,
        1,
        1,
        5
    };

    REQUIRE_THROWS_AS(
        keepers::to_grayscale(one_channel),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::to_grayscale(two_channels),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::to_grayscale(five_channels),
        std::invalid_argument
    );
}

TEST_CASE("to_grayscale leaves the source buffer unchanged")
{
    const std::vector<std::uint8_t> original{
        10, 20, 30,
        40, 50, 60
    };
    std::vector<std::uint8_t> pixels = original;
    const keepers::ImageView image{pixels, 2, 1, 3};

    static_cast<void>(keepers::to_grayscale(image));

    REQUIRE(pixels == original);
}

TEST_CASE("to_grayscale returns storage independent of the source buffer")
{
    std::vector<std::uint8_t> pixels{255, 0, 0};
    const keepers::ImageView image{pixels, 1, 1, 3};

    const std::vector<std::uint8_t> grayscale =
        keepers::to_grayscale(image);
    pixels[0] = 0;
    pixels[1] = 255;

    REQUIRE(grayscale == std::vector<std::uint8_t>{54});
}
