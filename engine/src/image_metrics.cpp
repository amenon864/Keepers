#include <burstpick/image_metrics.hpp>

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>

namespace {

constexpr std::uint8_t shadow_threshold = 5;
constexpr std::uint8_t highlight_threshold = 250;

void require_non_empty(std::span<const std::uint8_t> grayscale)
{
    if (grayscale.empty()) {
        throw std::invalid_argument{"grayscale buffer must not be empty"};
    }
}

std::size_t percentile_index(double percentile, std::size_t size)
{
    return static_cast<std::size_t>(
        std::floor(percentile * static_cast<double>(size - 1))
    );
}

}

namespace burstpick {

ExposureMetrics analyze_exposure(std::span<const std::uint8_t> grayscale)
{
    require_non_empty(grayscale);

    std::uint64_t sum = 0;
    std::size_t shadow_count = 0;
    std::size_t highlight_count = 0;

    for (const std::uint8_t value : grayscale) {
        sum += value;

        if (value <= shadow_threshold) {
            ++shadow_count;
        }

        if (value >= highlight_threshold) {
            ++highlight_count;
        }
    }

    const double total = static_cast<double>(grayscale.size());

    return ExposureMetrics{
        static_cast<double>(sum) / total,
        static_cast<double>(shadow_count) / total,
        static_cast<double>(highlight_count) / total
    };
}

double percentile_contrast(std::span<const std::uint8_t> grayscale)
{
    require_non_empty(grayscale);

    std::vector<std::uint8_t> sorted{grayscale.begin(), grayscale.end()};
    std::sort(sorted.begin(), sorted.end());

    // Nearest-rank-style zero-based policy: floor(percentile * (size - 1)).
    const std::size_t p10_index = percentile_index(0.10, sorted.size());
    const std::size_t p90_index = percentile_index(0.90, sorted.size());

    return static_cast<double>(sorted[p90_index]) -
        static_cast<double>(sorted[p10_index]);
}

}
