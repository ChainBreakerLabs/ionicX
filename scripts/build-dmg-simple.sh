#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${ROOT_DIR}/apps/desktop/src-tauri/target/release/bundle/macos/ionicX.app"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found at ${APP_PATH}"
  exit 1
fi

if [[ "${ALLOW_SIMPLE_DMG_FALLBACK:-0}" != "1" ]]; then
  echo "Refusing to build a simple DMG by default."
  echo "This artifact is only for local testing and should not be distributed."
  echo "If you really need it, run: ALLOW_SIMPLE_DMG_FALLBACK=1 scripts/build-dmg-simple.sh"
  exit 1
fi

VERSION="$(node -e "
const fs = require('fs');
const p = '${ROOT_DIR}/apps/desktop/src-tauri/tauri.conf.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
process.stdout.write(c.version || '0.1.0');
")"

ARCH="$(uname -m)"
case "${ARCH}" in
  arm64) ARCH="aarch64" ;;
  x86_64) ARCH="x86_64" ;;
esac

OUT_DIR="${ROOT_DIR}/apps/desktop/src-tauri/target/release/bundle/dmg"
mkdir -p "${OUT_DIR}"

DMG_PATH="${OUT_DIR}/ionicX_${VERSION}_${ARCH}_simple.dmg"
STAGING_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGING_DIR}"
}
trap cleanup EXIT

cp -R "${APP_PATH}" "${STAGING_DIR}/"
ln -s /Applications "${STAGING_DIR}/Applications"

echo "Creating simple DMG at ${DMG_PATH}"
hdiutil create -volname "ionicX" -srcfolder "${STAGING_DIR}" -ov -format UDZO "${DMG_PATH}"

echo "Simple DMG created."
