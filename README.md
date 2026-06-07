# BurstPick

BurstPick is a browser-based photo burst analyzer that will help users group similar burst photos and choose the strongest shot from each group.

Photo analysis is planned to run locally in the browser using a C++ image-processing engine compiled to WebAssembly.

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

BurstPick is in its initial setup stage. Photo analysis features are not implemented yet.
