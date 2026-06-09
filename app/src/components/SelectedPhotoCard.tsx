import type { PhotoQualityScore } from "../wasm/types";
import {
    formatPercentage,
    qualityExplanation
} from "../features/photos/qualityExplanations";
import type {
    PhotoAnalysisStatus,
    WorkflowPhoto
} from "../features/photos/types";

export function SelectedPhotoCard({
    photo,
    status,
    qualityScore,
    isRecommended = false,
    isRemoveDisabled,
    onRemove
}: {
    photo: WorkflowPhoto;
    status: PhotoAnalysisStatus | undefined;
    qualityScore?: PhotoQualityScore;
    isRecommended?: boolean;
    isRemoveDisabled: boolean;
    onRemove: (photoId: number) => void;
}) {
    return (
        <article
            className={`photo-card ${isRecommended ? "is-recommended" : ""}`}
        >
            <img src={photo.previewUrl} alt={photo.name} loading="lazy" />
            <div className="photo-details">
                <h2>{photo.name}</h2>
                <span>
                    {photo.width} x {photo.height}
                </span>
                <AnalysisStatusSummary status={status} />
                <QualityScoreSummary
                    score={qualityScore}
                    isRecommended={isRecommended}
                />
            </div>
            <button
                type="button"
                disabled={isRemoveDisabled}
                onClick={() => {
                    onRemove(photo.id);
                }}
            >
                Remove
            </button>
        </article>
    );
}

function AnalysisStatusSummary({
    status
}: {
    status: PhotoAnalysisStatus | undefined;
}) {
    if (status === undefined || status.state === "idle") {
        return <span className="status-text">Awaiting analysis</span>;
    }

    if (status.state === "analyzing") {
        return <span className="status-text">Analyzing locally</span>;
    }

    if (status.state === "failed") {
        return <span className="status-text error-text">{status.message}</span>;
    }

    return (
        <span className="status-text">
            Analyzed · sharpness {formatMetric(status.analysis.sharpness)}
        </span>
    );
}

function QualityScoreSummary({
    score,
    isRecommended
}: {
    score: PhotoQualityScore | undefined;
    isRecommended: boolean;
}) {
    if (score === undefined) {
        return null;
    }

    return (
        <div className="quality-summary">
            {isRecommended ? (
                <strong className="recommendation">Recommended</strong>
            ) : null}
            <span>Overall {formatPercentage(score.overallScore)}</span>
            <span>Sharpness {formatPercentage(score.normalizedSharpness)}</span>
            <span>Exposure {formatPercentage(score.exposureScore)}</span>
            <span>Contrast {formatPercentage(score.normalizedContrast)}</span>
            <span>{qualityExplanation(score)}</span>
        </div>
    );
}

function formatMetric(value: number): string {
    return value.toLocaleString(undefined, {
        maximumFractionDigits: 1
    });
}
