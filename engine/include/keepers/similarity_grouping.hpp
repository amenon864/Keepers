#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

namespace keepers {

struct PhotoHash {
    std::size_t id;
    std::uint64_t hash;
};

using SimilarityGroup = std::vector<std::size_t>;

[[nodiscard]] std::vector<SimilarityGroup> group_similar_photos(
    std::span<const PhotoHash> photos,
    unsigned int maximum_distance
);

}
