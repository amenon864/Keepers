import type { DecodedPhoto } from "./types";

export async function decodePhotoFile(
    id: number,
    file: File
): Promise<DecodedPhoto> {
    const imageBitmap = await createImageBitmapWithOrientation(file);
    const previewUrl = URL.createObjectURL(file);

    try {
        const imageData = readImageData(imageBitmap);
        const pixels = new Uint8Array(imageData.data);

        return {
            id,
            file,
            name: file.name,
            width: imageData.width,
            height: imageData.height,
            channels: 4,
            pixels,
            previewUrl
        };
    } catch (error) {
        URL.revokeObjectURL(previewUrl);
        throw error;
    } finally {
        imageBitmap.close();
    }
}

async function createImageBitmapWithOrientation(
    file: File
): Promise<ImageBitmap> {
    try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        return createImageBitmap(file);
    }
}

function readImageData(imageBitmap: ImageBitmap): ImageData {
    const canvas = createCanvas(imageBitmap.width, imageBitmap.height);
    const context = canvas.getContext("2d", {
        willReadFrequently: true
    }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (context === null) {
        throw new Error("This browser could not create a 2D canvas context.");
    }

    context.drawImage(imageBitmap, 0, 0);
    return context.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
}

function createCanvas(
    width: number,
    height: number
): OffscreenCanvas | HTMLCanvasElement {
    if ("OffscreenCanvas" in globalThis) {
        return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
