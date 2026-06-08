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

export interface RejectedFile {
    name: string;
    reason: string;
}
