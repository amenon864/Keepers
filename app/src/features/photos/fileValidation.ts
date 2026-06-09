import type { FileRejection } from "./types";

export const maximumPhotoCount = 50;
export const maximumPhotoFileSizeBytes = 30 * 1024 * 1024;
export const acceptedImageMimePrefix = "image/";

export interface AcceptedPhotoFile {
    id: number;
    file: File;
}

export interface ValidatedPhotoFiles {
    accepted: AcceptedPhotoFile[];
    rejected: FileRejection[];
}

export class SessionPhotoIdAllocator {
    private nextId = 0;

    allocate(): number {
        const id = this.nextId;

        if (!Number.isSafeInteger(id)) {
            throw new RangeError("Photo ID counter exceeded safe integer range");
        }

        this.nextId += 1;
        return id;
    }
}

export function validatePhotoFiles(
    files: readonly File[],
    allocateId: () => number,
    currentPhotoCount = 0
): ValidatedPhotoFiles {
    const accepted: AcceptedPhotoFile[] = [];
    const rejected: FileRejection[] = [];
    let availableSlots = Math.max(0, maximumPhotoCount - currentPhotoCount);

    for (const file of files) {
        if (!file.type.startsWith(acceptedImageMimePrefix)) {
            rejected.push({
                name: file.name,
                reason: "Only browser-decodable image files are supported."
            });
            continue;
        }

        if (file.size > maximumPhotoFileSizeBytes) {
            rejected.push({
                name: file.name,
                reason: `File is larger than ${formatBytes(maximumPhotoFileSizeBytes)}.`
            });
            continue;
        }

        if (availableSlots <= 0) {
            rejected.push({
                name: file.name,
                reason: `Selection is limited to ${maximumPhotoCount} photos.`
            });
            continue;
        }

        accepted.push({ id: allocateId(), file });
        availableSlots -= 1;
    }

    return { accepted, rejected };
}

function formatBytes(bytes: number): string {
    const mib = bytes / (1024 * 1024);
    return `${mib.toLocaleString(undefined, {
        maximumFractionDigits: 0
    })} MiB`;
}
