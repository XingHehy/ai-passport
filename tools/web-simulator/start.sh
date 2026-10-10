#!/usr/bin/env bash
set -euo pipefail
simulator_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
workspace_dir="$(cd -- "${simulator_dir}/../../.." && pwd)"
if ! command -v emcmake >/dev/null 2>&1; then
    simulator_sdk="${EMSDK:-${workspace_dir}/.development/emsdk}"
    if [[ ! -f "${simulator_sdk}/emsdk_env.sh" ]]; then
        echo "Emscripten is missing; activate your SDK or set EMSDK to its directory." >&2
        exit 1
    fi
    export EMSDK_QUIET=1
    source "${simulator_sdk}/emsdk_env.sh"
fi
exec python3 "${simulator_dir}/run.py" "$@"
