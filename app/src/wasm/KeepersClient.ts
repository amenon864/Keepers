import { throwIfKeepersStatusFailed } from "./KeepersWasmError";
import { WasmAllocation } from "./WasmAllocation";
import type { KeepersWasmModule } from "./keepers-module";
import { loadKeepersModule } from "./loadKeepersModule";
import type {
    PhotoAnalysis,
    PhotoHash,
    PhotoMetrics,
    PhotoQualityScore,
    SimilarityGroup
} from "./types";

const supportedApiVersion = 1;
const sizeTBytes = 4;
const maximumWasm32SizeT = 0xffffffff;
const maximumUint64 = (1n << 64n) - 1n;

interface PhotoAnalysisLayout {
    size: number;
    id: number;
    sharpness: number;
    meanLuminance: number;
    shadowClippingRatio: number;
    highlightClippingRatio: number;
    contrast: number;
    differenceHash: number;
}

interface PhotoHashLayout {
    size: number;
    id: number;
    hash: number;
}

interface SimilarityGroupLayout {
    size: number;
    memberOffset: number;
    memberCount: number;
}

interface PhotoMetricsLayout {
    size: number;
    id: number;
    sharpness: number;
    meanLuminance: number;
    shadowClippingRatio: number;
    highlightClippingRatio: number;
    contrast: number;
}

interface PhotoQualityScoreLayout {
    size: number;
    id: number;
    normalizedSharpness: number;
    exposureScore: number;
    normalizedContrast: number;
    overallScore: number;
}

interface KeepersLayouts {
    analysis: PhotoAnalysisLayout;
    photoHash: PhotoHashLayout;
    similarityGroup: SimilarityGroupLayout;
    photoMetrics: PhotoMetricsLayout;
    qualityScore: PhotoQualityScoreLayout;
}

export class KeepersClient {
    private readonly module: KeepersWasmModule;
    private readonly layouts: KeepersLayouts;

    private constructor(module: KeepersWasmModule, layouts: KeepersLayouts) {
        this.module = module;
        this.layouts = layouts;
    }

    static async create(): Promise<KeepersClient> {
        const module = await loadKeepersModule();
        const apiVersion = module._keepers_api_version();

        if (apiVersion !== supportedApiVersion) {
            throw new Error(
                `Unsupported Keepers WASM API version ${apiVersion}; expected ${supportedApiVersion}`
            );
        }

        return new KeepersClient(module, readLayouts(module));
    }

    analyzePhoto(
        id: number,
        pixels: Uint8Array,
        width: number,
        height: number,
        channels: number
    ): PhotoAnalysis {
        validateSizeT(id, "photo ID");
        validatePositiveSizeT(width, "photo width");
        validatePositiveSizeT(height, "photo height");
        validatePositiveSizeT(channels, "photo channel count");

        const expectedPixelBufferSize = checkedSizeProduct(
            [width, height, channels],
            "pixel buffer size"
        );

        if (pixels.length !== expectedPixelBufferSize) {
            throw new RangeError(
                `Pixel buffer length ${pixels.length} does not match width * height * channels (${expectedPixelBufferSize})`
            );
        }

        let pixelAllocation: WasmAllocation | undefined;
        let outputAllocation: WasmAllocation | undefined;

        try {
            pixelAllocation = new WasmAllocation(
                this.module,
                expectedPixelBufferSize
            );
            outputAllocation = new WasmAllocation(
                this.module,
                this.layouts.analysis.size
            );

            this.module.HEAPU8.set(pixels, pixelAllocation.pointer);

            const status = this.module._keepers_analyze_photo(
                id,
                pixelAllocation.pointer,
                expectedPixelBufferSize,
                width,
                height,
                channels,
                outputAllocation.pointer
            );

            throwIfKeepersStatusFailed(status, "Analyze photo");

            return this.readPhotoAnalysis(outputAllocation.pointer);
        } finally {
            outputAllocation?.free();
            pixelAllocation?.free();
        }
    }

