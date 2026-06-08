import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { defaultSimilarityMaximumHammingDistance } from "./pipeline/constants";
import { decodePhotoFile } from "./photos/decodePhoto";
import {
    SessionPhotoIdAllocator,
    maximumPhotoCount,
    validatePhotoFiles
} from "./photos/photoValidation";
import type { DecodedPhoto, RejectedFile } from "./photos/types";
import { AnalysisWorkerClient } from "./workers/AnalysisWorkerClient";
import type {
    PhotoAnalysis,
    PhotoMetrics,
    PhotoQualityScore,
    SimilarityGroup
} from "./wasm/types";

interface DecodeProgress {
    completed: number;
    total: number;
}

interface DecodeError {
    id: number;
    name: string;
    message: string;
}

type PhotoAnalysisStatus =
    | { state: "idle" }
    | { state: "analyzing" }
    | { state: "analyzed"; analysis: PhotoAnalysis }
    | { state: "failed"; message: string };

interface AnalysisProgress {
    completed: number;
    total: number;
}

type AnalysisStateByPhotoId = Record<number, PhotoAnalysisStatus>;

type GroupingStatus = "idle" | "grouping" | "grouped" | "failed";

interface RankingProgress {
    completed: number;
    total: number;
}

interface GroupRanking {
    scores: PhotoQualityScore[];
    error?: string;
}

type GroupRankingsByIndex = Record<number, GroupRanking>;

interface AnalyzePhotosOptions {
    forceReanalyze?: boolean;
}

