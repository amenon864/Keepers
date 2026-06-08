#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/.." && pwd)"

emcmake cmake \
    -S "$repository_root" \
    -B "$repository_root/build-wasm" \
    -DBUILD_TESTING=OFF \
    -DCMAKE_BUILD_TYPE=Release

cmake \
    --build "$repository_root/build-wasm" \
    --target keepers_wasm

module_path="$repository_root/build-wasm/wasm/keepers.mjs"

if command -v node >/dev/null 2>&1; then
    node "$repository_root/scripts/smoke-test-wasm.mjs" "$module_path"
else
    echo "Node.js not found; run this smoke test after installing Node:"
    echo "node \"$repository_root/scripts/smoke-test-wasm.mjs\" \"$module_path\""
fi
