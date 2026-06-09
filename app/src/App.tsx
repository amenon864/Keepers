import "./App.css";
import { ExcludedPhotosNotice } from "./components/ExcludedPhotosNotice";
import { PhotoDropzone } from "./components/PhotoDropzone";
import { PhotoGroups } from "./components/PhotoGroups";
import { SelectedPhotoGrid } from "./components/SelectedPhotoGrid";
import {
    WorkflowActions,
    WorkflowErrors,
    WorkflowSteps
} from "./components/WorkflowStatus";
import { usePhotoWorkflow } from "./features/photos/usePhotoWorkflow";

function App() {
    const workflow = usePhotoWorkflow();

    return (
        <main className="app">
            <section className="intro" aria-labelledby="app-title">
                <h1 id="app-title">Keepers</h1>
                <p>Find the best shots from a burst of similar photos.</p>
            </section>

            <section className="workspace" aria-label="Photo selection">
                <PhotoDropzone
                    disabled={false}
                    remainingSlots={workflow.remainingSlots}
                    onFilesSelected={(files) => {
                        void workflow.addFiles(files);
                    }}
                />

                <WorkflowActions
                    photoCount={workflow.photos.length}
                    rejectedCount={workflow.rejectedFiles.length}
                    analyzedCount={workflow.analyzedCount}
                    failedAnalysisCount={workflow.failedAnalysisCount}
                    isDecoding={workflow.isDecoding}
                    isAnalyzing={workflow.isAnalyzing}
                    isGrouping={workflow.isGrouping}
                    isRanking={workflow.isRanking}
                    canAnalyze={workflow.canAnalyze}
                    canRerun={workflow.canRerun}
                    isBusy={workflow.isBusy}
                    hasCurrentRecommendations={
                        workflow.hasCurrentRecommendations
                    }
                    decodeProgress={workflow.decodeProgress}
                    analysisProgress={workflow.analysisProgress}
                    rankingProgress={workflow.rankingProgress}
                    onAnalyze={() => {
                        void workflow.analyze();
                    }}
                    onRerun={() => {
                        void workflow.rerun();
                    }}
                    onStop={workflow.stop}
                    onClearAll={workflow.clearAll}
                />

                <WorkflowSteps steps={workflow.workflowSteps} />

                <p className="privacy-note">
                    Photos stay on this device and are processed locally in
                    your browser.
                </p>

                <WorkflowErrors
                    analysisError={workflow.analysisError}
                    groupingError={workflow.groupingError}
                    rejectedFiles={workflow.rejectedFiles}
                    decodeErrors={workflow.decodeErrors}
                />

                <ExcludedPhotosNotice
                    analysisState={workflow.analysisState}
                    photos={workflow.photos}
                />

                {workflow.photos.length > 0 && workflow.groups.length === 0 ? (
                    <SelectedPhotoGrid
                        photos={workflow.photos}
                        analysisState={workflow.analysisState}
                        isRemoveDisabled={workflow.isBusy}
                        onRemove={workflow.removePhoto}
                    />
                ) : null}

                {workflow.groups.length > 0 ? (
                    <PhotoGroups
                        groups={workflow.groups}
                        photos={workflow.photos}
                        analysisState={workflow.analysisState}
                        isRemoveDisabled={workflow.isBusy}
                        onRemove={workflow.removePhoto}
                    />
                ) : null}

                {workflow.photos.length === 0 ? (
                    <p className="empty-state">
                        Select a few local images to decode them in your
                        browser.
                    </p>
                ) : null}
            </section>
        </main>
    );
}

export default App;
