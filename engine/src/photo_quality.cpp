#include <keepers/photo_quality.hpp>

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>

namespace {

constexpr double minimum_luminance = 0.0;
constexpr double maximum_luminance = 255.0;
constexpr double target_luminance = 128.0;
constexpr double brightness_penalty_weight = 0.40;
constexpr double shadow_clipping_weight = 0.30;
constexpr double highlight_clipping_weight = 0.30;

constexpr double sharpness_weight = 0.65;
constexpr double exposure_weight = 0.20;
constexpr double contrast_weight = 0.15;

constexpr double severe_highlight_clipping_threshold = 0.25;
constexpr double severe_shadow_clipping_threshold = 0.40;
constexpr double severe_clipping_multiplier = 0.75;

struct RankedPhotoData {
    keepers::PhotoQualityScore score;
    double total_clipping_ratio;
};

double clamp_score(double value)
{
    return std::clamp(value, 0.0, 1.0);
}

void require_finite(double value, const char* metric_name)
{
    if (!std::isfinite(value)) {
        throw std::invalid_argument{metric_name};
    }
}

void validate_metric(const keepers::PhotoMetrics& photo)
{
    require_finite(photo.sharpness, "sharpness must be finite");
    require_finite(photo.mean_luminance, "mean luminance must be finite");
    require_finite(
        photo.shadow_clipping_ratio,
        "shadow clipping ratio must be finite"
    );
    require_finite(
        photo.highlight_clipping_ratio,
        "highlight clipping ratio must be finite"
    );
    require_finite(photo.contrast, "contrast must be finite");

    if (photo.sharpness < 0.0) {
        throw std::invalid_argument{"sharpness must be non-negative"};
    }

    if (
        photo.mean_luminance < minimum_luminance ||
        photo.mean_luminance > maximum_luminance
    ) {
        throw std::invalid_argument{"mean luminance must be in range 0 to 255"};
    }

    if (
        photo.shadow_clipping_ratio < 0.0 ||
        photo.shadow_clipping_ratio > 1.0
    ) {
        throw std::invalid_argument{
            "shadow clipping ratio must be in range 0 to 1"
        };
    }

    if (
        photo.highlight_clipping_ratio < 0.0 ||
        photo.highlight_clipping_ratio > 1.0
    ) {
        throw std::invalid_argument{
            "highlight clipping ratio must be in range 0 to 1"
        };
    }

    if (photo.contrast < 0.0) {
        throw std::invalid_argument{"contrast must be non-negative"};
    }
}

void validate_photos(std::span<const keepers::PhotoMetrics> photos)
{
    for (std::size_t index = 0; index < photos.size(); ++index) {
        validate_metric(photos[index]);

        for (std::size_t other = index + 1; other < photos.size(); ++other) {
            if (photos[index].id == photos[other].id) {
                throw std::invalid_argument{"photo IDs must be unique"};
            }
        }
    }
}

double normalize(double value, double minimum, double maximum)
{
    if (minimum == maximum) {
        return 0.5;
    }

    return clamp_score((value - minimum) / (maximum - minimum));
}

double exposure_score(const keepers::PhotoMetrics& photo)
{
    const double brightness_penalty =
        std::abs(photo.mean_luminance - target_luminance) / target_luminance;

    return clamp_score(
        1.0 -
        brightness_penalty_weight * brightness_penalty -
        shadow_clipping_weight * photo.shadow_clipping_ratio -
        highlight_clipping_weight * photo.highlight_clipping_ratio
    );
}

double overall_score(const keepers::PhotoQualityScore& score)
{
    return clamp_score(
        sharpness_weight * score.normalized_sharpness +
        exposure_weight * score.exposure_score +
        contrast_weight * score.normalized_contrast
    );
}

double apply_severe_clipping_penalties(
    double score,
    const keepers::PhotoMetrics& photo
)
{
    if (photo.highlight_clipping_ratio > severe_highlight_clipping_threshold) {
        score *= severe_clipping_multiplier;
    }

    if (photo.shadow_clipping_ratio > severe_shadow_clipping_threshold) {
        score *= severe_clipping_multiplier;
    }

    return clamp_score(score);
}

bool stronger_photo(const RankedPhotoData& left, const RankedPhotoData& right)
{
    if (left.score.overall_score != right.score.overall_score) {
        return left.score.overall_score > right.score.overall_score;
    }

    if (
        left.score.normalized_sharpness !=
        right.score.normalized_sharpness
    ) {
        return
            left.score.normalized_sharpness >
            right.score.normalized_sharpness;
    }

    if (left.total_clipping_ratio != right.total_clipping_ratio) {
        return left.total_clipping_ratio < right.total_clipping_ratio;
    }

    return left.score.id < right.score.id;
}

}

namespace keepers {

std::vector<PhotoQualityScore> rank_photo_quality(
    std::span<const PhotoMetrics> photos
)
{
    validate_photos(photos);

    if (photos.empty()) {
        return {};
    }

    auto sharpness_range = std::minmax_element(
        photos.begin(),
        photos.end(),
        [](const PhotoMetrics& left, const PhotoMetrics& right) {
            return left.sharpness < right.sharpness;
        }
    );
    auto contrast_range = std::minmax_element(
        photos.begin(),
        photos.end(),
        [](const PhotoMetrics& left, const PhotoMetrics& right) {
            return left.contrast < right.contrast;
        }
    );

    std::vector<RankedPhotoData> ranked;
    ranked.reserve(photos.size());

    for (const PhotoMetrics& photo : photos) {
        PhotoQualityScore score{
            photo.id,
            normalize(
                photo.sharpness,
                sharpness_range.first->sharpness,
                sharpness_range.second->sharpness
            ),
            exposure_score(photo),
            normalize(
                photo.contrast,
                contrast_range.first->contrast,
                contrast_range.second->contrast
            ),
            0.0
        };

        score.overall_score =
            apply_severe_clipping_penalties(overall_score(score), photo);

        ranked.push_back(
            RankedPhotoData{
                score,
                photo.shadow_clipping_ratio + photo.highlight_clipping_ratio
            }
        );
    }

    std::sort(ranked.begin(), ranked.end(), stronger_photo);

    std::vector<PhotoQualityScore> scores;
    scores.reserve(ranked.size());

    for (const RankedPhotoData& photo : ranked) {
        scores.push_back(photo.score);
    }

    return scores;
}

}
