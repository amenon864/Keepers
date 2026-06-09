import type {
    AnalysisStateByPhotoId,
    RankedPhotoGroup,
    WorkflowPhoto
} from "../features/photos/types";
import { SelectedPhotoCard } from "./SelectedPhotoCard";

export function PhotoGroup({
    group,
    photosById,
    analysisState,
    isRemoveDisabled,
    onRemove
}: {
    group: RankedPhotoGroup;
    photosById: ReadonlyMap<number, WorkflowPhoto>;
    analysisState: AnalysisStateByPhotoId;
    isRemoveDisabled: boolean;
    onRemove: (photoId: number) => void;
}) {
    return (
        <section
            className="similarity-group"
            aria-labelledby={`group-${group.index}`}
        >
            <div className="group-heading">
                <h2 id={`group-${group.index}`}>Group {group.index + 1}</h2>
                <span>
                    {group.photoIds.length} photo
                    {group.photoIds.length === 1 ? "" : "s"}
                </span>
            </div>
            <RankingError ranking={group.ranking} />
            <p className="score-note">
                Scores are relative within this similarity group.
            </p>
            <div className="photo-grid">
                {orderedGroupPhotoIds(group).map((photoId) => {
                    const photo = photosById.get(photoId);

                    if (photo === undefined) {
                        return null;
                    }

                    return (
                        <SelectedPhotoCard
                            key={photo.id}
                            photo={photo}
                            status={analysisState[photo.id]}
                            qualityScore={scoreForPhoto(group, photo.id)}
                            isRecommended={
                                group.ranking?.scores[0]?.id === photo.id
                            }
                            isRemoveDisabled={isRemoveDisabled}
                            onRemove={onRemove}
                        />
                    );
                })}
            </div>
        </section>
    );
}

function RankingError({
    ranking
}: {
    ranking: RankedPhotoGroup["ranking"];
}) {
    if (ranking?.error === undefined) {
        return null;
    }

    return (
        <div className="notice error" role="alert">
            <h3>Ranking error</h3>
            <p>{ranking.error}</p>
        </div>
    );
}

function orderedGroupPhotoIds(group: RankedPhotoGroup): number[] {
    if (group.ranking === undefined || group.ranking.scores.length === 0) {
        return [...group.photoIds];
    }

    return group.ranking.scores.map((score) => score.id);
}

function scoreForPhoto(group: RankedPhotoGroup, photoId: number) {
    return group.ranking?.scores.find((score) => score.id === photoId);
}