    groupSimilarPhotos(
        photos: readonly PhotoHash[],
        maximumDistance: number
    ): SimilarityGroup[] {
        validateSizeT(photos.length, "photo count");
        validateMaximumDistance(maximumDistance);

        for (const photo of photos) {
            validateSizeT(photo.id, "photo ID");
            validateHash(photo.hash, `photo ${photo.id} hash`);
        }

        let photoAllocation: WasmAllocation | undefined;
        let groupCountAllocation: WasmAllocation | undefined;
        let memberCountAllocation: WasmAllocation | undefined;
        let groupsAllocation: WasmAllocation | undefined;
        let membersAllocation: WasmAllocation | undefined;

        try {
            photoAllocation = new WasmAllocation(
                this.module,
                checkedSizeProduct(
                    [photos.length, this.layouts.photoHash.size],
                    "photo hash array size"
                )
            );
            groupCountAllocation = new WasmAllocation(this.module, sizeTBytes);
            memberCountAllocation = new WasmAllocation(this.module, sizeTBytes);

            this.writePhotoHashes(photoAllocation.pointer, photos);

            let status = this.module._keepers_group_similar_photos(
                photoAllocation.pointer,
                photos.length,
                maximumDistance,
                0,
                0,
                groupCountAllocation.pointer,
                0,
                0,
                memberCountAllocation.pointer
            );

            throwIfKeepersStatusFailed(status, "Query similar photo groups");

            const requiredGroupCount = readSizeT(
                this.module,
                groupCountAllocation.pointer
            );
            const requiredMemberCount = readSizeT(
                this.module,
                memberCountAllocation.pointer
            );

            groupsAllocation = new WasmAllocation(
                this.module,
                checkedSizeProduct(
                    [requiredGroupCount, this.layouts.similarityGroup.size],
                    "similarity group array size"
                )
            );
            membersAllocation = new WasmAllocation(
                this.module,
                checkedSizeProduct(
                    [requiredMemberCount, sizeTBytes],
                    "similarity group member array size"
                )
            );

            status = this.module._keepers_group_similar_photos(
                photoAllocation.pointer,
                photos.length,
                maximumDistance,
                groupsAllocation.pointer,
                requiredGroupCount,
                groupCountAllocation.pointer,
                membersAllocation.pointer,
                requiredMemberCount,
                memberCountAllocation.pointer
            );

            throwIfKeepersStatusFailed(status, "Group similar photos");

            const actualGroupCount = readSizeT(
                this.module,
                groupCountAllocation.pointer
            );
            const actualMemberCount = readSizeT(
                this.module,
                memberCountAllocation.pointer
            );

            return this.readSimilarityGroups(
                groupsAllocation.pointer,
                actualGroupCount,
                membersAllocation.pointer,
                actualMemberCount
            );
        } finally {
            membersAllocation?.free();
            groupsAllocation?.free();
            memberCountAllocation?.free();
            groupCountAllocation?.free();
            photoAllocation?.free();
        }
    }

