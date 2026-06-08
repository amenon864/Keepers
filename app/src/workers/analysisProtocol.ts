import type { PhotoAnalysis, PhotoHash, SimilarityGroup } from "../wasm/types";

export interface AnalyzePhotoRequest {
    type: "analyze-photo";
    requestId: number;
    photoId: number;
    width: number;
    height: number;
    channels: 4;
    pixels: Uint8Array;
}

export interface GroupPhotosRequest {
    type: "group-photos";
    requestId: number;
    photos: PhotoHash[];
    maximumDistance: number;
}

export type AnalysisWorkerRequest = AnalyzePhotoRequest | GroupPhotosRequest;

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

export interface GroupPhotosSuccessResponse {
    type: "grouping-success";
    requestId: number;
    groups: SimilarityGroup[];
}

export interface GroupPhotosFailureResponse {
    type: "grouping-failure";
    requestId: number;
    message: string;
}

export type AnalysisWorkerResponse =
    | AnalyzePhotoSuccessResponse
    | AnalyzePhotoFailureResponse
    | WorkerInitializationFailureResponse
    | GroupPhotosSuccessResponse
    | GroupPhotosFailureResponse;
