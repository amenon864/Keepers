import type {
    CreateKeepersModule,
    KeepersWasmModule
} from "./keepers-module";

interface GeneratedKeepersModule {
    default: CreateKeepersModule;
}

export async function loadKeepersModule(): Promise<KeepersWasmModule> {
    const generatedModuleUrl = new URL(
        "./generated/keepers.mjs",
        import.meta.url
    ).href;

    try {
        const generatedModule = await import(
            /* @vite-ignore */ generatedModuleUrl
        ) as GeneratedKeepersModule;

        return await generatedModule.default({
            locateFile(path: string): string {
                if (path.endsWith(".wasm")) {
                    return new URL(
                        "./generated/keepers.wasm",
                        import.meta.url
                    ).href;
                }

                return path;
            }
        });
    } catch (error) {
        throw new Error(
            "Unable to load Keepers WASM artifacts. Run npm run wasm:build or npm run wasm:copy before using browser WASM functionality.",
            { cause: error }
        );
    }
}
