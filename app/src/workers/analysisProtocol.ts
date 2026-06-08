import type { PhotoAnalysis } from "../wasm/types";

export interface AnalyzePhotoRequest {
    type: "analyze-photo";
    requestId: number;
    photoId: number;
    width: number;
    height: number;
    channels: 4;
    pixels: Uint8Array;
}

export type AnalysisWorkerRequest = AnalyzePhotoRequest;

export interface AnalyzePhotoSuccessResponse {
    type: "analysis-success";
    requestId: number;
    photoId: number;
    analysis: PhotoAnalysis;
}

export interface AnalyzePhotoFailureResponse {
    type: "analysis-failure";
    requestId: number;
    photoId: number;
    message: string;
}

export interface WorkerInitializationFailureResponse {
    type: "worker-initialization-failure";
    requestId: number;
    message: string;
}

export type AnalysisWorkerResponse =
    | AnalyzePhotoSuccessResponse
    | AnalyzePhotoFailureResponse
    | WorkerInitializationFailureResponse;
