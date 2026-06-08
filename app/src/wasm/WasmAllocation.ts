import type { KeepersWasmModule } from "./keepers-module";

const maximumWasm32SizeT = 0xffffffff;

export class WasmAllocation {
    readonly pointer: number;
    readonly size: number;

    private readonly module: KeepersWasmModule;
    private freed = false;

    constructor(module: KeepersWasmModule, size: number) {
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new RangeError(`WASM allocation size must be a non-negative safe integer: ${size}`);
        }

        if (size > maximumWasm32SizeT) {
            throw new RangeError(`WASM allocation size exceeds the wasm32 size_t limit: ${size}`);
        }

        this.module = module;
        this.size = size;
        this.pointer = module._keepers_allocate(size);

        if (size > 0 && this.pointer === 0) {
            throw new Error(`Keepers WASM allocation failed for ${size} bytes`);
        }
    }

    free(): void {
        if (this.freed) {
            return;
        }

        this.freed = true;

        if (this.pointer !== 0) {
            this.module._keepers_deallocate(this.pointer);
        }
    }
}
