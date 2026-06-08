#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <cstddef>
#include <limits>
#include <stdexcept>
#include <vector>

#include <keepers/photo_quality.hpp>

namespace {

keepers::PhotoMetrics metrics(
    std::size_t id,
    double sharpness = 10.0,
    double mean_luminance = 128.0,
    double shadow_clipping_ratio = 0.0,
    double highlight_clipping_ratio = 0.0,
    double contrast = 10.0
)
{
    return keepers::PhotoMetrics{
        id,
        sharpness,
        mean_luminance,
        shadow_clipping_ratio,
        highlight_clipping_ratio,
        contrast
    };
}

const keepers::PhotoQualityScore& score_for(
    const std::vector<keepers::PhotoQualityScore>& scores,
    std::size_t id
)
{
    const auto match = std::find_if(
        scores.begin(),
        scores.end(),
        [id](const keepers::PhotoQualityScore& score) {
            return score.id == id;
        }
    );

    REQUIRE(match != scores.end());
    return *match;
}

std::vector<std::size_t> ranked_ids(
    const std::vector<keepers::PhotoQualityScore>& scores
)
{
    std::vector<std::size_t> ids;
    ids.reserve(scores.size());

    for (const keepers::PhotoQualityScore& score : scores) {
        ids.push_back(score.id);
    }

    return ids;
}

}

TEST_CASE("rank_photo_quality returns an empty result for empty input")
{
    const std::vector<keepers::PhotoMetrics> photos{};

    REQUIRE(keepers::rank_photo_quality(photos).empty());
}

TEST_CASE("rank_photo_quality scores a single photo")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(42, 10.0, 0.0, 0.0, 0.0, 20.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(ranked.size() == 1);
    REQUIRE(ranked[0].id == 42);
    REQUIRE(ranked[0].normalized_sharpness == Catch::Approx(0.5));
    REQUIRE(ranked[0].normalized_contrast == Catch::Approx(0.5));
    REQUIRE(ranked[0].exposure_score == Catch::Approx(0.6));
    REQUIRE(ranked[0].overall_score == Catch::Approx(0.52));
}

TEST_CASE("rank_photo_quality preserves every input ID exactly once")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(9, 30.0),
        metrics(2, 10.0),
        metrics(7, 20.0)
    };

    std::vector<std::size_t> ids = ranked_ids(keepers::rank_photo_quality(photos));
    std::sort(ids.begin(), ids.end());

    REQUIRE(ids == std::vector<std::size_t>{2, 7, 9});
}

TEST_CASE("rank_photo_quality rejects duplicate IDs")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0),
        metrics(1, 20.0)
    };

    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(photos),
        std::invalid_argument
    );
}

TEST_CASE("rank_photo_quality rejects non-finite metric values")
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double infinity = std::numeric_limits<double>::infinity();

    SECTION("sharpness")
    {
        REQUIRE_THROWS_AS(
            keepers::rank_photo_quality(
                std::vector<keepers::PhotoMetrics>{metrics(1, nan)}
            ),
            std::invalid_argument
        );
    }

    SECTION("mean luminance")
    {
        REQUIRE_THROWS_AS(
            keepers::rank_photo_quality(
                std::vector<keepers::PhotoMetrics>{
                    metrics(1, 10.0, infinity)
                }
            ),
            std::invalid_argument
        );
    }

    SECTION("shadow clipping")
    {
        REQUIRE_THROWS_AS(
            keepers::rank_photo_quality(
                std::vector<keepers::PhotoMetrics>{
                    metrics(1, 10.0, 128.0, nan)
                }
            ),
            std::invalid_argument
        );
    }

    SECTION("highlight clipping")
    {
        REQUIRE_THROWS_AS(
            keepers::rank_photo_quality(
                std::vector<keepers::PhotoMetrics>{
                    metrics(1, 10.0, 128.0, 0.0, infinity)
                }
            ),
            std::invalid_argument
        );
    }

    SECTION("contrast")
    {
        REQUIRE_THROWS_AS(
            keepers::rank_photo_quality(
                std::vector<keepers::PhotoMetrics>{
                    metrics(1, 10.0, 128.0, 0.0, 0.0, nan)
                }
            ),
            std::invalid_argument
        );
    }
}

TEST_CASE("rank_photo_quality rejects negative sharpness")
{
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{metrics(1, -1.0)}
        ),
        std::invalid_argument
    );
}

TEST_CASE("rank_photo_quality rejects negative contrast")
{
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{
                metrics(1, 10.0, 128.0, 0.0, 0.0, -1.0)
            }
        ),
        std::invalid_argument
    );
}

TEST_CASE("rank_photo_quality rejects invalid mean luminance")
{
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, -1.0)}
        ),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, 256.0)}
        ),
        std::invalid_argument
    );
}

