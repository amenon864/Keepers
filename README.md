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

## Development Status

The native C++ engine currently supports validated RGB/RGBA image views, grayscale conversion, Laplacian-variance sharpness scoring, and exposure and percentile-contrast metrics.
