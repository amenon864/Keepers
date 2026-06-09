import type { GroupingStatus, WorkflowStep } from "./types";

export function buildWorkflowSteps({
    photoCount,
    isDecoding,
    analyzedCount,
    failedAnalysisCount,
    isAnalyzing,
    groupingStatus,
    isGrouping,
    isRanking,
    hasCurrentRecommendations
}: {
    photoCount: number;
    isDecoding: boolean;
    analyzedCount: number;
    failedAnalysisCount: number;
    isAnalyzing: boolean;
    groupingStatus: GroupingStatus;
    isGrouping: boolean;
    isRanking: boolean;
    hasCurrentRecommendations: boolean;
}): WorkflowStep[] {
    return [
        {
            label: "Select photos",
            status: photoCount > 0 ? "complete" : "active"
        },
        {
            label: "Decode photos",
            status: isDecoding
                ? "active"
                : photoCount > 0
                  ? "complete"
                  : "pending"
        },
        {
            label: "Analyze locally",
            status: isAnalyzing
                ? "active"
                : failedAnalysisCount > 0
                  ? "failed"
                  : analyzedCount > 0
                    ? "complete"
                    : "pending"
        },
        {
            label: "Group similar shots",
            status: isGrouping
                ? "active"
                : groupingStatus === "failed"
                  ? "failed"
                  : groupingStatus === "grouped"
                    ? "complete"
                    : "pending"
        },
        {
            label: "Review recommendations",
            status: isRanking
                ? "active"
                : hasCurrentRecommendations
                  ? "complete"
                  : "pending"
        }
    ];
}
