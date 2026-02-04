#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${ROOT_DIR}/apps/desktop/src-tauri/target/release/bundle/macos/ionicX.app"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found at ${APP_PATH}"
  exit 1
fi

VERSION="$(python3 - <<'PY'
import json
with open("apps/desktop/src-tauri/tauri.conf.json", "r", encoding="utf-8") as f:
    print(json.load(f).get("version", "0.1.0"))
PY
)"

ARCH="$(uname -m)"
case "${ARCH}" in
  arm64) ARCH="aarch64" ;;
  x86_64) ARCH="x86_64" ;;
esac

OUT_DIR="${ROOT_DIR}/apps/desktop/src-tauri/target/release/bundle/dmg"
mkdir -p "${OUT_DIR}"

DMG_PATH="${OUT_DIR}/ionicX_${VERSION}_${ARCH}_simple.dmg"

echo "Creating simple DMG at ${DMG_PATH}"
hdiutil create -volname "ionicX" -srcfolder "${APP_PATH}" -ov -format UDZO "${DMG_PATH}"

echo "Simple DMG created."
