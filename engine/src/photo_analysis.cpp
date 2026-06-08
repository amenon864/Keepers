#include <keepers/photo_analysis.hpp>

#include <keepers/difference_hash.hpp>
#include <keepers/grayscale.hpp>
#include <keepers/image_metrics.hpp>
#include <keepers/sharpness.hpp>

namespace keepers {

PhotoAnalysis analyze_photo(std::size_t id, const ImageView& image)
{
    const auto grayscale = to_grayscale(image);

    const double sharpness = laplacian_variance(
        grayscale,
        image.width(),
        image.height()
    );

    const auto exposure = analyze_exposure(grayscale);
    const double contrast = percentile_contrast(grayscale);
    const std::uint64_t hash = difference_hash(
        grayscale,
        image.width(),
        image.height()
    );

    return PhotoAnalysis{
        id,
        sharpness,
        exposure.mean_luminance,
        exposure.shadow_clipping_ratio,
        exposure.highlight_clipping_ratio,
        contrast,
        hash
    };
}

}
