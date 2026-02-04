#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/services/api"
OUT_DIR="${ROOT_DIR}/apps/desktop/src-tauri/bin"

mkdir -p "${OUT_DIR}"

GOOS_VALUE="${GOOS:-$(go env GOOS)}"
GOARCH_VALUE="${GOARCH:-$(go env GOARCH)}"

TARGET_TRIPLE=""
case "${GOOS_VALUE}" in
  darwin)
    if [[ "${GOARCH_VALUE}" == "arm64" ]]; then
      TARGET_TRIPLE="aarch64-apple-darwin"
    else
      TARGET_TRIPLE="x86_64-apple-darwin"
    fi
    ;;
  linux)
    if [[ "${GOARCH_VALUE}" == "arm64" ]]; then
      TARGET_TRIPLE="aarch64-unknown-linux-gnu"
    else
      TARGET_TRIPLE="x86_64-unknown-linux-gnu"
    fi
    ;;
  windows)
    if [[ "${GOARCH_VALUE}" == "arm64" ]]; then
      TARGET_TRIPLE="aarch64-pc-windows-msvc"
    else
      TARGET_TRIPLE="x86_64-pc-windows-msvc"
    fi
    ;;
esac

OUTPUT_BASE="ionic-x-ms"
OUTPUT_NAME="${OUTPUT_BASE}"
OUTPUT_NAME_WITH_TARGET="${OUTPUT_BASE}-${TARGET_TRIPLE}"

if [[ "${GOOS_VALUE}" == "windows" ]]; then
  OUTPUT_NAME="${OUTPUT_NAME}.exe"
  OUTPUT_NAME_WITH_TARGET="${OUTPUT_NAME_WITH_TARGET}.exe"
fi

echo "Building backend (${GOOS_VALUE}/${GOARCH_VALUE})..."
(
  cd "${BACKEND_DIR}"
  CGO_ENABLED=0 GOOS="${GOOS_VALUE}" GOARCH="${GOARCH_VALUE}" go build -o "${OUT_DIR}/${OUTPUT_NAME_WITH_TARGET}" ./cmd
)

cp "${OUT_DIR}/${OUTPUT_NAME_WITH_TARGET}" "${OUT_DIR}/${OUTPUT_NAME}"

echo "Backend built at ${OUT_DIR}/${OUTPUT_NAME_WITH_TARGET}"
