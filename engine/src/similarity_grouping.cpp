#include <keepers/similarity_grouping.hpp>

#include <keepers/difference_hash.hpp>

#include <algorithm>
#include <stdexcept>
#include <vector>

namespace keepers {

std::vector<SimilarityGroup> group_similar_photos(
    std::span<const PhotoHash> photos,
    unsigned int maximum_distance
)
{
    if (maximum_distance > 64) {
        throw std::invalid_argument{"maximum hash distance must be 64 or less"};
    }

    std::vector<std::vector<std::size_t>> neighbours(photos.size());

    for (std::size_t left = 0; left < photos.size(); ++left) {
        for (std::size_t right = left + 1; right < photos.size(); ++right) {
            if (photos[left].id == photos[right].id) {
                throw std::invalid_argument{"photo IDs must be unique"};
            }

            if (
                hamming_distance(photos[left].hash, photos[right].hash) <=
                maximum_distance
            ) {
                neighbours[left].push_back(right);
                neighbours[right].push_back(left);
            }
        }
    }

    std::vector<bool> visited(photos.size(), false);
    std::vector<SimilarityGroup> groups;

    for (std::size_t start = 0; start < photos.size(); ++start) {
        if (visited[start]) {
            continue;
        }

        SimilarityGroup group;
        std::vector<std::size_t> stack{start};
        visited[start] = true;

        while (!stack.empty()) {
            const std::size_t current = stack.back();
            stack.pop_back();
            group.push_back(photos[current].id);

            for (const std::size_t next : neighbours[current]) {
                if (!visited[next]) {
                    visited[next] = true;
                    stack.push_back(next);
                }
            }
        }

        std::sort(group.begin(), group.end());
        groups.push_back(group);
    }

    std::sort(
        groups.begin(),
        groups.end(),
        [](const SimilarityGroup& left, const SimilarityGroup& right) {
            return left.front() < right.front();
        }
    );

    return groups;
}

}
