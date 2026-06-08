import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { decodePhotoFile } from "./photos/decodePhoto";
import {
    SessionPhotoIdAllocator,
    maximumPhotoCount,
    validatePhotoFiles
} from "./photos/photoValidation";
import type { DecodedPhoto, RejectedFile } from "./photos/types";
import { AnalysisWorkerClient } from "./workers/AnalysisWorkerClient";
import type { PhotoAnalysis } from "./wasm/types";

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
    const analyzedCount = useMemo(
        () =>
            Object.values(analysisState).filter(
                (status) => status.state === "analyzed"
            ).length,
        [analysisState]
    );
    const remainingSlots = useMemo(
        () => Math.max(0, maximumPhotoCount - photos.length),
        [photos.length]
    );

    const cancelAnalysis = () => {
        analysisRunIdRef.current += 1;
        analysisWorkerRef.current?.terminate();
        analysisWorkerRef.current = undefined;
        setAnalysisProgress({ completed: 0, total: 0 });
        setAnalysisError(undefined);
        setAnalysisState({});
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

    const analyzePhotos = async () => {
        if (photosRef.current.length === 0 || isAnalyzing) {
            return;
        }

        const runId = analysisRunIdRef.current + 1;
        analysisRunIdRef.current = runId;
        analysisWorkerRef.current?.terminate();
        const workerClient = new AnalysisWorkerClient();
        analysisWorkerRef.current = workerClient;

        setAnalysisError(undefined);
        setAnalysisProgress({
            completed: 0,
            total: photosRef.current.length
        });
        setAnalysisState(
            Object.fromEntries(
                photosRef.current.map((photo) => [photo.id, { state: "idle" }])
            ) as AnalysisStateByPhotoId
        );

        for (const photo of photosRef.current) {
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
                    <button
                        type="button"
                        className="primary-action"
                        onClick={() => {
                            void analyzePhotos();
                        }}
                        disabled={
                            photos.length === 0 || isDecoding || isAnalyzing
                        }
                    >
                        Analyze photos
                    </button>
                    <button
                        type="button"
                        onClick={clearPhotos}
                        disabled={
                            isAnalyzing ||
                            (photos.length === 0 && rejectedFiles.length === 0)
                        }
                    >
                        Clear all
                    </button>
                </div>

                {analysisError !== undefined ? (
                    <div className="notice error" role="alert">
                        <h2>Analysis error</h2>
                        <p>{analysisError}</p>
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

                {photos.length > 0 ? (
                    <div className="photo-grid">
                        {photos.map((photo) => (
                            <article className="photo-card" key={photo.id}>
                                <img
                                    src={photo.previewUrl}
                                    alt={photo.name}
                                    loading="lazy"
                                />
                                <div className="photo-details">
                                    <h2>{photo.name}</h2>
                                    <span>
                                        {photo.width} x {photo.height}
                                    </span>
                                    <AnalysisStatusSummary
                                        status={analysisState[photo.id]}
                                    />
                                </div>
                                <button
                                    type="button"
                                    disabled={isAnalyzing}
                                    onClick={() => {
                                        removePhoto(photo.id);
                                    }}
                                >
                                    Remove
                                </button>
                            </article>
                        ))}
                    </div>
                ) : (
                    <p className="empty-state">
                        Select a few local images to decode them in your
                        browser.
                    </p>
                )}
            </section>
        </main>
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

export default App;