TEST_CASE("rank_photo_quality rejects invalid clipping ratios")
{
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{
                metrics(1, 10.0, 128.0, -0.1, 0.0)
            }
        ),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{
                metrics(1, 10.0, 128.0, 1.1, 0.0)
            }
        ),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{
                metrics(1, 10.0, 128.0, 0.0, -0.1)
            }
        ),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::rank_photo_quality(
            std::vector<keepers::PhotoMetrics>{
                metrics(1, 10.0, 128.0, 0.0, 1.1)
            }
        ),
        std::invalid_argument
    );
}

TEST_CASE("rank_photo_quality normalizes sharpness with min-max scaling")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0),
        metrics(2, 20.0),
        metrics(3, 30.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 1).normalized_sharpness == Catch::Approx(0.0));
    REQUIRE(score_for(ranked, 2).normalized_sharpness == Catch::Approx(0.5));
    REQUIRE(score_for(ranked, 3).normalized_sharpness == Catch::Approx(1.0));
}

TEST_CASE("rank_photo_quality assigns midpoint normalized sharpness when equal")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0),
        metrics(2, 10.0),
        metrics(3, 10.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 1).normalized_sharpness == Catch::Approx(0.5));
    REQUIRE(score_for(ranked, 2).normalized_sharpness == Catch::Approx(0.5));
    REQUIRE(score_for(ranked, 3).normalized_sharpness == Catch::Approx(0.5));
}

TEST_CASE("rank_photo_quality normalizes contrast with min-max scaling")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 128.0, 0.0, 0.0, 10.0),
        metrics(2, 10.0, 128.0, 0.0, 0.0, 20.0),
        metrics(3, 10.0, 128.0, 0.0, 0.0, 30.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 1).normalized_contrast == Catch::Approx(0.0));
    REQUIRE(score_for(ranked, 2).normalized_contrast == Catch::Approx(0.5));
    REQUIRE(score_for(ranked, 3).normalized_contrast == Catch::Approx(1.0));
}

TEST_CASE("rank_photo_quality assigns midpoint normalized contrast when equal")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 128.0, 0.0, 0.0, 20.0),
        metrics(2, 20.0, 128.0, 0.0, 0.0, 20.0),
        metrics(3, 30.0, 128.0, 0.0, 0.0, 20.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 1).normalized_contrast == Catch::Approx(0.5));
    REQUIRE(score_for(ranked, 2).normalized_contrast == Catch::Approx(0.5));
    REQUIRE(score_for(ranked, 3).normalized_contrast == Catch::Approx(0.5));
}

TEST_CASE("rank_photo_quality gives ideal midpoint exposure a perfect score")
{
    const auto ranked = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1)}
    );

    REQUIRE(ranked[0].exposure_score == Catch::Approx(1.0));
}

TEST_CASE("rank_photo_quality reduces exposure score for dark images")
{
    const auto ideal = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, 128.0)}
    );
    const auto dark = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, 64.0)}
    );

    REQUIRE(dark[0].exposure_score < ideal[0].exposure_score);
    REQUIRE(dark[0].exposure_score == Catch::Approx(0.8));
}

TEST_CASE("rank_photo_quality reduces exposure score for bright images")
{
    const auto ideal = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, 128.0)}
    );
    const auto bright = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, 192.0)}
    );

    REQUIRE(bright[0].exposure_score < ideal[0].exposure_score);
    REQUIRE(bright[0].exposure_score == Catch::Approx(0.8));
}

TEST_CASE("rank_photo_quality applies shadow clipping exposure penalty")
{
    const auto clean = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1)}
    );
    const auto clipped = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1, 10.0, 128.0, 0.5)}
    );

    REQUIRE(clipped[0].exposure_score < clean[0].exposure_score);
    REQUIRE(clipped[0].exposure_score == Catch::Approx(0.85));
}

TEST_CASE("rank_photo_quality applies highlight clipping exposure penalty")
{
    const auto clean = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{metrics(1)}
    );
    const auto clipped = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{
            metrics(1, 10.0, 128.0, 0.0, 0.5)
        }
    );

    REQUIRE(clipped[0].exposure_score < clean[0].exposure_score);
    REQUIRE(clipped[0].exposure_score == Catch::Approx(0.85));
}

TEST_CASE("rank_photo_quality clamps extreme exposure scores")
{
    const auto ranked = keepers::rank_photo_quality(
        std::vector<keepers::PhotoMetrics>{
            metrics(1, 10.0, 0.0, 1.0, 1.0)
        }
    );

    REQUIRE(ranked[0].exposure_score == Catch::Approx(0.0));
}

TEST_CASE("rank_photo_quality ranks a sharper photo higher")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0),
        metrics(2, 20.0)
    };

    REQUIRE(ranked_ids(keepers::rank_photo_quality(photos))[0] == 2);
}

TEST_CASE("rank_photo_quality lets better exposure overcome a small sharpness gap")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 100.0, 0.0, 0.0, 0.0, 10.0),
        metrics(2, 99.0, 128.0, 0.0, 0.0, 10.0),
        metrics(3, 0.0, 0.0, 0.0, 0.0, 10.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(ranked[0].id == 2);
    REQUIRE(score_for(ranked, 2).overall_score > score_for(ranked, 1).overall_score);
}

