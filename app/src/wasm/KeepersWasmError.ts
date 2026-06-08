const keepersStatusNames = new Map<number, string>([
    [0, "OK"],
    [1, "INVALID_ARGUMENT"],
    [2, "OVERFLOW"],
    [3, "ALLOCATION_FAILURE"],
    [4, "INTERNAL_ERROR"],
    [5, "INSUFFICIENT_CAPACITY"]
]);

const keepersStatusDescriptions = new Map<number, string>([
    [0, "operation completed successfully"],
    [1, "an invalid argument was passed to the native WebAssembly API"],
    [2, "the native WebAssembly API detected an arithmetic overflow"],
    [3, "the native WebAssembly API could not allocate memory"],
    [4, "the native WebAssembly API failed internally"],
    [5, "the provided output buffer capacity was too small"]
]);

export class KeepersWasmError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "KeepersWasmError";
        this.status = status;
    }
}

export function keepersStatusMessage(status: number): string {
    const name = keepersStatusNames.get(status);
    const description = keepersStatusDescriptions.get(status);

    if (name !== undefined && description !== undefined) {
        return `${name}: ${description}`;
    }

    return `UNKNOWN_STATUS: native WebAssembly API returned unrecognized status ${status}`;
}

export function throwIfKeepersStatusFailed(
    status: number,
    operation: string
): void {
    if (status === 0) {
        return;
    }

    throw new KeepersWasmError(
        status,
        `${operation} failed with ${keepersStatusMessage(status)}`
    );
}
