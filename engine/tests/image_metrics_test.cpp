#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <array>
#include <cstdint>
#include <stdexcept>
#include <vector>

#include <burstpick/image_metrics.hpp>

TEST_CASE("analyze_exposure rejects empty input")
{
    const std::array<std::uint8_t, 0> grayscale{};

    REQUIRE_THROWS_AS(
        burstpick::analyze_exposure(grayscale),
        std::invalid_argument
    );
}

TEST_CASE("analyze_exposure reports all-black input")
{
    const std::array<std::uint8_t, 4> grayscale{0, 0, 0, 0};

    const burstpick::ExposureMetrics exposure =
        burstpick::analyze_exposure(grayscale);

    REQUIRE(exposure.mean_luminance == Catch::Approx(0.0));
    REQUIRE(exposure.shadow_clipping_ratio == Catch::Approx(1.0));
    REQUIRE(exposure.highlight_clipping_ratio == Catch::Approx(0.0));
}

TEST_CASE("analyze_exposure reports all-white input")
{
    const std::array<std::uint8_t, 4> grayscale{255, 255, 255, 255};

    const burstpick::ExposureMetrics exposure =
        burstpick::analyze_exposure(grayscale);

    REQUIRE(exposure.mean_luminance == Catch::Approx(255.0));
    REQUIRE(exposure.shadow_clipping_ratio == Catch::Approx(0.0));
    REQUIRE(exposure.highlight_clipping_ratio == Catch::Approx(1.0));
}

TEST_CASE("analyze_exposure reports mixed values")
{
    const std::array<std::uint8_t, 8> grayscale{
        0, 5, 6, 100, 128, 249, 250, 255
    };

    const burstpick::ExposureMetrics exposure =
        burstpick::analyze_exposure(grayscale);

    REQUIRE(exposure.mean_luminance == Catch::Approx(124.125));
    REQUIRE(exposure.shadow_clipping_ratio == Catch::Approx(0.25));
    REQUIRE(exposure.highlight_clipping_ratio == Catch::Approx(0.25));
}

TEST_CASE("analyze_exposure clipping thresholds are inclusive")
{
    const std::array<std::uint8_t, 4> grayscale{5, 6, 249, 250};

    const burstpick::ExposureMetrics exposure =
        burstpick::analyze_exposure(grayscale);

    REQUIRE(exposure.shadow_clipping_ratio == Catch::Approx(0.25));
    REQUIRE(exposure.highlight_clipping_ratio == Catch::Approx(0.25));
}

TEST_CASE("analyze_exposure leaves input unchanged")
{
    const std::vector<std::uint8_t> original{0, 5, 100, 250, 255};
    std::vector<std::uint8_t> grayscale = original;

    static_cast<void>(burstpick::analyze_exposure(grayscale));

    REQUIRE(grayscale == original);
}

TEST_CASE("percentile_contrast rejects empty input")
{
    const std::array<std::uint8_t, 0> grayscale{};

    REQUIRE_THROWS_AS(
        burstpick::percentile_contrast(grayscale),
        std::invalid_argument
    );
}

TEST_CASE("percentile_contrast returns zero for uniform input")
{
    const std::array<std::uint8_t, 5> grayscale{42, 42, 42, 42, 42};

    REQUIRE(
        burstpick::percentile_contrast(grayscale) ==
        Catch::Approx(0.0)
    );
}

TEST_CASE("percentile_contrast detects high-contrast input")
{
    const std::array<std::uint8_t, 6> grayscale{0, 0, 20, 235, 255, 255};

    REQUIRE(burstpick::percentile_contrast(grayscale) > 0.0);
}

TEST_CASE("percentile_contrast uses floor percentile indices")
{
    const std::array<std::uint8_t, 11> grayscale{
        100, 0, 40, 20, 80, 10, 70, 50, 90, 30, 60
    };

    REQUIRE(
        burstpick::percentile_contrast(grayscale) ==
        Catch::Approx(80.0)
    );
}

TEST_CASE("percentile_contrast is independent of input ordering")
{
    const std::array<std::uint8_t, 7> ordered{0, 10, 20, 30, 200, 240, 255};
    const std::array<std::uint8_t, 7> shuffled{240, 20, 255, 0, 30, 200, 10};

    REQUIRE(
        burstpick::percentile_contrast(ordered) ==
        Catch::Approx(burstpick::percentile_contrast(shuffled))
    );
}

TEST_CASE("percentile_contrast leaves input unchanged")
{
    const std::vector<std::uint8_t> original{80, 10, 220, 40, 160};
    std::vector<std::uint8_t> grayscale = original;

    static_cast<void>(burstpick::percentile_contrast(grayscale));

    REQUIRE(grayscale == original);
}

TEST_CASE("percentile_contrast returns zero for single-value input")
{
    const std::array<std::uint8_t, 1> grayscale{128};

    REQUIRE(
        burstpick::percentile_contrast(grayscale) ==
        Catch::Approx(0.0)
    );
}

TEST_CASE("percentile_contrast handles small input using floor indices")
{
    const std::array<std::uint8_t, 3> grayscale{200, 10, 100};

    REQUIRE(
        burstpick::percentile_contrast(grayscale) ==
        Catch::Approx(90.0)
    );
}