    rankPhotoQuality(
        photos: readonly PhotoMetrics[]
    ): PhotoQualityScore[] {
        validateSizeT(photos.length, "photo count");

        for (const photo of photos) {
            validateSizeT(photo.id, "photo ID");
            validateFiniteNumber(photo.sharpness, `photo ${photo.id} sharpness`);
            validateFiniteNumber(
                photo.meanLuminance,
                `photo ${photo.id} mean luminance`
            );
            validateFiniteNumber(
                photo.shadowClippingRatio,
                `photo ${photo.id} shadow clipping ratio`
            );
            validateFiniteNumber(
                photo.highlightClippingRatio,
                `photo ${photo.id} highlight clipping ratio`
            );
            validateFiniteNumber(photo.contrast, `photo ${photo.id} contrast`);
        }

        let metricsAllocation: WasmAllocation | undefined;
        let outputCountAllocation: WasmAllocation | undefined;
        let outputAllocation: WasmAllocation | undefined;

        try {
            metricsAllocation = new WasmAllocation(
                this.module,
                checkedSizeProduct(
                    [photos.length, this.layouts.photoMetrics.size],
                    "photo metrics array size"
                )
            );
            outputCountAllocation = new WasmAllocation(this.module, sizeTBytes);

            this.writePhotoMetrics(metricsAllocation.pointer, photos);

            let status = this.module._keepers_rank_photo_quality(
                metricsAllocation.pointer,
                photos.length,
                0,
                0,
                outputCountAllocation.pointer
            );

            throwIfKeepersStatusFailed(status, "Query photo quality ranking");

            const requiredOutputCount = readSizeT(
                this.module,
                outputCountAllocation.pointer
            );

            outputAllocation = new WasmAllocation(
                this.module,
                checkedSizeProduct(
                    [requiredOutputCount, this.layouts.qualityScore.size],
                    "photo quality score array size"
                )
            );

            status = this.module._keepers_rank_photo_quality(
                metricsAllocation.pointer,
                photos.length,
                outputAllocation.pointer,
                requiredOutputCount,
                outputCountAllocation.pointer
            );

            throwIfKeepersStatusFailed(status, "Rank photo quality");

            const actualOutputCount = readSizeT(
                this.module,
                outputCountAllocation.pointer
            );

            return this.readQualityScores(
                outputAllocation.pointer,
                actualOutputCount
            );
        } finally {
            outputAllocation?.free();
            outputCountAllocation?.free();
            metricsAllocation?.free();
        }
    }

    private readPhotoAnalysis(pointer: number): PhotoAnalysis {
        const view = dataView(this.module);
        const layout = this.layouts.analysis;

        return {
            id: view.getUint32(pointer + layout.id, true),
            sharpness: view.getFloat64(pointer + layout.sharpness, true),
            meanLuminance:
                view.getFloat64(pointer + layout.meanLuminance, true),
            shadowClippingRatio:
                view.getFloat64(pointer + layout.shadowClippingRatio, true),
            highlightClippingRatio:
                view.getFloat64(pointer + layout.highlightClippingRatio, true),
            contrast: view.getFloat64(pointer + layout.contrast, true),
            differenceHash:
                view.getBigUint64(pointer + layout.differenceHash, true)
        };
    }

    private writePhotoHashes(
        pointer: number,
        photos: readonly PhotoHash[]
    ): void {
        const layout = this.layouts.photoHash;

        photos.forEach((photo, index) => {
            const view = dataView(this.module);
            const base = pointer + index * layout.size;

            writeSizeT(view, base + layout.id, photo.id);
            view.setBigUint64(base + layout.hash, photo.hash, true);
        });
    }

    private readSimilarityGroups(
        groupsPointer: number,
        groupCount: number,
        membersPointer: number,
        memberCount: number
    ): SimilarityGroup[] {
        const groups: SimilarityGroup[] = [];
        const groupLayout = this.layouts.similarityGroup;

        for (let groupIndex = 0; groupIndex < groupCount; ++groupIndex) {
            const view = dataView(this.module);
            const base = groupsPointer + groupIndex * groupLayout.size;
            const memberOffset = readSizeTFromView(
                view,
                base + groupLayout.memberOffset
            );
            const groupMemberCount = readSizeTFromView(
                view,
                base + groupLayout.memberCount
            );
            const memberEnd = checkedSizeSum(
                memberOffset,
                groupMemberCount,
                "similarity group member range"
            );

            if (memberEnd > memberCount) {
                throw new RangeError(
                    "Native similarity group descriptor exceeds member buffer"
                );
            }

            const group: number[] = [];

            for (
                let memberIndex = memberOffset;
                memberIndex < memberEnd;
                ++memberIndex
            ) {
                group.push(readSizeT(this.module, membersPointer + memberIndex * sizeTBytes));
            }

            groups.push(group);
        }

        return groups;
    }

