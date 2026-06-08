#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/.." && pwd)"

module_source="$repository_root/build-wasm/wasm/keepers.mjs"
wasm_source="$repository_root/build-wasm/wasm/keepers.wasm"
destination_directory="$repository_root/app/src/wasm/generated"
module_destination="$destination_directory/keepers.mjs"
wasm_destination="$destination_directory/keepers.wasm"

if [[ ! -f "$module_source" ]]; then
    echo "Missing Keepers WASM module: $module_source" >&2
    echo "Run ./scripts/build-wasm.sh before copying frontend artifacts." >&2
    exit 1
fi

if [[ ! -f "$wasm_source" ]]; then
    echo "Missing Keepers WASM binary: $wasm_source" >&2
    echo "Run ./scripts/build-wasm.sh before copying frontend artifacts." >&2
    exit 1
fi

mkdir -p "$destination_directory"
cp "$module_source" "$module_destination"
cp "$wasm_source" "$wasm_destination"

echo "Copied Keepers WASM module to $module_destination"
echo "Copied Keepers WASM binary to $wasm_destination"
