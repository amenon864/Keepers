import type { PhotoQualityScore } from "../../wasm/types";

export function formatPercentage(value: number): string {
    return `${Math.round(clamp01(value) * 100)}%`;
}

export function qualityExplanation(score: PhotoQualityScore): string {
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
