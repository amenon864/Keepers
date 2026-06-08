#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const statusOk = 0;
const statusInvalidArgument = 1;
const statusInsufficientCapacity = 5;
const pointerSizeBytes = 4;

const modulePath = process.argv[2] ?? "build-wasm/wasm/keepers.mjs";
const moduleUrl = pathToFileURL(modulePath);
const importedModule = await import(moduleUrl.href);
const createKeepersModule = importedModule.default;

if (typeof createKeepersModule !== "function") {
    throw new Error("Expected keepers.mjs to export a module factory");
}

const keepers = await createKeepersModule({
    locateFile(path) {
        return new URL(path, moduleUrl).pathname;
    }
});

if (keepers._keepers_api_version() !== 1) {
    throw new Error("Unexpected Keepers WASM API version");
}

if (!(keepers.HEAPU8 instanceof Uint8Array)) {
    throw new Error("Expected HEAPU8 to be exported");
}

const layouts = {
    analysis: {
        size: keepers._keepers_photo_analysis_size(),
        id: keepers._keepers_photo_analysis_offset_id(),
        sharpness: keepers._keepers_photo_analysis_offset_sharpness(),
        meanLuminance:
            keepers._keepers_photo_analysis_offset_mean_luminance(),
        shadowClippingRatio:
            keepers._keepers_photo_analysis_offset_shadow_clipping_ratio(),
        highlightClippingRatio:
            keepers._keepers_photo_analysis_offset_highlight_clipping_ratio(),
        contrast: keepers._keepers_photo_analysis_offset_contrast(),
        differenceHash:
            keepers._keepers_photo_analysis_offset_difference_hash()
    },
    photoHash: {
        size: keepers._keepers_photo_hash_size(),
        id: keepers._keepers_photo_hash_offset_id(),
        hash: keepers._keepers_photo_hash_offset_hash()
    },
    similarityGroup: {
        size: keepers._keepers_similarity_group_size(),
        memberOffset:
            keepers._keepers_similarity_group_offset_member_offset(),
        memberCount:
            keepers._keepers_similarity_group_offset_member_count()
    },
    photoMetrics: {
        size: keepers._keepers_photo_metrics_size(),
        id: keepers._keepers_photo_metrics_offset_id(),
        sharpness: keepers._keepers_photo_metrics_offset_sharpness(),
        meanLuminance: keepers._keepers_photo_metrics_offset_mean_luminance(),
        shadowClippingRatio:
            keepers._keepers_photo_metrics_offset_shadow_clipping_ratio(),
        highlightClippingRatio:
            keepers._keepers_photo_metrics_offset_highlight_clipping_ratio(),
        contrast: keepers._keepers_photo_metrics_offset_contrast()
    },
    qualityScore: {
        size: keepers._keepers_photo_quality_score_size(),
        id: keepers._keepers_photo_quality_score_offset_id(),
        normalizedSharpness:
            keepers._keepers_photo_quality_score_offset_normalized_sharpness(),
        exposureScore:
            keepers._keepers_photo_quality_score_offset_exposure_score(),
        normalizedContrast:
            keepers._keepers_photo_quality_score_offset_normalized_contrast(),
        overallScore:
            keepers._keepers_photo_quality_score_offset_overall_score()
    }
};

if (layouts.analysis.sharpness < pointerSizeBytes) {
    throw new Error("Unexpected size_t layout; smoke test assumes wasm32");
}

const allocations = [];

function allocate(size) {
    const pointer = keepers._keepers_allocate(size);

    if (size > 0 && pointer === 0) {
        throw new Error(`WASM allocation failed for ${size} bytes`);
    }

    allocations.push(pointer);
    return pointer;
}

function currentHeapU8() {
    return keepers.HEAPU8;
}

function currentDataView() {
    return new DataView(keepers.HEAPU8.buffer);
}

function requireStatus(actual, expected, description) {
    if (actual !== expected) {
        throw new Error(`${description}: expected ${expected}, got ${actual}`);
    }
}

function requireArray(actual, expected, description) {
    if (
        actual.length !== expected.length ||
        actual.some((value, index) => value !== expected[index])
    ) {
        throw new Error(
            `${description}: expected [${expected}], got [${actual}]`
        );
    }
}

function requireFiniteInRange(value, minimum, maximum, name) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error(`${name} is out of range: ${value}`);
    }
}

