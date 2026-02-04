#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/apps/web"
BACKEND_DIR="${ROOT_DIR}/services/api"
TOOLS_DIR="${ROOT_DIR}/.tools"
PORT_CLEANUP="${PORT_CLEANUP:-3000}"

cleanup_port() {
  local pids
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  pids="$(lsof -tiTCP:"${PORT_CLEANUP}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "${pids}" ]; then
    return 0
  fi

  kill ${pids} >/dev/null 2>&1 || true
  sleep 0.5
  pids="$(lsof -tiTCP:"${PORT_CLEANUP}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

cleanup() {
  cleanup_port
}

trap cleanup INT TERM EXIT

bootstrap_go() {
  local current_version
  current_version="$(go version | awk '{print $3}' | sed 's/^go//')"
  local os arch url tarball toolchain_dir
  os="$(uname | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "${arch}" in
    x86_64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
  esac
  toolchain_dir="${TOOLS_DIR}/go${current_version}"
  if [ ! -x "${toolchain_dir}/bin/go" ]; then
    mkdir -p "${TOOLS_DIR}"
    tarball="${TOOLS_DIR}/go${current_version}.${os}-${arch}.tar.gz"
    url="https://go.dev/dl/go${current_version}.${os}-${arch}.tar.gz"
    echo "Downloading Go toolchain ${current_version}..."
    curl -L "${url}" -o "${tarball}"
    tar -C "${TOOLS_DIR}" -xzf "${tarball}"
    rm -f "${tarball}"
    mv "${TOOLS_DIR}/go" "${toolchain_dir}"
  fi

  export GOROOT="${toolchain_dir}"
  export PATH="${GOROOT}/bin:${PATH}"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd go
require_cmd curl
require_cmd lsof

bootstrap_go

if [ "${SKIP_FRONTEND:-}" != "1" ]; then
  require_cmd npm
  if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
    npm --prefix "${FRONTEND_DIR}" ci
  fi
  npm --prefix "${FRONTEND_DIR}" run build
fi

mkdir -p "${BACKEND_DIR}/dist/db"

(
  cd "${BACKEND_DIR}"
  go run ./tools/pg_to_sqlite --source migrations --sqlite "${BACKEND_DIR}/dist/db/bible.sqlite"
)

(
  cd "${BACKEND_DIR}"
  SQLITE_PATH="${BACKEND_DIR}/dist/db/bible.sqlite" \
  STATIC_DIR="${FRONTEND_DIR}/dist" \
  HTTP_ADDR=127.0.0.1:3000 \
  OPEN_BROWSER=1 \
  go run ./cmd
)
