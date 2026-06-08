#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <array>
#include <cstdint>
#include <stdexcept>
#include <vector>

#include <keepers/difference_hash.hpp>
#include <keepers/grayscale.hpp>
#include <keepers/image_metrics.hpp>
#include <keepers/image_view.hpp>
#include <keepers/photo_analysis.hpp>
#include <keepers/sharpness.hpp>

namespace {

void require_same_metrics(
    const keepers::PhotoAnalysis& left,
    const keepers::PhotoAnalysis& right
)
{
    REQUIRE(left.sharpness == Catch::Approx(right.sharpness));
    REQUIRE(left.mean_luminance == Catch::Approx(right.mean_luminance));
    REQUIRE(
        left.shadow_clipping_ratio ==
        Catch::Approx(right.shadow_clipping_ratio)
    );
    REQUIRE(
        left.highlight_clipping_ratio ==
        Catch::Approx(right.highlight_clipping_ratio)
    );
    REQUIRE(left.contrast == Catch::Approx(right.contrast));
    REQUIRE(left.difference_hash == right.difference_hash);
}

}

TEST_CASE("analyze_photo preserves the supplied photo ID")
{
    const std::array<std::uint8_t, 27> pixels{
        0, 0, 0,       20, 20, 20,    40, 40, 40,
        60, 60, 60,    80, 80, 80,    100, 100, 100,
        120, 120, 120, 140, 140, 140, 160, 160, 160
    };
    const keepers::ImageView image{pixels, 3, 3, 3};

    const keepers::PhotoAnalysis analysis = keepers::analyze_photo(123, image);

    REQUIRE(analysis.id == 123);
}

TEST_CASE("analyze_photo composes grayscale-derived metrics")
{
    const std::array<std::uint8_t, 75> pixels{
        0, 0, 0,       32, 16, 8,      64, 32, 16,
        96, 48, 24,    128, 64, 32,
        16, 64, 32,    48, 96, 64,     80, 128, 96,
        112, 160, 128, 144, 192, 160,
        32, 128, 64,   64, 160, 96,    96, 192, 128,
        128, 224, 160, 160, 255, 192,
        48, 192, 96,   80, 224, 128,   112, 255, 160,
        144, 240, 192, 176, 224, 224,
        64, 255, 128,  96, 240, 160,   128, 224, 192,
        160, 208, 224, 192, 192, 255
    };
    const keepers::ImageView image{pixels, 5, 5, 3};

    const std::vector<std::uint8_t> grayscale = keepers::to_grayscale(image);
    const double sharpness = keepers::laplacian_variance(grayscale, 5, 5);
    const keepers::ExposureMetrics exposure =
        keepers::analyze_exposure(grayscale);
    const double contrast = keepers::percentile_contrast(grayscale);
    const std::uint64_t hash = keepers::difference_hash(grayscale, 5, 5);

    const keepers::PhotoAnalysis analysis = keepers::analyze_photo(7, image);

    REQUIRE(analysis.id == 7);
    REQUIRE(analysis.sharpness == Catch::Approx(sharpness));
    REQUIRE(analysis.mean_luminance == Catch::Approx(exposure.mean_luminance));
    REQUIRE(
        analysis.shadow_clipping_ratio ==
        Catch::Approx(exposure.shadow_clipping_ratio)
    );
    REQUIRE(
        analysis.highlight_clipping_ratio ==
        Catch::Approx(exposure.highlight_clipping_ratio)
    );
    REQUIRE(analysis.contrast == Catch::Approx(contrast));
    REQUIRE(analysis.difference_hash == hash);
}

TEST_CASE("analyze_photo succeeds for RGB input")
{
    const std::array<std::uint8_t, 27> pixels{
        0, 0, 0,       32, 32, 32,    64, 64, 64,
        96, 96, 96,    128, 128, 128, 160, 160, 160,
        192, 192, 192, 224, 224, 224, 255, 255, 255
    };
    const keepers::ImageView image{pixels, 3, 3, 3};

    const keepers::PhotoAnalysis analysis = keepers::analyze_photo(1, image);

    REQUIRE(analysis.id == 1);
}

TEST_CASE("analyze_photo succeeds for RGBA input and ignores alpha")
{
    const std::array<std::uint8_t, 36> transparent{
        0, 0, 0, 0,       32, 32, 32, 0,    64, 64, 64, 0,
        96, 96, 96, 0,    128, 128, 128, 0, 160, 160, 160, 0,
        192, 192, 192, 0, 224, 224, 224, 0, 255, 255, 255, 0
    };
    const std::array<std::uint8_t, 36> opaque{
        0, 0, 0, 255,       32, 32, 32, 255,    64, 64, 64, 255,
        96, 96, 96, 255,    128, 128, 128, 255, 160, 160, 160, 255,
        192, 192, 192, 255, 224, 224, 224, 255, 255, 255, 255, 255
    };
    const keepers::ImageView transparent_image{transparent, 3, 3, 4};
    const keepers::ImageView opaque_image{opaque, 3, 3, 4};

    const keepers::PhotoAnalysis transparent_analysis =
        keepers::analyze_photo(1, transparent_image);
    const keepers::PhotoAnalysis opaque_analysis =
        keepers::analyze_photo(2, opaque_image);

    REQUIRE(transparent_analysis.id == 1);
    REQUIRE(opaque_analysis.id == 2);
    require_same_metrics(transparent_analysis, opaque_analysis);
}

TEST_CASE("analyze_photo is deterministic")
{
    const std::array<std::uint8_t, 27> pixels{
        0, 10, 20,    30, 40, 50,    60, 70, 80,
        90, 100, 110, 120, 130, 140, 150, 160, 170,
        180, 190, 200, 210, 220, 230, 240, 250, 255
    };
    const keepers::ImageView image{pixels, 3, 3, 3};

    const keepers::PhotoAnalysis first = keepers::analyze_photo(8, image);
    const keepers::PhotoAnalysis second = keepers::analyze_photo(8, image);

    REQUIRE(first.id == second.id);
    require_same_metrics(first, second);
}

TEST_CASE("analyze_photo leaves the source pixels unchanged")
{
    const std::vector<std::uint8_t> original{
        0, 0, 0,       32, 32, 32,    64, 64, 64,
        96, 96, 96,    128, 128, 128, 160, 160, 160,
        192, 192, 192, 224, 224, 224, 255, 255, 255
    };
    std::vector<std::uint8_t> pixels = original;
    const keepers::ImageView image{pixels, 3, 3, 3};

    static_cast<void>(keepers::analyze_photo(9, image));

    REQUIRE(pixels == original);
}

TEST_CASE("analyze_photo propagates unsupported channel errors")
{
    const std::array<std::uint8_t, 9> pixels{
        0, 32, 64,
        96, 128, 160,
        192, 224, 255
    };
    const keepers::ImageView image{pixels, 3, 3, 1};

    REQUIRE_THROWS_AS(
        keepers::analyze_photo(1, image),
        std::invalid_argument
    );
}

TEST_CASE("analyze_photo propagates small image sharpness errors")
{
    const std::array<std::uint8_t, 12> pixels{
        0, 0, 0,    64, 64, 64,
        128, 128, 128, 255, 255, 255
    };
    const keepers::ImageView image{pixels, 2, 2, 3};

    REQUIRE_THROWS_AS(
        keepers::analyze_photo(1, image),
        std::invalid_argument
    );
}