function readSize(pointer) {
    return currentDataView().getUint32(pointer, true);
}

function writeSize(pointer, value) {
    currentDataView().setUint32(pointer, value, true);
}

function readAnalysis(pointer) {
    const view = currentDataView();
    const layout = layouts.analysis;

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

function writePhotoHash(pointer, index, { id, hash }) {
    const view = currentDataView();
    const layout = layouts.photoHash;
    const base = pointer + index * layout.size;

    view.setUint32(base + layout.id, id, true);
    view.setBigUint64(base + layout.hash, BigInt(hash), true);
}

function readSimilarityGroup(pointer, index) {
    const view = currentDataView();
    const layout = layouts.similarityGroup;
    const base = pointer + index * layout.size;

    return {
        memberOffset: view.getUint32(base + layout.memberOffset, true),
        memberCount: view.getUint32(base + layout.memberCount, true)
    };
}

function readSizeArray(pointer, count) {
    const view = currentDataView();
    const values = [];

    for (let index = 0; index < count; ++index) {
        values.push(view.getUint32(pointer + index * pointerSizeBytes, true));
    }

    return values;
}

function writePhotoMetrics(pointer, index, metrics) {
    const view = currentDataView();
    const layout = layouts.photoMetrics;
    const base = pointer + index * layout.size;

    view.setUint32(base + layout.id, metrics.id, true);
    view.setFloat64(base + layout.sharpness, metrics.sharpness, true);
    view.setFloat64(
        base + layout.meanLuminance,
        metrics.meanLuminance,
        true
    );
    view.setFloat64(
        base + layout.shadowClippingRatio,
        metrics.shadowClippingRatio,
        true
    );
    view.setFloat64(
        base + layout.highlightClippingRatio,
        metrics.highlightClippingRatio,
        true
    );
    view.setFloat64(base + layout.contrast, metrics.contrast, true);
}

function readQualityScore(pointer, index) {
    const view = currentDataView();
    const layout = layouts.qualityScore;
    const base = pointer + index * layout.size;

    return {
        id: view.getUint32(base + layout.id, true),
        normalizedSharpness:
            view.getFloat64(base + layout.normalizedSharpness, true),
        exposureScore:
            view.getFloat64(base + layout.exposureScore, true),
        normalizedContrast:
            view.getFloat64(base + layout.normalizedContrast, true),
        overallScore: view.getFloat64(base + layout.overallScore, true)
    };
}

function requireNormalizedScore(score, label) {
    requireFiniteInRange(
        score.normalizedSharpness,
        0,
        1,
        `${label} normalized sharpness`
    );
    requireFiniteInRange(score.exposureScore, 0, 1, `${label} exposure score`);
    requireFiniteInRange(
        score.normalizedContrast,
        0,
        1,
        `${label} normalized contrast`
    );
    requireFiniteInRange(score.overallScore, 0, 1, `${label} overall score`);
}

function runAnalysisSmokeTest() {
    const width = 5;
    const height = 5;
    const channels = 3;
    const photoId = 37;
    const pixels = new Uint8Array([
        0, 0, 0,       32, 16, 8,      64, 32, 16,
        96, 48, 24,    128, 64, 32,
        16, 64, 32,    48, 96, 64,     80, 128, 96,
        112, 160, 128, 144, 192, 160,
        32, 128, 64,   64, 160, 96,    96, 192, 128,
        128, 224, 160, 160, 255, 192,
        48, 192, 96,   80, 224, 128,   112, 255, 160,
        144, 240, 192, 176, 224, 224,
        64, 255, 128,  96, 240, 160,   128, 224, 192,
        160, 208, 224, 192, 192, 255
    ]);

    const pixelPointer = allocate(pixels.byteLength);
    const outputPointer = allocate(layouts.analysis.size);
    const tinyPixelPointer = allocate(1);

    currentHeapU8().set(pixels, pixelPointer);
    currentHeapU8()[tinyPixelPointer] = 0;

    requireStatus(
        keepers._keepers_analyze_photo(
            photoId,
            pixelPointer,
            pixels.byteLength,
            width,
            height,
            channels,
            outputPointer
        ),
        statusOk,
        "valid analysis"
    );

    const analysis = readAnalysis(outputPointer);

    if (analysis.id !== photoId) {
        throw new Error(`Expected ID ${photoId}, got ${analysis.id}`);
    }

    requireFiniteInRange(analysis.sharpness, 0, Number.MAX_VALUE, "sharpness");
    requireFiniteInRange(
        analysis.meanLuminance,
        0,
        255,
        "mean luminance"
    );
    requireFiniteInRange(
        analysis.shadowClippingRatio,
        0,
        1,
        "shadow clipping ratio"
    );
    requireFiniteInRange(
        analysis.highlightClippingRatio,
        0,
        1,
        "highlight clipping ratio"
    );
    requireFiniteInRange(analysis.contrast, 0, Number.MAX_VALUE, "contrast");

    if (typeof analysis.differenceHash !== "bigint") {
        throw new Error("Expected difference hash to be a bigint");
    }

    requireStatus(
        keepers._keepers_analyze_photo(
            photoId,
            pixelPointer,
            pixels.byteLength,
            width,
            height,
            channels,
            0
        ),
        statusInvalidArgument,
        "analysis null output"
    );

    requireStatus(
        keepers._keepers_analyze_photo(
            photoId,
            pixelPointer,
            pixels.byteLength,
            width,
            height,
            1,
            outputPointer
        ),
        statusInvalidArgument,
        "analysis unsupported channel count"
    );

    requireStatus(
        keepers._keepers_analyze_photo(
            photoId,
            tinyPixelPointer,
            1,
            width,
            height,
            channels,
            outputPointer
        ),
        statusInvalidArgument,
        "analysis undersized pixel buffer"
    );

    console.log("Keepers WASM analysis ID:", analysis.id);
    console.log("Keepers WASM difference hash:", analysis.differenceHash);
}

function runGroupingSmokeTest() {
    const photoHashes = [
        { id: 9, hash: 0b0000n },
        { id: 2, hash: 0b0001n },
        { id: 7, hash: 0b0011n },
        { id: 4, hash: 0b11110000n }
    ];
    const photoPointer = allocate(photoHashes.length * layouts.photoHash.size);
    const groupCountPointer = allocate(pointerSizeBytes);
    const memberCountPointer = allocate(pointerSizeBytes);

    photoHashes.forEach((photo, index) => {
        writePhotoHash(photoPointer, index, photo);
    });

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            0,
            0,
            groupCountPointer,
            0,
            0,
            memberCountPointer
        ),
        statusOk,
        "grouping size query"
    );

    const requiredGroups = readSize(groupCountPointer);
    const requiredMembers = readSize(memberCountPointer);

    if (requiredGroups !== 2 || requiredMembers !== 4) {
        throw new Error(
            `Unexpected grouping sizes: ${requiredGroups}, ${requiredMembers}`
        );
    }

    const groupsPointer = allocate(requiredGroups * layouts.similarityGroup.size);
    const membersPointer = allocate(requiredMembers * pointerSizeBytes);

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            groupsPointer,
            requiredGroups,
            groupCountPointer,
            membersPointer,
            requiredMembers,
            memberCountPointer
        ),
        statusOk,
        "grouping populate"
    );

    const firstGroup = readSimilarityGroup(groupsPointer, 0);
    const secondGroup = readSimilarityGroup(groupsPointer, 1);
    const members = readSizeArray(membersPointer, requiredMembers);

    if (
        firstGroup.memberOffset !== 0 ||
        firstGroup.memberCount !== 3 ||
        secondGroup.memberOffset !== 3 ||
        secondGroup.memberCount !== 1
    ) {
        throw new Error("Unexpected grouping descriptors");
    }

    requireArray(members, [2, 7, 9, 4], "grouping flattened members");

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            65,
            0,
            0,
            groupCountPointer,
            0,
            0,
            memberCountPointer
        ),
        statusInvalidArgument,
        "grouping invalid threshold"
    );

    writePhotoHash(photoPointer, 1, { id: 9, hash: 0b0001n });
    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            0,
            0,
            groupCountPointer,
            0,
            0,
            memberCountPointer
        ),
        statusInvalidArgument,
        "grouping duplicate IDs"
    );
    writePhotoHash(photoPointer, 1, photoHashes[1]);

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            groupsPointer,
            requiredGroups - 1,
            groupCountPointer,
            membersPointer,
            requiredMembers,
            memberCountPointer
        ),
        statusInsufficientCapacity,
        "grouping insufficient group capacity"
    );

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            groupsPointer,
            requiredGroups,
            groupCountPointer,
            membersPointer,
            requiredMembers - 1,
            memberCountPointer
        ),
        statusInsufficientCapacity,
        "grouping insufficient member capacity"
    );

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            0,
            0,
            0,
            0,
            0,
            memberCountPointer
        ),
        statusInvalidArgument,
        "grouping null group count"
    );

    requireStatus(
        keepers._keepers_group_similar_photos(
            photoPointer,
            photoHashes.length,
            1,
            0,
            0,
            groupCountPointer,
            0,
            0,
            0
        ),
        statusInvalidArgument,
        "grouping null member count"
    );

    console.log("Keepers WASM grouping members:", members.join(","));
}

