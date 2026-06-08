# Keepers

Keepers is a local-first browser application that helps users identify the strongest photos from a burst of similar shots. Its image-analysis engine is written in C++ and will be compiled to WebAssembly for in-browser processing.

## Repository Structure

- `app/` contains the Vite React TypeScript frontend.
- `engine/` contains the native C++ image-processing engine library and tests.

## Native Engine Development

Configure, build, and test the native C++ engine:

```bash
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
```

Build without tests:

```bash
cmake -S . -B build-no-tests -DBUILD_TESTING=OFF
cmake --build build-no-tests
```

## WebAssembly Build

The WebAssembly build requires an installed and activated Emscripten SDK with
`emcmake` available in `PATH`.

Use the helper script:

```bash
./scripts/build-wasm.sh
```

Equivalent commands:

```bash
emcmake cmake \
    -S . \
    -B build-wasm \
    -DBUILD_TESTING=OFF \
    -DCMAKE_BUILD_TYPE=Release

cmake --build build-wasm --target keepers_wasm
```

The generated module exposes a narrow C ABI. The current browser-facing API
supports heap allocation, per-photo analysis of tightly packed RGB/RGBA pixel
buffers, similarity grouping over precomputed hashes, within-group quality
ranking over precomputed raw metrics, and explicit status codes. Grouping and
ranking use caller-allocated input and output buffers with size-query calls for
determining result capacity.

Run the Node smoke test against a built module:

```bash
node scripts/smoke-test-wasm.mjs build-wasm/wasm/keepers.mjs
```

The generated `keepers.mjs` and `keepers.wasm` artifacts remain inside the
ignored build directory and are not committed. The frontend is not integrated
with the WebAssembly module yet.

## Development Status

The native C++ engine currently supports validated RGB/RGBA image views, grayscale conversion, Laplacian-variance sharpness scoring, and exposure and percentile-contrast metrics.
