import type { DecodedPhoto } from "../photos/types";
import type { PhotoAnalysis } from "../wasm/types";
import type {
    AnalysisWorkerRequest,
    AnalysisWorkerResponse
} from "./analysisProtocol";

interface PendingAnalysisRequest {
    photoId: number;
    resolve: (analysis: PhotoAnalysis) => void;
    reject: (error: Error) => void;
}

export class AnalysisWorkerClient {
    private readonly worker: Worker;
    private readonly pendingRequests = new Map<number, PendingAnalysisRequest>();
    private nextRequestId = 1;
    private isTerminated = false;

    constructor() {
        this.worker = new Worker(
            new URL("./analysisWorker.ts", import.meta.url),
            { type: "module" }
        );
        this.worker.addEventListener("message", this.handleMessage);
        this.worker.addEventListener("error", this.handleWorkerError);
        this.worker.addEventListener(
            "messageerror",
            this.handleWorkerMessageError
        );
    }

    analyzePhoto(photo: DecodedPhoto): Promise<PhotoAnalysis> {
        if (this.isTerminated) {
            return Promise.reject(
                new Error("The analysis worker has already been stopped.")
            );
        }

        if (photo.pixels.byteLength === 0) {
            return Promise.reject(
                new Error("This photo needs to be decoded again before analysis.")
            );
        }

        const requestId = this.nextRequestId;
        this.nextRequestId += 1;

        const request: AnalysisWorkerRequest = {
            type: "analyze-photo",
            requestId,
            photoId: photo.id,
            width: photo.width,
            height: photo.height,
            channels: photo.channels,
            pixels: photo.pixels
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, {
                photoId: photo.id,
                resolve,
                reject
            });

            try {
                this.worker.postMessage(request, [photo.pixels.buffer]);
            } catch (error) {
                this.pendingRequests.delete(requestId);
                reject(
                    error instanceof Error
                        ? error
                        : new Error("Unable to send photo pixels to the worker.")
                );
            }
        });
    }

    terminate(): void {
        if (this.isTerminated) {
            return;
        }

        this.isTerminated = true;
        this.worker.removeEventListener("message", this.handleMessage);
        this.worker.removeEventListener("error", this.handleWorkerError);
        this.worker.removeEventListener(
            "messageerror",
            this.handleWorkerMessageError
        );
        this.worker.terminate();
        this.rejectPending(
            new Error("Photo analysis was stopped before it finished.")
        );
    }

    private readonly handleMessage = (
        event: MessageEvent<AnalysisWorkerResponse>
    ) => {
        const response = event.data;
        const pending = this.pendingRequests.get(response.requestId);

        if (pending === undefined) {
            return;
        }

        this.pendingRequests.delete(response.requestId);

        switch (response.type) {
            case "analysis-success":
                pending.resolve(response.analysis);
                break;
            case "analysis-failure":
            case "worker-initialization-failure":
                pending.reject(new Error(response.message));
                break;
        }
    };

    private readonly handleWorkerError = () => {
        this.rejectPending(
            new Error("The background analysis worker stopped unexpectedly.")
        );
    };

    private readonly handleWorkerMessageError = () => {
        this.rejectPending(
            new Error("The background analysis worker sent an unreadable message.")
        );
    };

    private rejectPending(error: Error): void {
        for (const pending of this.pendingRequests.values()) {
            pending.reject(error);
        }

        this.pendingRequests.clear();
    }
}
