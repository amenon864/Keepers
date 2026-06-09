import type {
    PhotoAnalysis,
    PhotoQualityScore,
    SimilarityGroup
} from "../../wasm/types";

export interface DecodedPhoto {
    id: number;
    file: File;
    name: string;
    width: number;
    height: number;
    channels: 4;
    pixels: Uint8Array;
    previewUrl: string;
}

export type WorkflowPhoto = DecodedPhoto;

export interface FileRejection {
    name: string;
    reason: string;
}

export interface DecodeError {
    id: number;
    name: string;
    message: string;
}

export interface WorkflowProgress {
    completed: number;
    total: number;
}

export type PhotoAnalysisStatus =
    | { state: "idle" }
    | { state: "analyzing" }
    | { state: "analyzed"; analysis: PhotoAnalysis }
    | { state: "failed"; message: string };

export type AnalysisStateByPhotoId = Record<number, PhotoAnalysisStatus>;

export type GroupingStatus = "idle" | "grouping" | "grouped" | "failed";

export interface GroupRanking {
    scores: PhotoQualityScore[];
    error?: string;
}

export type GroupRankingsByIndex = Record<number, GroupRanking>;

export interface RankedPhotoGroup {
    id: string;
    index: number;
    photoIds: SimilarityGroup;
    ranking?: GroupRanking;
}

export type WorkflowPhase =
    | "empty"
    | "decoding"
    | "ready"
    | "analyzing"
    | "grouping"
    | "ranking"
    | "complete"
    | "failed";

export interface WorkflowStep {
    label: string;
    status: "pending" | "active" | "complete" | "failed";
}
