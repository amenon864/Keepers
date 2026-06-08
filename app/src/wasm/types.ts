export interface PhotoAnalysis {
    id: number;
    sharpness: number;
    meanLuminance: number;
    shadowClippingRatio: number;
    highlightClippingRatio: number;
    contrast: number;
    differenceHash: bigint;
}

export interface PhotoHash {
    id: number;
    hash: bigint;
}

export interface PhotoMetrics {
    id: number;
    sharpness: number;
    meanLuminance: number;
    shadowClippingRatio: number;
    highlightClippingRatio: number;
    contrast: number;
}

export interface PhotoQualityScore {
    id: number;
    normalizedSharpness: number;
    exposureScore: number;
    normalizedContrast: number;
    overallScore: number;
}

export type SimilarityGroup = number[];
