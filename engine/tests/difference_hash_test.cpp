#include <catch2/catch_test_macros.hpp>

#include <array>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>

#include <keepers/difference_hash.hpp>

TEST_CASE("difference_hash returns zero for a uniform image")
{
    const std::array<std::uint8_t, 72> grayscale{
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42,
        42, 42, 42, 42, 42, 42, 42, 42, 42
    };

    REQUIRE(keepers::difference_hash(grayscale, 9, 8) == 0);
}

TEST_CASE("difference_hash sets all bits for increasing horizontal gradients")
{
    const std::array<std::uint8_t, 72> grayscale{
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8
    };

    REQUIRE(
        keepers::difference_hash(grayscale, 9, 8) ==
        std::numeric_limits<std::uint64_t>::max()
    );
}

TEST_CASE("difference_hash returns zero for decreasing horizontal gradients")
{
    const std::array<std::uint8_t, 72> grayscale{
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0,
        8, 7, 6, 5, 4, 3, 2, 1, 0
    };

    REQUIRE(keepers::difference_hash(grayscale, 9, 8) == 0);
}

TEST_CASE("difference_hash uses row-major bit ordering for alternating rows")
{
    const std::array<std::uint8_t, 72> grayscale{
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0,
        0, 255, 0, 255, 0, 255, 0, 255, 0
    };

    REQUIRE(keepers::difference_hash(grayscale, 9, 8) == 0x5555555555555555ULL);
}

TEST_CASE("difference_hash maps the first row fourth comparison to bit three")
{
    std::array<std::uint8_t, 72> grayscale{};
    grayscale.fill(100);
    grayscale[3] = 0;
    grayscale[4] = 255;

    REQUIRE(keepers::difference_hash(grayscale, 9, 8) == (std::uint64_t{1} << 3));
}

TEST_CASE("difference_hash rejects exact input size mismatches")
{
    const std::array<std::uint8_t, 71> smaller{};
    const std::array<std::uint8_t, 73> larger{};

    REQUIRE_THROWS_AS(
        keepers::difference_hash(smaller, 9, 8),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::difference_hash(larger, 9, 8),
        std::invalid_argument
    );
}

TEST_CASE("difference_hash rejects zero dimensions")
{
    const std::array<std::uint8_t, 1> grayscale{0};

    REQUIRE_THROWS_AS(
        keepers::difference_hash(grayscale, 0, 1),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::difference_hash(grayscale, 1, 0),
        std::invalid_argument
    );
}

TEST_CASE("difference_hash rejects dimension overflow")
{
    const std::array<std::uint8_t, 1> grayscale{0};
    constexpr std::size_t max_size = std::numeric_limits<std::size_t>::max();

    REQUIRE_THROWS_AS(
        keepers::difference_hash(grayscale, max_size, 2),
        std::overflow_error
    );
}

TEST_CASE("difference_hash resizes tiny valid inputs deterministically")
{
    const std::array<std::uint8_t, 1> one_by_one{128};
    const std::array<std::uint8_t, 4> two_by_two{
        0, 255,
        128, 64
    };

    REQUIRE(keepers::difference_hash(one_by_one, 1, 1) == 0);
    REQUIRE(
        keepers::difference_hash(two_by_two, 2, 2) ==
        keepers::difference_hash(two_by_two, 2, 2)
    );
}

TEST_CASE("difference_hash resizes larger inputs deterministically")
{
    std::vector<std::uint8_t> grayscale(16 * 12);

    for (std::size_t y = 0; y < 12; ++y) {
        for (std::size_t x = 0; x < 16; ++x) {
            grayscale[y * 16 + x] = static_cast<std::uint8_t>(
                (x * 13 + y * 7) % 256
            );
        }
    }

    REQUIRE(
        keepers::difference_hash(grayscale, 16, 12) ==
        keepers::difference_hash(grayscale, 16, 12)
    );
}

TEST_CASE("difference_hash leaves input unchanged")
{
    const std::vector<std::uint8_t> original{
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8,
        0, 1, 2, 3, 4, 5, 6, 7, 8
    };
    std::vector<std::uint8_t> grayscale = original;

    static_cast<void>(keepers::difference_hash(grayscale, 9, 8));

    REQUIRE(grayscale == original);
}

TEST_CASE("hamming_distance returns zero for identical hashes")
{
    REQUIRE(
        keepers::hamming_distance(
            0x123456789ABCDEF0ULL,
            0x123456789ABCDEF0ULL
        ) == 0
    );
}

TEST_CASE("hamming_distance counts a one-bit difference")
{
    REQUIRE(keepers::hamming_distance(0, std::uint64_t{1} << 42) == 1);
}

TEST_CASE("hamming_distance counts all differing bits")
{
    REQUIRE(
        keepers::hamming_distance(
            0,
            std::numeric_limits<std::uint64_t>::max()
        ) == 64
    );
}

TEST_CASE("hamming_distance handles known bit patterns")
{
    REQUIRE(keepers::hamming_distance(0b10101010ULL, 0b00101111ULL) == 3);
}

TEST_CASE("hamming_distance is symmetric")
{
    constexpr std::uint64_t left = 0x0F0F0F0F0F0F0F0FULL;
    constexpr std::uint64_t right = 0x3333333333333333ULL;

    REQUIRE(
        keepers::hamming_distance(left, right) ==
        keepers::hamming_distance(right, left)
    );
}
