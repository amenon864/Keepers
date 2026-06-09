import type {
    DecodeError,
    FileRejection,
    WorkflowProgress,
    WorkflowStep
} from "../features/photos/types";

export function WorkflowActions({
    photoCount,
    rejectedCount,
    analyzedCount,
    failedAnalysisCount,
    isDecoding,
    isAnalyzing,
    isGrouping,
    isRanking,
    canAnalyze,
    canRerun,
    isBusy,
    hasCurrentRecommendations,
    decodeProgress,
    analysisProgress,
    rankingProgress,
    onAnalyze,
    onRerun,
    onStop,
    onClearAll
}: {
    photoCount: number;
    rejectedCount: number;
    analyzedCount: number;
    failedAnalysisCount: number;
    isDecoding: boolean;
    isAnalyzing: boolean;
    isGrouping: boolean;
    isRanking: boolean;
    canAnalyze: boolean;
    canRerun: boolean;
    isBusy: boolean;
    hasCurrentRecommendations: boolean;
    decodeProgress: WorkflowProgress;
    analysisProgress: WorkflowProgress;
    rankingProgress: WorkflowProgress;
    onAnalyze: () => void;
    onRerun: () => void;
    onStop: () => void;
    onClearAll: () => void;
}) {
    return (
        <div className="summary-row" aria-live="polite">
            <span>
                {photoCount} selected photo{photoCount === 1 ? "" : "s"}
            </span>
            <span>
                {analyzedCount} analyzed of {photoCount}
            </span>
            {isDecoding ? (
                <span>
                    Decoding {decodeProgress.completed} of{" "}
                    {decodeProgress.total}
                </span>
            ) : null}
            {isAnalyzing ? (
                <span>
                    Analyzing {analysisProgress.completed + 1} of{" "}
                    {analysisProgress.total}
                </span>
            ) : null}
            {isGrouping ? <span>Grouping similar photos</span> : null}
            {isRanking ? (
                <span>
                    Ranking group {rankingProgress.completed + 1} of{" "}
                    {rankingProgress.total}
                </span>
            ) : null}
            <button
                type="button"
                className="primary-action"
                onClick={onAnalyze}
                disabled={!canAnalyze}
            >
                {primaryActionLabel(
                    failedAnalysisCount,
                    hasCurrentRecommendations
                )}
            </button>
            <button type="button" onClick={onRerun} disabled={!canRerun}>
                Rerun full pipeline
            </button>
            {isBusy ? (
                <button type="button" onClick={onStop}>
                    Stop
                </button>
            ) : null}
            <button
                type="button"
                onClick={onClearAll}
                disabled={photoCount === 0 && rejectedCount === 0}
            >
                Clear all
            </button>
        </div>
    );
}

export function WorkflowSteps({ steps }: { steps: readonly WorkflowStep[] }) {
    return (
        <ol className="workflow-steps" role="status" aria-live="polite">
            {steps.map((step) => (
                <li className={`workflow-step ${step.status}`} key={step.label}>
                    <span>{step.label}</span>
                    <strong>{workflowStatusLabel(step.status)}</strong>
                </li>
            ))}
        </ol>
    );
}

export function WorkflowErrors({
    analysisError,
    groupingError,
    rejectedFiles,
    decodeErrors
}: {
    analysisError?: string;
    groupingError?: string;
    rejectedFiles: readonly FileRejection[];
    decodeErrors: readonly DecodeError[];
}) {
    return (
        <>
            {analysisError !== undefined ? (
                <div className="notice error" role="alert">
                    <h2>Analysis error</h2>
                    <p>{analysisError}</p>
                </div>
            ) : null}

            {groupingError !== undefined ? (
                <div className="notice error" role="alert">
                    <h2>Grouping error</h2>
                    <p>{groupingError}</p>
                </div>
            ) : null}

            {rejectedFiles.length > 0 ? (
                <div className="notice error" role="alert">
                    <h2>Unsupported files</h2>
                    <ul>
                        {rejectedFiles.map((file) => (
                            <li key={`${file.name}-${file.reason}`}>
                                <strong>{file.name}</strong>: {file.reason}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {decodeErrors.length > 0 ? (
                <div className="notice error" role="alert">
                    <h2>Decoding errors</h2>
                    <ul>
                        {decodeErrors.map((error) => (
                            <li key={error.id}>
                                <strong>{error.name}</strong>: {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </>
    );
}

function primaryActionLabel(
    failedAnalysisCount: number,
    hasCurrentRecommendations: boolean
): string {
    if (hasCurrentRecommendations) {
        return "Recommendations ready";
    }

    if (failedAnalysisCount > 0) {
        return "Retry failed analysis";
    }

    return "Analyze photos";
}

function workflowStatusLabel(status: WorkflowStep["status"]): string {
    switch (status) {
        case "active":
            return "In progress";
        case "complete":
            return "Complete";
        case "failed":
            return "Needs retry";
        case "pending":
            return "Pending";
    }
}