    private writePhotoMetrics(
        pointer: number,
        photos: readonly PhotoMetrics[]
    ): void {
        const layout = this.layouts.photoMetrics;

        photos.forEach((photo, index) => {
            const view = dataView(this.module);
            const base = pointer + index * layout.size;

            writeSizeT(view, base + layout.id, photo.id);
            view.setFloat64(base + layout.sharpness, photo.sharpness, true);
            view.setFloat64(
                base + layout.meanLuminance,
                photo.meanLuminance,
                true
            );
            view.setFloat64(
                base + layout.shadowClippingRatio,
                photo.shadowClippingRatio,
                true
            );
            view.setFloat64(
                base + layout.highlightClippingRatio,
                photo.highlightClippingRatio,
                true
            );
            view.setFloat64(base + layout.contrast, photo.contrast, true);
        });
    }

    private readQualityScores(
        pointer: number,
        scoreCount: number
    ): PhotoQualityScore[] {
        const scores: PhotoQualityScore[] = [];
        const layout = this.layouts.qualityScore;

        for (let index = 0; index < scoreCount; ++index) {
            const view = dataView(this.module);
            const base = pointer + index * layout.size;

            scores.push({
                id: readSizeTFromView(view, base + layout.id),
                normalizedSharpness:
                    view.getFloat64(base + layout.normalizedSharpness, true),
                exposureScore:
                    view.getFloat64(base + layout.exposureScore, true),
                normalizedContrast:
                    view.getFloat64(base + layout.normalizedContrast, true),
                overallScore: view.getFloat64(base + layout.overallScore, true)
            });
        }

        return scores;
    }
}

function readLayouts(module: KeepersWasmModule): KeepersLayouts {
    return {
        analysis: {
            size: readNativeLayoutValue(module._keepers_photo_analysis_size(), "KeepersPhotoAnalysis size"),
            id: readNativeLayoutValue(module._keepers_photo_analysis_offset_id(), "KeepersPhotoAnalysis.id offset"),
            sharpness: readNativeLayoutValue(module._keepers_photo_analysis_offset_sharpness(), "KeepersPhotoAnalysis.sharpness offset"),
            meanLuminance: readNativeLayoutValue(module._keepers_photo_analysis_offset_mean_luminance(), "KeepersPhotoAnalysis.mean_luminance offset"),
            shadowClippingRatio: readNativeLayoutValue(module._keepers_photo_analysis_offset_shadow_clipping_ratio(), "KeepersPhotoAnalysis.shadow_clipping_ratio offset"),
            highlightClippingRatio: readNativeLayoutValue(module._keepers_photo_analysis_offset_highlight_clipping_ratio(), "KeepersPhotoAnalysis.highlight_clipping_ratio offset"),
            contrast: readNativeLayoutValue(module._keepers_photo_analysis_offset_contrast(), "KeepersPhotoAnalysis.contrast offset"),
            differenceHash: readNativeLayoutValue(module._keepers_photo_analysis_offset_difference_hash(), "KeepersPhotoAnalysis.difference_hash offset")
        },
        photoHash: {
            size: readNativeLayoutValue(module._keepers_photo_hash_size(), "KeepersPhotoHash size"),
            id: readNativeLayoutValue(module._keepers_photo_hash_offset_id(), "KeepersPhotoHash.id offset"),
            hash: readNativeLayoutValue(module._keepers_photo_hash_offset_hash(), "KeepersPhotoHash.hash offset")
        },
        similarityGroup: {
            size: readNativeLayoutValue(module._keepers_similarity_group_size(), "KeepersSimilarityGroup size"),
            memberOffset: readNativeLayoutValue(module._keepers_similarity_group_offset_member_offset(), "KeepersSimilarityGroup.member_offset offset"),
            memberCount: readNativeLayoutValue(module._keepers_similarity_group_offset_member_count(), "KeepersSimilarityGroup.member_count offset")
        },
        photoMetrics: {
            size: readNativeLayoutValue(module._keepers_photo_metrics_size(), "KeepersPhotoMetrics size"),
            id: readNativeLayoutValue(module._keepers_photo_metrics_offset_id(), "KeepersPhotoMetrics.id offset"),
            sharpness: readNativeLayoutValue(module._keepers_photo_metrics_offset_sharpness(), "KeepersPhotoMetrics.sharpness offset"),
            meanLuminance: readNativeLayoutValue(module._keepers_photo_metrics_offset_mean_luminance(), "KeepersPhotoMetrics.mean_luminance offset"),
            shadowClippingRatio: readNativeLayoutValue(module._keepers_photo_metrics_offset_shadow_clipping_ratio(), "KeepersPhotoMetrics.shadow_clipping_ratio offset"),
            highlightClippingRatio: readNativeLayoutValue(module._keepers_photo_metrics_offset_highlight_clipping_ratio(), "KeepersPhotoMetrics.highlight_clipping_ratio offset"),
            contrast: readNativeLayoutValue(module._keepers_photo_metrics_offset_contrast(), "KeepersPhotoMetrics.contrast offset")
        },
        qualityScore: {
            size: readNativeLayoutValue(module._keepers_photo_quality_score_size(), "KeepersPhotoQualityScore size"),
            id: readNativeLayoutValue(module._keepers_photo_quality_score_offset_id(), "KeepersPhotoQualityScore.id offset"),
            normalizedSharpness: readNativeLayoutValue(module._keepers_photo_quality_score_offset_normalized_sharpness(), "KeepersPhotoQualityScore.normalized_sharpness offset"),
            exposureScore: readNativeLayoutValue(module._keepers_photo_quality_score_offset_exposure_score(), "KeepersPhotoQualityScore.exposure_score offset"),
            normalizedContrast: readNativeLayoutValue(module._keepers_photo_quality_score_offset_normalized_contrast(), "KeepersPhotoQualityScore.normalized_contrast offset"),
            overallScore: readNativeLayoutValue(module._keepers_photo_quality_score_offset_overall_score(), "KeepersPhotoQualityScore.overall_score offset")
        }
    };
}

