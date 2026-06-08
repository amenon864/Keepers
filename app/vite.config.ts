import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const appRoot = dirname(fileURLToPath(import.meta.url))
const generatedFileNames = ['keepers.mjs', 'keepers.wasm'] as const

function copyKeepersWasmPlugin(): Plugin {
    return {
        name: 'copy-keepers-wasm',
        apply: 'build',
        closeBundle() {
            const sourceDirectory = resolve(appRoot, 'src/wasm/generated')
            const destinationDirectory = resolve(appRoot, 'dist/assets/generated')
            const sourcePaths = generatedFileNames.map((fileName) => {
                return resolve(sourceDirectory, fileName)
            })
            const existingSourcePaths = sourcePaths.filter((sourcePath) => {
                return existsSync(sourcePath)
            })

            if (existingSourcePaths.length === 0) {
                return
            }

            if (existingSourcePaths.length !== sourcePaths.length) {
                throw new Error(
                    'Keepers WASM frontend artifacts are incomplete. Run npm run wasm:build or npm run wasm:copy.'
                )
            }

            mkdirSync(destinationDirectory, { recursive: true })

            generatedFileNames.forEach((fileName, index) => {
                copyFileSync(
                    sourcePaths[index],
                    resolve(destinationDirectory, fileName)
                )
            })
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), copyKeepersWasmPlugin()],
})
