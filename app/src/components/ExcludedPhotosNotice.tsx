import type {
    AnalysisStateByPhotoId,
    WorkflowPhoto
} from "../features/photos/types";

export function ExcludedPhotosNotice({
    analysisState,
    photos
}: {
    analysisState: AnalysisStateByPhotoId;
    photos: readonly WorkflowPhoto[];
}) {
    const failedStatuses = Object.entries(analysisState).filter(
        ([, status]) => status.state === "failed"
    );

    if (failedStatuses.length === 0) {
        return null;
    }

    return (
        <div className="notice warning" role="status">
            <h2>Excluded from grouping</h2>
            <p>
                {failedStatuses.length} photo
                {failedStatuses.length === 1 ? "" : "s"} could not be analyzed
                and were not sent to similarity grouping.
            </p>
            <ul>
                {failedStatuses.map(([photoId, status]) => {
                    const photo = photos.find(
                        (candidate) => candidate.id === Number(photoId)
                    );

                    return (
                        <li key={photoId}>
                            <strong>{photo?.name ?? `Photo ${photoId}`}</strong>
                            :{" "}
                            {status.state === "failed"
                                ? status.message
                                : "Analysis failed."}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
