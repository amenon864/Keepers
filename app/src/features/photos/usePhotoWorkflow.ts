import { useEffect, useMemo, useRef, useState } from "react";
import { defaultSimilarityMaximumHammingDistance } from "../../pipeline/constants";
import type {
    PhotoAnalysis,
    PhotoMetrics,
    PhotoQualityScore,
    SimilarityGroup
} from "../../wasm/types";
import { AnalysisWorkerClient } from "../../workers/AnalysisWorkerClient";
import { decodePhotoFile } from "./decodePhoto";
import {
    SessionPhotoIdAllocator,
    maximumPhotoCount,
    validatePhotoFiles
} from "./fileValidation";
import { revokePhotoUrl, revokePhotoUrls } from "./photoUrls";
import { buildWorkflowSteps } from "./workflowSteps";
import type {
    AnalysisStateByPhotoId,
    DecodedPhoto,
    DecodeError,
    FileRejection,
    GroupRankingsByIndex,
    RankedPhotoGroup,
    WorkflowPhase,
    WorkflowProgress,
    WorkflowStep
} from "./types";

interface AnalyzePhotosOptions {
    forceReanalyze?: boolean;
}

export interface PhotoWorkflow {
    photos: readonly DecodedPhoto[];
    groups: readonly RankedPhotoGroup[];
    rejectedFiles: readonly FileRejection[];
    decodeErrors: readonly DecodeError[];
    analysisState: AnalysisStateByPhotoId;
    phase: WorkflowPhase;
    decodeProgress: WorkflowProgress;
    analysisProgress: WorkflowProgress;
    rankingProgress: WorkflowProgress;
    workflowSteps: readonly WorkflowStep[];
    groupingError?: string;
    analysisError?: string;
    analyzedCount: number;
    failedAnalysisCount: number;
    remainingSlots: number;
    hasCurrentRecommendations: boolean;
    canAnalyze: boolean;
    canRerun: boolean;
    isDecoding: boolean;
    isAnalyzing: boolean;
    isGrouping: boolean;
    isRanking: boolean;
    isBusy: boolean;
    addFiles(files: FileList | readonly File[]): Promise<void>;
    removePhoto(photoId: number): void;
    clearAll(): void;
    stop(): void;
    analyze(): Promise<void>;
    rerun(): Promise<void>;
}

