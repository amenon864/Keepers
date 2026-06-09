import type {
    AnalysisStateByPhotoId,
    WorkflowPhoto
} from "../features/photos/types";
import { SelectedPhotoCard } from "./SelectedPhotoCard";

export function SelectedPhotoGrid({
    photos,
    analysisState,
    isRemoveDisabled,
    onRemove
}: {
    photos: readonly WorkflowPhoto[];
    analysisState: AnalysisStateByPhotoId;
    isRemoveDisabled: boolean;
    onRemove: (photoId: number) => void;
}) {
    return (
        <div className="photo-grid" aria-label="Selected photos">
            {photos.map((photo) => (
                <SelectedPhotoCard
                    key={photo.id}
                    photo={photo}
                    status={analysisState[photo.id]}
                    isRemoveDisabled={isRemoveDisabled}
                    onRemove={onRemove}
                />
            ))}
        </div>
    );
}