function readNativeLayoutValue(value: number, name: string): number {
    validateSizeT(value, name);
    return value;
}

function dataView(module: KeepersWasmModule): DataView {
    return new DataView(module.HEAPU8.buffer);
}

function readSizeT(module: KeepersWasmModule, pointer: number): number {
    return readSizeTFromView(dataView(module), pointer);
}

function readSizeTFromView(view: DataView, offset: number): number {
    // The current Keepers Emscripten target is wasm32, so native size_t is 32 bits.
    return view.getUint32(offset, true);
}

function writeSizeT(view: DataView, offset: number, value: number): void {
    validateSizeT(value, "size_t value");
    view.setUint32(offset, value, true);
}

function validateSizeT(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer: ${value}`);
    }

    if (value > maximumWasm32SizeT) {
        throw new RangeError(`${name} exceeds the wasm32 size_t limit: ${value}`);
    }
}

function validatePositiveSizeT(value: number, name: string): void {
    validateSizeT(value, name);

    if (value === 0) {
        throw new RangeError(`${name} must be greater than zero`);
    }
}

function validateMaximumDistance(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 64) {
        throw new RangeError(
            `maximum distance must be an integer in the range [0, 64]: ${value}`
        );
    }
}

function validateHash(value: bigint, name: string): void {
    if (typeof value !== "bigint" || value < 0n || value > maximumUint64) {
        throw new RangeError(`${name} must be a bigint in the uint64 range`);
    }
}

function validateFiniteNumber(value: number, name: string): void {
    if (!Number.isFinite(value)) {
        throw new RangeError(`${name} must be a finite number`);
    }
}

function checkedSizeProduct(values: readonly number[], name: string): number {
    let product = 1;

    for (const value of values) {
        validateSizeT(value, name);

        if (value !== 0 && product > Math.floor(maximumWasm32SizeT / value)) {
            throw new RangeError(`${name} exceeds the wasm32 size_t limit`);
        }

        product *= value;
    }

    return product;
}

function checkedSizeSum(left: number, right: number, name: string): number {
    validateSizeT(left, name);
    validateSizeT(right, name);

    if (left > maximumWasm32SizeT - right) {
        throw new RangeError(`${name} exceeds the wasm32 size_t limit`);
    }

    return left + right;
}