export function usePhotoWorkflow(): PhotoWorkflow {
    const idAllocatorRef = useRef(new SessionPhotoIdAllocator());
    const photosRef = useRef<DecodedPhoto[]>([]);
    const analysisWorkerRef = useRef<AnalysisWorkerClient | undefined>(
        undefined
    );
    const analysisRunIdRef = useRef(0);

    const [photos, setPhotos] = useState<DecodedPhoto[]>([]);
    const [rejectedFiles, setRejectedFiles] = useState<FileRejection[]>([]);
    const [decodeErrors, setDecodeErrors] = useState<DecodeError[]>([]);
    const [decodeProgress, setDecodeProgress] = useState<WorkflowProgress>({
        completed: 0,
        total: 0
    });
    const [analysisState, setAnalysisState] = useState<AnalysisStateByPhotoId>(
        {}
    );
    const [analysisProgress, setAnalysisProgress] =
        useState<WorkflowProgress>({
            completed: 0,
            total: 0
        });
    const [analysisError, setAnalysisError] = useState<string | undefined>(
        undefined
    );
    const [similarityGroups, setSimilarityGroups] = useState<SimilarityGroup[]>(
        []
    );
    const [groupingStatus, setGroupingStatus] = useState<
        "idle" | "grouping" | "grouped" | "failed"
    >("idle");
    const [groupingError, setGroupingError] = useState<string | undefined>(
        undefined
    );
    const [rankingProgress, setRankingProgress] = useState<WorkflowProgress>({
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
            revokePhotoUrls(photosRef.current);
            analysisWorkerRef.current?.terminate();
        };
    }, []);

    const isDecoding = decodeProgress.completed < decodeProgress.total;
    const isAnalyzing = analysisProgress.completed < analysisProgress.total;
    const isGrouping = groupingStatus === "grouping";
    const isRanking = rankingProgress.completed < rankingProgress.total;
    const isBusy = isAnalyzing || isGrouping || isRanking;
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
    const groups = useMemo(
        () =>
            similarityGroups.map((group, index) => ({
                id: group.join("-"),
                index,
                photoIds: group,
                ranking: groupRankings[index]
            })),
        [groupRankings, similarityGroups]
    );
    const phase = workflowPhase({
        photoCount: photos.length,
        isDecoding,
        isAnalyzing,
        isGrouping,
        isRanking,
        hasCurrentRecommendations,
        failedAnalysisCount,
        groupingStatus
    });

    const invalidatePipeline = () => {
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

    const addFiles = async (fileList: FileList | readonly File[]) => {
        const validation = validatePhotoFiles(
            Array.from(fileList),
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
            invalidatePipeline();
            setPhotos((currentPhotos) => [...currentPhotos, ...decodedPhotos]);
        }

        setDecodeErrors(errors);
    };

    const removePhoto = (photoId: number) => {
        invalidatePipeline();
        setPhotos((currentPhotos) => {
            const photoToRemove = currentPhotos.find(
                (photo) => photo.id === photoId
            );

            if (photoToRemove !== undefined) {
                revokePhotoUrl(photoToRemove);
            }

            return currentPhotos.filter((photo) => photo.id !== photoId);
        });
    };

    const clearAll = () => {
        invalidatePipeline();
        revokePhotoUrls(photosRef.current);
        setPhotos([]);
        setRejectedFiles([]);
        setDecodeErrors([]);
        setDecodeProgress({ completed: 0, total: 0 });
    };

    const analyze = () => analyzePhotos();
    const rerun = () => analyzePhotos({ forceReanalyze: true });

    const analyzePhotos = async (options: AnalyzePhotosOptions = {}) => {
        if (photosRef.current.length === 0 || isBusy) {
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

        await analyzeSelectedPhotos(
            workerClient,
            photosToAnalyze,
            analysisResults,
            runId
        );

        if (analysisRunIdRef.current !== runId) {
            return;
        }

        if (analysisResults.size > 0) {
            await groupAndRankPhotos(workerClient, analysisResults, runId);
        }

        if (analysisRunIdRef.current === runId) {
            workerClient.terminate();
            analysisWorkerRef.current = undefined;
        }
    };

    const analyzeSelectedPhotos = async (
        workerClient: AnalysisWorkerClient,
        photosToAnalyze: readonly DecodedPhoto[],
        analysisResults: Map<number, PhotoAnalysis>,
        runId: number
    ) => {
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
    };

    const groupAndRankPhotos = async (
        workerClient: AnalysisWorkerClient,
        analysisResults: ReadonlyMap<number, PhotoAnalysis>,
        runId: number
    ) => {
        setGroupingStatus("grouping");

        try {
            const groupedPhotoIds = await groupAnalyses(
                workerClient,
                analysisResults
            );

            if (analysisRunIdRef.current !== runId) {
                return;
            }

            setSimilarityGroups(groupedPhotoIds);
            setGroupingStatus("grouped");
            setRankingProgress({ completed: 0, total: groupedPhotoIds.length });
            await rankGroups(
                workerClient,
                groupedPhotoIds,
                analysisResults,
                runId
            );
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
    };

    const rankGroups = async (
        workerClient: AnalysisWorkerClient,
        groupedPhotoIds: readonly SimilarityGroup[],
        analysisResults: ReadonlyMap<number, PhotoAnalysis>,
        runId: number
    ) => {
        for (const [groupIndex, group] of groupedPhotoIds.entries()) {
            if (analysisRunIdRef.current !== runId) {
                return;
            }

            try {
                const scores = await rankPhotoGroup(
                    workerClient,
                    group,
                    analysisResults
                );

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
    };

    return {
        photos,
        groups,
        rejectedFiles,
        decodeErrors,
        analysisState,
        phase,
        decodeProgress,
        analysisProgress,
        rankingProgress,
        workflowSteps,
        groupingError,
        analysisError,
        analyzedCount,
        failedAnalysisCount,
        remainingSlots: Math.max(0, maximumPhotoCount - photos.length),
        hasCurrentRecommendations,
        canAnalyze:
            photos.length > 0 &&
            !isDecoding &&
            !isBusy &&
            !hasCurrentRecommendations,
        canRerun: photos.length > 0 && !isDecoding && !isBusy,
        isDecoding,
        isAnalyzing,
        isGrouping,
        isRanking,
        isBusy,
        addFiles,
        removePhoto,
        clearAll,
        stop: invalidatePipeline,
        analyze,
        rerun
    };
}

async function analyzePhotoWithFreshPixels(
    workerClient: AnalysisWorkerClient,
    photo: DecodedPhoto
): Promise<PhotoAnalysis> {
    if (photo.pixels.byteLength > 0) {
        return workerClient.analyzePhoto(photo);
    }

    const decodedPhoto = await decodePhotoFile(photo.id, photo.file);
    revokePhotoUrl(decodedPhoto);
    return workerClient.analyzePhoto({
        ...photo,
        pixels: decodedPhoto.pixels
    });
}

async function groupAnalyses(
    workerClient: AnalysisWorkerClient,
    analysisResults: ReadonlyMap<number, PhotoAnalysis>
): Promise<SimilarityGroup[]> {
    const groups = await workerClient.groupPhotos(
        Array.from(analysisResults.values()).map((analysis) => ({
            id: analysis.id,
            hash: analysis.differenceHash
        })),
        defaultSimilarityMaximumHammingDistance
    );
    validateSimilarityGroups(groups, analysisResults);
    return groups;
}

async function rankPhotoGroup(
    workerClient: AnalysisWorkerClient,
    group: readonly number[],
    analysisResults: ReadonlyMap<number, PhotoAnalysis>
): Promise<PhotoQualityScore[]> {
    const scores = await workerClient.rankPhotos(
        group.map((photoId) =>
            analysisToMetrics(getAnalysisResult(analysisResults, photoId))
        )
    );
    validateQualityScores(scores, group);
    return scores;
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

function workflowPhase({
    photoCount,
    isDecoding,
    isAnalyzing,
    isGrouping,
    isRanking,
    hasCurrentRecommendations,
    failedAnalysisCount,
    groupingStatus
}: {
    photoCount: number;
    isDecoding: boolean;
    isAnalyzing: boolean;
    isGrouping: boolean;
    isRanking: boolean;
    hasCurrentRecommendations: boolean;
    failedAnalysisCount: number;
    groupingStatus: "idle" | "grouping" | "grouped" | "failed";
}): WorkflowPhase {
    if (photoCount === 0) {
        return "empty";
    }

    if (isDecoding) {
        return "decoding";
    }

    if (isAnalyzing) {
        return "analyzing";
    }

    if (isGrouping) {
        return "grouping";
    }

    if (isRanking) {
        return "ranking";
    }

    if (hasCurrentRecommendations) {
        return "complete";
    }

    if (failedAnalysisCount > 0 || groupingStatus === "failed") {
        return "failed";
    }

    return "ready";
}
