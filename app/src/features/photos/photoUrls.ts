import type { DecodedPhoto } from "./types";

export function revokePhotoUrl(photo: DecodedPhoto): void {
    URL.revokeObjectURL(photo.previewUrl);
}

export function revokePhotoUrls(photos: readonly DecodedPhoto[]): void {
    for (const photo of photos) {
        revokePhotoUrl(photo);
    }
}
