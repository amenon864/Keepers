#include <catch2/catch_test_macros.hpp>

#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>

#include <keepers/similarity_grouping.hpp>

TEST_CASE("group_similar_photos returns no groups for empty input")
{
    const std::vector<keepers::PhotoHash> photos{};

    REQUIRE(keepers::group_similar_photos(photos, 0).empty());
}

TEST_CASE("group_similar_photos returns one group for one photo")
{
    const std::vector<keepers::PhotoHash> photos{
        {42, 0b0000}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {42}
    };

    REQUIRE(keepers::group_similar_photos(photos, 0) == expected);
}

TEST_CASE("group_similar_photos groups different photos with identical hashes")
{
    const std::vector<keepers::PhotoHash> photos{
        {3, 0b1010},
        {1, 0b1010},
        {2, 0b1010}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {1, 2, 3}
    };

    REQUIRE(keepers::group_similar_photos(photos, 0) == expected);
}

TEST_CASE("group_similar_photos separates and groups maximally different hashes")
{
    const std::vector<keepers::PhotoHash> photos{
        {1, 0},
        {2, std::numeric_limits<std::uint64_t>::max()}
    };

    const std::vector<keepers::SimilarityGroup> separate{
        {1},
        {2}
    };
    const std::vector<keepers::SimilarityGroup> grouped{
        {1, 2}
    };

    REQUIRE(keepers::group_similar_photos(photos, 63) == separate);
    REQUIRE(keepers::group_similar_photos(photos, 64) == grouped);
}

TEST_CASE("group_similar_photos uses an inclusive maximum distance")
{
    const std::vector<keepers::PhotoHash> photos{
        {1, 0b0000},
        {2, 0b0011}
    };

    const std::vector<keepers::SimilarityGroup> separate{
        {1},
        {2}
    };
    const std::vector<keepers::SimilarityGroup> grouped{
        {1, 2}
    };

    REQUIRE(keepers::group_similar_photos(photos, 1) == separate);
    REQUIRE(keepers::group_similar_photos(photos, 2) == grouped);
}

TEST_CASE("group_similar_photos uses connected components for transitive groups")
{
    const std::vector<keepers::PhotoHash> photos{
        {1, 0b0000},
        {2, 0b0001},
        {3, 0b0011}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {1, 2, 3}
    };

    REQUIRE(keepers::group_similar_photos(photos, 1) == expected);
}

TEST_CASE("group_similar_photos returns multiple connected components")
{
    const std::vector<keepers::PhotoHash> photos{
        {30, 0b0000},
        {10, 0b0001},
        {20, 0b0011},
        {50, 0b11110000},
        {40, 0b11110001},
        {60, 0b00111100}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {10, 20, 30},
        {40, 50},
        {60}
    };

    REQUIRE(keepers::group_similar_photos(photos, 1) == expected);
}

TEST_CASE("group_similar_photos returns isolated photos as one-element groups")
{
    const std::vector<keepers::PhotoHash> photos{
        {7, 0b0000},
        {2, 0b0011},
        {5, 0b1100}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {2},
        {5},
        {7}
    };

    REQUIRE(keepers::group_similar_photos(photos, 1) == expected);
}

TEST_CASE("group_similar_photos rejects duplicate IDs")
{
    const std::vector<keepers::PhotoHash> same_hash{
        {1, 0b0000},
        {1, 0b0000}
    };
    const std::vector<keepers::PhotoHash> different_hashes{
        {1, 0b0000},
        {1, 0b0001}
    };

    REQUIRE_THROWS_AS(
        keepers::group_similar_photos(same_hash, 0),
        std::invalid_argument
    );
    REQUIRE_THROWS_AS(
        keepers::group_similar_photos(different_hashes, 1),
        std::invalid_argument
    );
}

TEST_CASE("group_similar_photos rejects invalid maximum distances")
{
    const std::vector<keepers::PhotoHash> photos{
        {1, 0},
        {2, std::numeric_limits<std::uint64_t>::max()}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {1, 2}
    };

    REQUIRE_THROWS_AS(
        keepers::group_similar_photos(photos, 65),
        std::invalid_argument
    );
    REQUIRE(keepers::group_similar_photos(photos, 64) == expected);
}

TEST_CASE("group_similar_photos sorts IDs within groups")
{
    const std::vector<keepers::PhotoHash> photos{
        {9, 0b0001},
        {2, 0b0000},
        {7, 0b0011}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {2, 7, 9}
    };

    REQUIRE(keepers::group_similar_photos(photos, 1) == expected);
}

TEST_CASE("group_similar_photos sorts groups by smallest ID")
{
    const std::vector<keepers::PhotoHash> photos{
        {9, 0b11110000},
        {8, 0b11110001},
        {2, 0b0000},
        {3, 0b0001},
        {5, 0b00111100}
    };

    const std::vector<keepers::SimilarityGroup> expected{
        {2, 3},
        {5},
        {8, 9}
    };

    REQUIRE(keepers::group_similar_photos(photos, 1) == expected);
}

TEST_CASE("group_similar_photos output does not depend on input ordering")
{
    const std::vector<keepers::PhotoHash> first_order{
        {9, 0b1000},
        {2, 0b0000},
        {7, 0b0001},
        {4, 0b1100}
    };
    const std::vector<keepers::PhotoHash> second_order{
        {4, 0b1100},
        {7, 0b0001},
        {9, 0b1000},
        {2, 0b0000}
    };

    REQUIRE(
        keepers::group_similar_photos(first_order, 1) ==
        keepers::group_similar_photos(second_order, 1)
    );
}

TEST_CASE("group_similar_photos leaves input unchanged")
{
    const std::vector<keepers::PhotoHash> original{
        {3, 0b0000},
        {1, 0b0001},
        {2, 0b0011}
    };
    std::vector<keepers::PhotoHash> photos = original;

    static_cast<void>(keepers::group_similar_photos(photos, 1));

    REQUIRE(photos.size() == original.size());

    for (std::size_t index = 0; index < photos.size(); ++index) {
        REQUIRE(photos[index].id == original[index].id);
        REQUIRE(photos[index].hash == original[index].hash);
    }
}
