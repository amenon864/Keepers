#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <array>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>

#include <burstpick/sharpness.hpp>

TEST_CASE("laplacian_variance returns zero for a uniform image")
{
    const std::array<std::uint8_t, 9> grayscale{
        42, 42, 42,
        42, 42, 42,
        42, 42, 42
    };

    REQUIRE(
        burstpick::laplacian_variance(grayscale, 3, 3) ==
        Catch::Approx(0.0)
    );
}

TEST_CASE("laplacian_variance detects a single bright center pixel")
{
    const std::array<std::uint8_t, 25> grayscale{
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 255, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0
    };

    REQUIRE(burstpick::laplacian_variance(grayscale, 5, 5) > 0.0);
}

TEST_CASE("laplacian_variance scores detailed images higher than flat images")
{
    const std::array<std::uint8_t, 25> flat{
        128, 128, 128, 128, 128,
        128, 128, 128, 128, 128,
        128, 128, 128, 128, 128,
        128, 128, 128, 128, 128,
        128, 128, 128, 128, 128
    };
    const std::array<std::uint8_t, 25> detailed{
        0, 255, 0, 255, 0,
        255, 0, 255, 0, 255,
        0, 255, 0, 255, 0,
        255, 0, 255, 0, 255,
        0, 255, 0, 255, 0
    };

    const double flat_score = burstpick::laplacian_variance(flat, 5, 5);
    const double detailed_score =
        burstpick::laplacian_variance(detailed, 5, 5);

    REQUIRE(detailed_score > flat_score);
}

TEST_CASE("laplacian_variance scores abrupt edges higher than gradual transitions")
{
    const std::array<std::uint8_t, 25> gradual{
        0, 64, 128, 192, 255,
        0, 64, 128, 192, 255,
        0, 64, 128, 192, 255,
        0, 64, 128, 192, 255,
        0, 64, 128, 192, 255
    };
    const std::array<std::uint8_t, 25> sharp_edge{
        0, 0, 0, 255, 255,
        0, 0, 0, 255, 255,
        0, 0, 0, 255, 255,
        0, 0, 0, 255, 255,
        0, 0, 0, 255, 255
    };

    const double gradual_score =
        burstpick::laplacian_variance(gradual, 5, 5);
    const double sharp_edge_score =
        burstpick::laplacian_variance(sharp_edge, 5, 5);

    REQUIRE(sharp_edge_score > gradual_score);
}

TEST_CASE("laplacian_variance rejects grayscale buffer size mismatches")
{
    const std::array<std::uint8_t, 8> smaller{};
    const std::array<std::uint8_t, 10> larger{};

    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(smaller, 3, 3),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(larger, 3, 3),
        std::invalid_argument
    );
}

TEST_CASE("laplacian_variance rejects zero dimensions")
{
    const std::array<std::uint8_t, 9> grayscale{};

    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(grayscale, 0, 3),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(grayscale, 3, 0),
        std::invalid_argument
    );
}

TEST_CASE("laplacian_variance rejects images smaller than 3x3")
{
    const std::array<std::uint8_t, 6> two_by_three{};
    const std::array<std::uint8_t, 6> three_by_two{};
    const std::array<std::uint8_t, 1> one_by_one{};

    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(two_by_three, 2, 3),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(three_by_two, 3, 2),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(one_by_one, 1, 1),
        std::invalid_argument
    );
}

TEST_CASE("laplacian_variance rejects dimension overflow")
{
    const std::array<std::uint8_t, 1> grayscale{};
    constexpr std::size_t max_size = std::numeric_limits<std::size_t>::max();

    REQUIRE_THROWS_AS(
        burstpick::laplacian_variance(grayscale, max_size, 2),
        std::overflow_error
    );
}

TEST_CASE("laplacian_variance leaves the source buffer unchanged")
{
    const std::vector<std::uint8_t> original{
        10, 10, 10, 10, 10,
        10, 50, 80, 50, 10,
        10, 80, 255, 80, 10,
        10, 50, 80, 50, 10,
        10, 10, 10, 10, 10
    };
    std::vector<std::uint8_t> grayscale = original;

    static_cast<void>(burstpick::laplacian_variance(grayscale, 5, 5));

    REQUIRE(grayscale == original);
}