function runRankingSmokeTest() {
    const metrics = [
        {
            id: 1,
            sharpness: 10,
            meanLuminance: 0,
            shadowClippingRatio: 0,
            highlightClippingRatio: 0,
            contrast: 10
        },
        {
            id: 2,
            sharpness: 30,
            meanLuminance: 128,
            shadowClippingRatio: 0,
            highlightClippingRatio: 0,
            contrast: 30
        },
        {
            id: 3,
            sharpness: 20,
            meanLuminance: 128,
            shadowClippingRatio: 0.1,
            highlightClippingRatio: 0,
            contrast: 20
        }
    ];
    const metricsPointer = allocate(metrics.length * layouts.photoMetrics.size);
    const outputCountPointer = allocate(pointerSizeBytes);

    metrics.forEach((photo, index) => {
        writePhotoMetrics(metricsPointer, index, photo);
    });

    requireStatus(
        keepers._keepers_rank_photo_quality(
            metricsPointer,
            metrics.length,
            0,
            0,
            outputCountPointer
        ),
        statusOk,
        "ranking size query"
    );

    const requiredOutput = readSize(outputCountPointer);

    if (requiredOutput !== metrics.length) {
        throw new Error(`Unexpected ranking size: ${requiredOutput}`);
    }

    const outputPointer = allocate(requiredOutput * layouts.qualityScore.size);

    requireStatus(
        keepers._keepers_rank_photo_quality(
            metricsPointer,
            metrics.length,
            outputPointer,
            requiredOutput,
            outputCountPointer
        ),
        statusOk,
        "ranking populate"
    );

    const scores = [];

    for (let index = 0; index < requiredOutput; ++index) {
        const score = readQualityScore(outputPointer, index);
        requireNormalizedScore(score, `ranking score ${index}`);
        scores.push(score);
    }

    requireArray(
        scores.map((score) => score.id),
        [2, 3, 1],
        "ranking IDs"
    );

    if (scores[0].overallScore <= scores[2].overallScore) {
        throw new Error("Expected strongest photo to rank above weakest photo");
    }

    requireStatus(
        keepers._keepers_rank_photo_quality(
            metricsPointer,
            metrics.length,
            outputPointer,
            requiredOutput - 1,
            outputCountPointer
        ),
        statusInsufficientCapacity,
        "ranking insufficient capacity"
    );

    writePhotoMetrics(metricsPointer, 1, { ...metrics[1], id: 1 });
    requireStatus(
        keepers._keepers_rank_photo_quality(
            metricsPointer,
            metrics.length,
            0,
            0,
            outputCountPointer
        ),
        statusInvalidArgument,
        "ranking duplicate IDs"
    );
    writePhotoMetrics(metricsPointer, 1, metrics[1]);

    writePhotoMetrics(metricsPointer, 1, {
        ...metrics[1],
        meanLuminance: 256
    });
    requireStatus(
        keepers._keepers_rank_photo_quality(
            metricsPointer,
            metrics.length,
            0,
            0,
            outputCountPointer
        ),
        statusInvalidArgument,
        "ranking invalid metric range"
    );
    writePhotoMetrics(metricsPointer, 1, metrics[1]);

    requireStatus(
        keepers._keepers_rank_photo_quality(
            metricsPointer,
            metrics.length,
            0,
            0,
            0
        ),
        statusInvalidArgument,
        "ranking null output count"
    );

    console.log(
        "Keepers WASM ranking IDs:",
        scores.map((score) => score.id).join(",")
    );
}

try {
    runAnalysisSmokeTest();
    runGroupingSmokeTest();
    runRankingSmokeTest();
    console.log("Keepers WASM API version:", keepers._keepers_api_version());
} finally {
    for (let index = allocations.length - 1; index >= 0; --index) {
        keepers._keepers_deallocate(allocations[index]);
    }
}
