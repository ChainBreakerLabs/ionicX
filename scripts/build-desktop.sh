#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Building backend..."
"${ROOT_DIR}/scripts/build-backend.sh"

echo "Building frontend..."
(cd "${ROOT_DIR}/ionic-x" && npm run build)

echo "Building desktop bundle..."
if ! (cd "${ROOT_DIR}/desktop" && npm run tauri build); then
  echo "Tauri build failed. Attempting DMG fallback..."
  "${ROOT_DIR}/scripts/build-dmg-simple.sh"
fi

echo "Desktop build complete."
