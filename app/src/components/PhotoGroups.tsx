import { useMemo } from "react";
import type {
    AnalysisStateByPhotoId,
    RankedPhotoGroup,
    WorkflowPhoto
} from "../features/photos/types";
import { PhotoGroup } from "./PhotoGroup";

export function PhotoGroups({
    groups,
    photos,
    analysisState,
    isRemoveDisabled,
    onRemove
}: {
    groups: readonly RankedPhotoGroup[];
    photos: readonly WorkflowPhoto[];
    analysisState: AnalysisStateByPhotoId;
    isRemoveDisabled: boolean;
    onRemove: (photoId: number) => void;
}) {
    const photosById = useMemo(
        () => new Map(photos.map((photo) => [photo.id, photo])),
        [photos]
    );

    return (
        <div className="group-list">
            {groups.map((group) => (
                <PhotoGroup
                    key={group.id}
                    group={group}
                    photosById={photosById}
                    analysisState={analysisState}
                    isRemoveDisabled={isRemoveDisabled}
                    onRemove={onRemove}
                />
            ))}
        </div>
    );
}
