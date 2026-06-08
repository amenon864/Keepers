#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const statusOk = 0;
const statusInvalidArgument = 1;
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

const analysisSize = keepers._keepers_photo_analysis_size();
const offsets = {
    id: keepers._keepers_photo_analysis_offset_id(),
    sharpness: keepers._keepers_photo_analysis_offset_sharpness(),
    meanLuminance: keepers._keepers_photo_analysis_offset_mean_luminance(),
    shadowClippingRatio:
        keepers._keepers_photo_analysis_offset_shadow_clipping_ratio(),
    highlightClippingRatio:
        keepers._keepers_photo_analysis_offset_highlight_clipping_ratio(),
    contrast: keepers._keepers_photo_analysis_offset_contrast(),
    differenceHash: keepers._keepers_photo_analysis_offset_difference_hash()
};

if (offsets.sharpness < pointerSizeBytes) {
    throw new Error("Unexpected size_t layout; smoke test assumes wasm32");
}

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

let pixelPointer = 0;
let outputPointer = 0;
let tinyPixelPointer = 0;

function requireStatus(actual, expected, description) {
    if (actual !== expected) {
        throw new Error(`${description}: expected ${expected}, got ${actual}`);
    }
}

function currentDataView() {
    return new DataView(keepers.HEAPU8.buffer);
}

function readAnalysis(pointer) {
    const view = currentDataView();

    return {
        id: view.getUint32(pointer + offsets.id, true),
        sharpness: view.getFloat64(pointer + offsets.sharpness, true),
        meanLuminance:
            view.getFloat64(pointer + offsets.meanLuminance, true),
        shadowClippingRatio:
            view.getFloat64(pointer + offsets.shadowClippingRatio, true),
        highlightClippingRatio:
            view.getFloat64(pointer + offsets.highlightClippingRatio, true),
        contrast: view.getFloat64(pointer + offsets.contrast, true),
        differenceHash:
            view.getBigUint64(pointer + offsets.differenceHash, true)
    };
}

function requireFiniteInRange(value, minimum, maximum, name) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error(`${name} is out of range: ${value}`);
    }
}

try {
    pixelPointer = keepers._keepers_allocate(pixels.byteLength);
    outputPointer = keepers._keepers_allocate(analysisSize);
    tinyPixelPointer = keepers._keepers_allocate(1);

    if (pixelPointer === 0 || outputPointer === 0 || tinyPixelPointer === 0) {
        throw new Error("WASM allocation failed");
    }

    keepers.HEAPU8.set(pixels, pixelPointer);
    keepers.HEAPU8[tinyPixelPointer] = 0;

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
        "null output"
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
        "unsupported channel count"
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
        "undersized pixel buffer"
    );

    console.log("Keepers WASM API version:", keepers._keepers_api_version());
    console.log("Keepers WASM analysis ID:", analysis.id);
    console.log("Keepers WASM difference hash:", analysis.differenceHash);
} finally {
    keepers._keepers_deallocate(pixelPointer);
    keepers._keepers_deallocate(outputPointer);
    keepers._keepers_deallocate(tinyPixelPointer);
}
