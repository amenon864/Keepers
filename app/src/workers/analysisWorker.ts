import { getKeepersClient } from "../wasm/client";
import type {
    AnalyzePhotoRequest,
    AnalysisWorkerRequest,
    GroupPhotosRequest,
    AnalysisWorkerResponse
} from "./analysisProtocol";

self.addEventListener(
    "message",
    (event: MessageEvent<AnalysisWorkerRequest>) => {
        void handleRequest(event.data);
    }
);

async function handleRequest(request: AnalysisWorkerRequest): Promise<void> {
    switch (request.type) {
        case "analyze-photo":
            await analyzePhoto(request);
            break;
        case "group-photos":
            await groupPhotos(request);
            break;
    }
}

async function analyzePhoto(
    request: AnalyzePhotoRequest
): Promise<void> {
    try {
        const client = await getKeepersClient();
        const analysis = client.analyzePhoto(
            request.photoId,
            request.pixels,
            request.width,
            request.height,
            request.channels
        );

        postResponse({
            type: "analysis-success",
            requestId: request.requestId,
            photoId: request.photoId,
            analysis
        });
    } catch (error) {
        const message = readableWorkerError(error);
        const response: AnalysisWorkerResponse =
            isWasmLoadFailure(error)
                ? {
                      type: "worker-initialization-failure",
                      requestId: request.requestId,
                      message
                  }
                : {
                      type: "analysis-failure",
                      requestId: request.requestId,
                      photoId: request.photoId,
                      message
                  };

        postResponse(response);
    }
}

async function groupPhotos(request: GroupPhotosRequest): Promise<void> {
    try {
        const client = await getKeepersClient();
        const groups = client.groupSimilarPhotos(
            request.photos,
            request.maximumDistance
        );

        postResponse({
            type: "grouping-success",
            requestId: request.requestId,
            groups
        });
    } catch (error) {
        postResponse({
            type: "grouping-failure",
            requestId: request.requestId,
            message: readableWorkerError(error)
        });
    }
}

function postResponse(response: AnalysisWorkerResponse): void {
    self.postMessage(response);
}

function isWasmLoadFailure(error: unknown): boolean {
    return error instanceof Error && error.message.includes("WASM artifacts");
}

function readableWorkerError(error: unknown): string {
    if (error instanceof Error) {
        return error.message.replaceAll(/\bstatus\s+\d+\b/gi, "native error");
    }

    return "Photo analysis failed in the background worker.";
}