TEST_CASE("rank_photo_quality uses contrast in ranking")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 128.0, 0.0, 0.0, 10.0),
        metrics(2, 10.0, 128.0, 0.0, 0.0, 20.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(ranked[0].id == 2);
    REQUIRE(ranked[0].normalized_contrast == Catch::Approx(1.0));
}

TEST_CASE("rank_photo_quality applies severe highlight clipping multiplier")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 128.0, 0.0, 0.25),
        metrics(2, 10.0, 128.0, 0.0, 0.26)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 2).overall_score < score_for(ranked, 1).overall_score);
}

TEST_CASE("rank_photo_quality applies severe shadow clipping multiplier")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 128.0, 0.40, 0.0),
        metrics(2, 10.0, 128.0, 0.41, 0.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 2).overall_score < score_for(ranked, 1).overall_score);
}

TEST_CASE("rank_photo_quality applies both severe clipping multipliers")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 128.0, 0.0, 0.0),
        metrics(2, 10.0, 128.0, 0.41, 0.26)
    };

    const auto ranked = keepers::rank_photo_quality(photos);
    const double weighted =
        0.65 * 0.5 +
        0.20 * score_for(ranked, 2).exposure_score +
        0.15 * 0.5;

    REQUIRE(score_for(ranked, 2).overall_score == Catch::Approx(
        weighted * 0.75 * 0.75
    ));
}

TEST_CASE("rank_photo_quality breaks overall score ties by sharpness")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 0.0, 1.0 / 3.0, 0.0, 30.0),
        metrics(2, 0.0, 128.0, 0.0, 0.0, 55.0),
        metrics(3, 40.0, 128.0, 0.0, 0.0, 0.0),
        metrics(4, 20.0, 128.0, 0.0, 0.0, 60.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 1).overall_score == Catch::Approx(
        score_for(ranked, 2).overall_score
    ));
    REQUIRE(
        score_for(ranked, 1).normalized_sharpness >
        score_for(ranked, 2).normalized_sharpness
    );

    const auto ids = ranked_ids(ranked);
    REQUIRE(
        std::find(ids.begin(), ids.end(), 1) <
        std::find(ids.begin(), ids.end(), 2)
    );
}

TEST_CASE("rank_photo_quality breaks sharpness ties by lower clipping total")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(1, 10.0, 0.0, 0.0, 0.0, 10.0),
        metrics(2, 10.0, 217.6, 0.2, 0.2, 10.0)
    };

    const auto ranked = keepers::rank_photo_quality(photos);

    REQUIRE(score_for(ranked, 1).overall_score == Catch::Approx(
        score_for(ranked, 2).overall_score
    ));
    REQUIRE(ranked[0].id == 1);
}

TEST_CASE("rank_photo_quality breaks complete metric ties by lower ID")
{
    const std::vector<keepers::PhotoMetrics> photos{
        metrics(9),
        metrics(2)
    };

    REQUIRE(ranked_ids(keepers::rank_photo_quality(photos)) ==
        std::vector<std::size_t>{2, 9});
}

TEST_CASE("rank_photo_quality output does not depend on input ordering")
{
    const std::vector<keepers::PhotoMetrics> first_order{
        metrics(9, 30.0, 128.0, 0.0, 0.0, 30.0),
        metrics(2, 10.0, 64.0, 0.0, 0.0, 10.0),
        metrics(7, 20.0, 128.0, 0.0, 0.1, 20.0)
    };
    const std::vector<keepers::PhotoMetrics> second_order{
        first_order[2],
        first_order[0],
        first_order[1]
    };

    REQUIRE(
        ranked_ids(keepers::rank_photo_quality(first_order)) ==
        ranked_ids(keepers::rank_photo_quality(second_order))
    );
}

TEST_CASE("rank_photo_quality leaves input unchanged")
{
    const std::vector<keepers::PhotoMetrics> original{
        metrics(3, 30.0),
        metrics(1, 10.0),
        metrics(2, 20.0)
    };
    std::vector<keepers::PhotoMetrics> photos = original;

    static_cast<void>(keepers::rank_photo_quality(photos));

    REQUIRE(photos.size() == original.size());

    for (std::size_t index = 0; index < photos.size(); ++index) {
        REQUIRE(photos[index].id == original[index].id);
        REQUIRE(photos[index].sharpness == original[index].sharpness);
        REQUIRE(photos[index].mean_luminance == original[index].mean_luminance);
        REQUIRE(
            photos[index].shadow_clipping_ratio ==
            original[index].shadow_clipping_ratio
        );
        REQUIRE(
            photos[index].highlight_clipping_ratio ==
            original[index].highlight_clipping_ratio
        );
        REQUIRE(photos[index].contrast == original[index].contrast);
    }
}