function App() {
    const inputRef = useRef<HTMLInputElement>(null);
    const idAllocatorRef = useRef(new SessionPhotoIdAllocator());
    const photosRef = useRef<DecodedPhoto[]>([]);
    const analysisWorkerRef = useRef<AnalysisWorkerClient | undefined>(
        undefined
    );
    const analysisRunIdRef = useRef(0);
    const [photos, setPhotos] = useState<DecodedPhoto[]>([]);
    const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([]);
    const [decodeErrors, setDecodeErrors] = useState<DecodeError[]>([]);
    const [decodeProgress, setDecodeProgress] = useState<DecodeProgress>({
        completed: 0,
        total: 0
    });
    const [isDragging, setIsDragging] = useState(false);
    const [analysisState, setAnalysisState] = useState<AnalysisStateByPhotoId>(
        {}
    );
    const [analysisProgress, setAnalysisProgress] =
        useState<AnalysisProgress>({
            completed: 0,
            total: 0
        });
    const [analysisError, setAnalysisError] = useState<string | undefined>(
        undefined
    );
    const [similarityGroups, setSimilarityGroups] = useState<SimilarityGroup[]>(
        []
    );
    const [groupingStatus, setGroupingStatus] =
        useState<GroupingStatus>("idle");
    const [groupingError, setGroupingError] = useState<string | undefined>(
        undefined
    );
    const [rankingProgress, setRankingProgress] = useState<RankingProgress>({
        completed: 0,
        total: 0
    });
    const [groupRankings, setGroupRankings] = useState<GroupRankingsByIndex>(
        {}
    );

    useEffect(() => {
        photosRef.current = photos;
    }, [photos]);

    useEffect(() => {
        const preventFileDropNavigation = (event: DragEvent) => {
            if (event.dataTransfer?.types.includes("Files")) {
                event.preventDefault();
            }
        };

        window.addEventListener("dragover", preventFileDropNavigation);
        window.addEventListener("drop", preventFileDropNavigation);

        return () => {
            window.removeEventListener("dragover", preventFileDropNavigation);
            window.removeEventListener("drop", preventFileDropNavigation);

            for (const photo of photosRef.current) {
                URL.revokeObjectURL(photo.previewUrl);
            }

            analysisWorkerRef.current?.terminate();
        };
    }, []);

    const isDecoding = decodeProgress.completed < decodeProgress.total;
    const isAnalyzing = analysisProgress.completed < analysisProgress.total;
    const isGrouping = groupingStatus === "grouping";
    const isRanking = rankingProgress.completed < rankingProgress.total;
    const isPipelineBusy = isAnalyzing || isGrouping || isRanking;
    const analyzedCount = useMemo(
        () =>
            Object.values(analysisState).filter(
                (status) => status.state === "analyzed"
            ).length,
        [analysisState]
    );
    const failedAnalysisCount = useMemo(
        () =>
            Object.values(analysisState).filter(
                (status) => status.state === "failed"
            ).length,
        [analysisState]
    );
    const hasCurrentRecommendations = useMemo(
        () =>
            photos.length > 0 &&
            failedAnalysisCount === 0 &&
            similarityGroups.length > 0 &&
            similarityGroups.every(
                (_group, groupIndex) =>
                    groupRankings[groupIndex] !== undefined &&
                    groupRankings[groupIndex].error === undefined
            ),
        [failedAnalysisCount, groupRankings, photos.length, similarityGroups]
    );
    const remainingSlots = useMemo(
        () => Math.max(0, maximumPhotoCount - photos.length),
        [photos.length]
    );
    const workflowSteps = useMemo(
        () =>
            buildWorkflowSteps({
                photoCount: photos.length,
                isDecoding,
                analyzedCount,
                failedAnalysisCount,
                isAnalyzing,
                groupingStatus,
                isGrouping,
                isRanking,
                hasCurrentRecommendations
            }),
        [
            analyzedCount,
            failedAnalysisCount,
            groupingStatus,
            hasCurrentRecommendations,
            isAnalyzing,
            isDecoding,
            isGrouping,
            isRanking,
            photos.length
        ]
    );

    const cancelAnalysis = () => {
        analysisRunIdRef.current += 1;
        analysisWorkerRef.current?.terminate();
        analysisWorkerRef.current = undefined;
        setAnalysisProgress({ completed: 0, total: 0 });
        setAnalysisError(undefined);
        setAnalysisState({});
        setSimilarityGroups([]);
        setGroupingStatus("idle");
        setGroupingError(undefined);
        setRankingProgress({ completed: 0, total: 0 });
        setGroupRankings({});
    };

    const handleFiles = async (fileList: FileList | File[]) => {
        const incomingFiles = Array.from(fileList);
        const validation = validatePhotoFiles(
            incomingFiles,
            () => idAllocatorRef.current.allocate(),
            photosRef.current.length
        );

        setRejectedFiles(validation.rejected);
        setDecodeErrors([]);
        setDecodeProgress({
            completed: 0,
            total: validation.accepted.length
        });

        const decodedPhotos: DecodedPhoto[] = [];
        const errors: DecodeError[] = [];

        for (const acceptedPhoto of validation.accepted) {
            try {
                decodedPhotos.push(
                    await decodePhotoFile(acceptedPhoto.id, acceptedPhoto.file)
                );
            } catch (error) {
                errors.push({
                    id: acceptedPhoto.id,
                    name: acceptedPhoto.file.name,
                    message:
                        error instanceof Error
                            ? error.message
                            : "The image could not be decoded."
                });
            } finally {
                setDecodeProgress((progress) => ({
                    ...progress,
                    completed: progress.completed + 1
                }));
            }
        }

        if (decodedPhotos.length > 0) {
            cancelAnalysis();
            setPhotos((currentPhotos) => [...currentPhotos, ...decodedPhotos]);
        }

        setDecodeErrors(errors);
    };

    const openFilePicker = () => {
        inputRef.current?.click();
    };

    const removePhoto = (photoId: number) => {
        cancelAnalysis();
        setPhotos((currentPhotos) => {
            const photoToRemove = currentPhotos.find(
                (photo) => photo.id === photoId
            );

            if (photoToRemove !== undefined) {
                URL.revokeObjectURL(photoToRemove.previewUrl);
            }

            return currentPhotos.filter((photo) => photo.id !== photoId);
        });
    };

    const clearPhotos = () => {
        cancelAnalysis();
        for (const photo of photosRef.current) {
            URL.revokeObjectURL(photo.previewUrl);
        }

        setPhotos([]);
        setRejectedFiles([]);
        setDecodeErrors([]);
        setDecodeProgress({ completed: 0, total: 0 });
    };

    const analyzePhotos = async (options: AnalyzePhotosOptions = {}) => {
        if (photosRef.current.length === 0 || isPipelineBusy) {
            return;
        }

        if (!options.forceReanalyze && hasCurrentRecommendations) {
            return;
        }

        const selectedPhotos = [...photosRef.current];
        const runId = analysisRunIdRef.current + 1;
        analysisRunIdRef.current = runId;
        analysisWorkerRef.current?.terminate();
        const workerClient = new AnalysisWorkerClient();
        analysisWorkerRef.current = workerClient;
        const analysisResults = new Map<number, PhotoAnalysis>();
        const photosToAnalyze: DecodedPhoto[] = [];
        const initialAnalysisState: AnalysisStateByPhotoId = {};

        for (const photo of selectedPhotos) {
            const existingStatus = analysisState[photo.id];

            if (
                !options.forceReanalyze &&
                existingStatus?.state === "analyzed"
            ) {
                initialAnalysisState[photo.id] = existingStatus;
                analysisResults.set(photo.id, existingStatus.analysis);
            } else {
                initialAnalysisState[photo.id] = { state: "idle" };
                photosToAnalyze.push(photo);
            }
        }

        setAnalysisError(undefined);
        setGroupingError(undefined);
        setGroupingStatus("idle");
        setSimilarityGroups([]);
        setRankingProgress({ completed: 0, total: 0 });
        setGroupRankings({});
        setAnalysisProgress({
            completed: 0,
            total: photosToAnalyze.length
        });
        setAnalysisState(initialAnalysisState);

        for (const photo of photosToAnalyze) {
            if (analysisRunIdRef.current !== runId) {
                return;
            }

            setAnalysisState((currentState) => ({
                ...currentState,
                [photo.id]: { state: "analyzing" }
            }));

            try {
                const analysis = await analyzePhotoWithFreshPixels(
                    workerClient,
                    photo
                );

                if (analysisRunIdRef.current !== runId) {
                    return;
                }

                analysisResults.set(photo.id, analysis);
                setAnalysisState((currentState) => ({
                    ...currentState,
                    [photo.id]: { state: "analyzed", analysis }
                }));
            } catch (error) {
                if (analysisRunIdRef.current !== runId) {
                    return;
                }

                setAnalysisState((currentState) => ({
                    ...currentState,
                    [photo.id]: {
                        state: "failed",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Photo analysis failed."
                    }
                }));
            } finally {
                if (analysisRunIdRef.current === runId) {
                    setAnalysisProgress((progress) => ({
                        ...progress,
                        completed: progress.completed + 1
                    }));
                }
            }
        }

        if (analysisRunIdRef.current !== runId) {
            return;
        }

        if (analysisResults.size > 0) {
            setGroupingStatus("grouping");

            try {
                const groups = await workerClient.groupPhotos(
                    Array.from(analysisResults.values()).map((analysis) => ({
                        id: analysis.id,
                        hash: analysis.differenceHash
                    })),
                    defaultSimilarityMaximumHammingDistance
                );
                validateSimilarityGroups(groups, analysisResults);

                if (analysisRunIdRef.current !== runId) {
                    return;
                }

                setSimilarityGroups(groups);
                setGroupingStatus("grouped");
                setRankingProgress({ completed: 0, total: groups.length });

                for (const [groupIndex, group] of groups.entries()) {
                    if (analysisRunIdRef.current !== runId) {
                        return;
                    }

                    try {
                        const scores = await workerClient.rankPhotos(
                            group.map((photoId) =>
                                analysisToMetrics(
                                    getAnalysisResult(
                                        analysisResults,
                                        photoId
                                    )
                                )
                            )
                        );
                        validateQualityScores(scores, group);

                        if (analysisRunIdRef.current !== runId) {
                            return;
                        }

                        setGroupRankings((currentRankings) => ({
                            ...currentRankings,
                            [groupIndex]: { scores }
                        }));
                    } catch (error) {
                        if (analysisRunIdRef.current !== runId) {
                            return;
                        }

                        setGroupRankings((currentRankings) => ({
                            ...currentRankings,
                            [groupIndex]: {
                                scores: [],
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : "Photo ranking failed."
                            }
                        }));
                    } finally {
                        if (analysisRunIdRef.current === runId) {
                            setRankingProgress((progress) => ({
                                ...progress,
                                completed: progress.completed + 1
                            }));
                        }
                    }
                }
            } catch (error) {
                if (analysisRunIdRef.current !== runId) {
                    return;
                }

                setGroupingStatus("failed");
                setGroupingError(
                    error instanceof Error
                        ? error.message
                        : "Similarity grouping failed."
                );
            }
        }

        if (analysisRunIdRef.current === runId) {
            workerClient.terminate();
            analysisWorkerRef.current = undefined;
        }
    };

    return (
        <main className="app">
            <section className="intro" aria-labelledby="app-title">
                <h1 id="app-title">Keepers</h1>
                <p>Find the best shots from a burst of similar photos.</p>
            </section>

            <section className="workspace" aria-label="Photo selection">
                <div
                    className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={openFilePicker}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openFilePicker();
                        }
                    }}
                    onDragEnter={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                    }}
                    onDragLeave={(event) => {
                        if (event.currentTarget === event.target) {
                            setIsDragging(false);
                        }
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        setIsDragging(false);
                        void handleFiles(event.dataTransfer.files);
                    }}
                >
                    <input
                        ref={inputRef}
                        className="file-input"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(event) => {
                            if (event.currentTarget.files !== null) {
                                void handleFiles(event.currentTarget.files);
                            }

                            event.currentTarget.value = "";
                        }}
                    />
                    <span className="upload-eyebrow">Local photos</span>
                    <strong>Drop images here or choose files</strong>
                    <span>
                        Up to {remainingSlots} more photos, {maximumPhotoCount}{" "}
                        total.
                    </span>
                </div>

                <div className="summary-row" aria-live="polite">
                    <span>
                        {photos.length} selected photo
                        {photos.length === 1 ? "" : "s"}
                    </span>
                    <span>
                        {analyzedCount} analyzed of {photos.length}
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
                    {groupingStatus === "grouping" ? (
                        <span>Grouping similar photos</span>
                    ) : null}
                    {isRanking ? (
                        <span>
                            Ranking group {rankingProgress.completed + 1} of{" "}
                            {rankingProgress.total}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        className="primary-action"
                        onClick={() => {
                            void analyzePhotos();
                        }}
                        disabled={
                            photos.length === 0 ||
                            isDecoding ||
                            isPipelineBusy ||
                            hasCurrentRecommendations
                        }
                    >
                        {primaryActionLabel(
                            failedAnalysisCount,
                            hasCurrentRecommendations
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void analyzePhotos({ forceReanalyze: true });
                        }}
                        disabled={
                            photos.length === 0 || isDecoding || isPipelineBusy
                        }
                    >
                        Rerun full pipeline
                    </button>
                    {isPipelineBusy ? (
                        <button type="button" onClick={cancelAnalysis}>
                            Stop
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={clearPhotos}
                        disabled={photos.length === 0 && rejectedFiles.length === 0}
                    >
                        Clear all
                    </button>
                </div>

                <WorkflowStatus steps={workflowSteps} />

                <p className="privacy-note">
                    Photos stay on this device and are processed locally in
                    your browser.
                </p>

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
                                    <strong>{error.name}</strong>:{" "}
                                    {error.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <ExcludedPhotosNotice
                    analysisState={analysisState}
                    photos={photos}
                />

                {photos.length > 0 && similarityGroups.length === 0 ? (
                    <div className="photo-grid" aria-label="Selected photos">
                        {photos.map((photo) => (
                            <PhotoCard
                                key={photo.id}
                                photo={photo}
                                status={analysisState[photo.id]}
                                isRemoveDisabled={isPipelineBusy}
                                onRemove={removePhoto}
                            />
                        ))}
                    </div>
                ) : null}

                {similarityGroups.length > 0 ? (
                    <div className="group-list">
                        {similarityGroups.map((group, groupIndex) => (
                            <section
                                className="similarity-group"
                                key={group.join("-")}
                                aria-labelledby={`group-${groupIndex}`}
                            >
                                <div className="group-heading">
                                    <h2 id={`group-${groupIndex}`}>
                                        Group {groupIndex + 1}
                                    </h2>
                                    <span>
                                        {group.length} photo
                                        {group.length === 1 ? "" : "s"}
                                    </span>
                                </div>
                                <RankingError
                                    ranking={groupRankings[groupIndex]}
                                />
                                <p className="score-note">
                                    Scores are relative within this similarity
                                    group.
                                </p>
                                <div className="photo-grid">
                                    {orderedGroupPhotoIds(
                                        group,
                                        groupRankings[groupIndex]
                                    ).map((photoId) => {
                                        const photo = photos.find(
                                            (candidate) =>
                                                candidate.id === photoId
                                        );

                                        if (photo === undefined) {
                                            return null;
                                        }

                                        return (
                                            <PhotoCard
                                                key={photo.id}
                                                photo={photo}
                                                status={
                                                    analysisState[photo.id]
                                                }
                                                qualityScore={scoreForPhoto(
                                                    groupRankings[groupIndex],
                                                    photo.id
                                                )}
                                                isRecommended={
                                                    groupRankings[groupIndex]
                                                        ?.scores[0]?.id ===
                                                    photo.id
                                                }
                                                isRemoveDisabled={
                                                    isPipelineBusy
                                                }
                                                onRemove={removePhoto}
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : null}

                {photos.length === 0 ? (
                    <p className="empty-state">
                        Select a few local images to decode them in your
                        browser.
                    </p>
                ) : (
                    null
                )}
            </section>
        </main>
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

interface WorkflowStep {
    label: string;
    status: "pending" | "active" | "complete" | "failed";
}

function WorkflowStatus({ steps }: { steps: readonly WorkflowStep[] }) {
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

function buildWorkflowSteps({
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

function PhotoCard({
    photo,
    status,
    qualityScore,
    isRecommended = false,
    isRemoveDisabled,
    onRemove
}: {
    photo: DecodedPhoto;
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

function RankingError({ ranking }: { ranking: GroupRanking | undefined }) {
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

function ExcludedPhotosNotice({
    analysisState,
    photos
}: {
    analysisState: AnalysisStateByPhotoId;
    photos: readonly DecodedPhoto[];
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

async function analyzePhotoWithFreshPixels(
    workerClient: AnalysisWorkerClient,
    photo: DecodedPhoto
): Promise<PhotoAnalysis> {
    if (photo.pixels.byteLength > 0) {
        return workerClient.analyzePhoto(photo);
    }

    const decodedPhoto = await decodePhotoFile(photo.id, photo.file);
    URL.revokeObjectURL(decodedPhoto.previewUrl);
    return workerClient.analyzePhoto({
        ...photo,
        pixels: decodedPhoto.pixels
    });
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

function formatMetric(value: number): string {
    return value.toLocaleString(undefined, {
        maximumFractionDigits: 1
    });
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

function formatPercentage(value: number): string {
    return `${Math.round(clamp01(value) * 100)}%`;
}

function qualityExplanation(score: PhotoQualityScore): string {
    const clippingPenaltyLikely = score.exposureScore < 0.55;

    if (clippingPenaltyLikely) {
        return "Heavy clipping or exposure imbalance reduced its score.";
    }

    if (
        score.normalizedSharpness >= score.exposureScore &&
        score.normalizedSharpness >= score.normalizedContrast
    ) {
        return "Sharper than alternatives.";
    }

    if (score.exposureScore >= score.normalizedContrast) {
        return "Better-balanced exposure.";
    }

    return "Stronger contrast.";
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value));
}

function orderedGroupPhotoIds(
    group: readonly number[],
    ranking: GroupRanking | undefined
): number[] {
    if (ranking === undefined || ranking.scores.length === 0) {
        return [...group];
    }

    return ranking.scores.map((score) => score.id);
}

function scoreForPhoto(
    ranking: GroupRanking | undefined,
    photoId: number
): PhotoQualityScore | undefined {
    return ranking?.scores.find((score) => score.id === photoId);
}

function analysisToMetrics(analysis: PhotoAnalysis): PhotoMetrics {
    return {
        id: analysis.id,
        sharpness: analysis.sharpness,
        meanLuminance: analysis.meanLuminance,
        shadowClippingRatio: analysis.shadowClippingRatio,
        highlightClippingRatio: analysis.highlightClippingRatio,
        contrast: analysis.contrast
    };
}

function getAnalysisResult(
    analysisResults: ReadonlyMap<number, PhotoAnalysis>,
    photoId: number
): PhotoAnalysis {
    const analysis = analysisResults.get(photoId);

    if (analysis === undefined) {
        throw new Error("Ranking could not find an analyzed photo.");
    }

    return analysis;
}

function validateSimilarityGroups(
    groups: readonly SimilarityGroup[],
    analysisResults: ReadonlyMap<number, PhotoAnalysis>
): void {
    const seenPhotoIds = new Set<number>();

    for (const group of groups) {
        for (const photoId of group) {
            if (!analysisResults.has(photoId)) {
                throw new Error(
                    "Similarity grouping returned an unknown photo."
                );
            }

            if (seenPhotoIds.has(photoId)) {
                throw new Error(
                    "Similarity grouping returned a photo more than once."
                );
            }

            seenPhotoIds.add(photoId);
        }
    }

    if (seenPhotoIds.size !== analysisResults.size) {
        throw new Error(
            "Similarity grouping did not include every analyzed photo."
        );
    }
}

function validateQualityScores(
    scores: readonly PhotoQualityScore[],
    group: readonly number[]
): void {
    const expectedPhotoIds = new Set(group);
    const seenPhotoIds = new Set<number>();

    for (const score of scores) {
        if (!expectedPhotoIds.has(score.id)) {
            throw new Error("Ranking returned an unknown photo.");
        }

        if (seenPhotoIds.has(score.id)) {
            throw new Error("Ranking returned a photo more than once.");
        }

        for (const value of [
            score.normalizedSharpness,
            score.exposureScore,
            score.normalizedContrast,
            score.overallScore
        ]) {
            if (!Number.isFinite(value)) {
                throw new Error("Ranking returned a non-finite score.");
            }
        }

        seenPhotoIds.add(score.id);
    }

    if (seenPhotoIds.size !== expectedPhotoIds.size) {
        throw new Error("Ranking did not include every photo in the group.");
    }
}

export default App;
