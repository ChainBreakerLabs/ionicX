#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Building backend..."
"${ROOT_DIR}/scripts/build-backend.sh"

echo "Building frontend..."
(cd "${ROOT_DIR}/apps/web" && npm run build)

echo "Building desktop bundle..."
(cd "${ROOT_DIR}/apps/desktop" && npm run tauri build)

echo "Desktop build complete."
