# ionicX Desktop (Tauri + Go)

Este documento describe cómo ejecutar y empaquetar `ionicX` como aplicación de escritorio con Tauri y el backend Go como sidecar.

**Requisitos**
- Node.js 20+
- Go 1.21+
- Rust toolchain estable
- Dependencias Tauri (Linux):
  - `libwebkit2gtk-4.1-dev`
  - `libayatana-appindicator3-dev`
  - `librsvg2-dev`
  - `patchelf`

**Estructura**
- `ionic-x/`: frontend React (Vite).
- `ionic-x-ms/`: backend Go (API + SQLite).
- `desktop/`: wrapper Tauri.

**Rutas de datos por OS (default)**
- macOS: `~/Library/Application Support/ionicX/`
- Windows: `%APPDATA%\\ionicX\\`
- Linux: `~/.local/share/ionicX/`

**Variables de entorno del backend**
- `APP_DATA_DIR`: ruta base para DB y logs (default según OS).
- `PORT`: puerto HTTP (`0` para dinámico).
- `LOG_LEVEL`: `debug|info|warn|error` (default `info`).

## Desarrollo

**Web (frontend + backend manual)**
1. `cd ionic-x-ms`
2. `go run ./cmd`
3. `cd ../ionic-x`
4. `npm run dev`

**Desktop (Tauri + sidecar)**
1. `cd ionic-x`
2. `npm run dev`
3. En otra terminal: `npm run tauri dev`

> `npm run tauri dev` delega a `desktop/` y levanta el sidecar Go con puerto dinámico.

## Build

**Backend**
```bash
scripts/build-backend.sh
```

**Desktop (todo en uno)**
```bash
scripts/build-desktop.sh
```

**Fuentes embebidas (50 familias)**
```bash
python3 scripts/fetch-fonts.py
```
Esto descarga las fuentes a `ionic-x/public/fonts/` y genera `ionic-x/src/fonts.css` y `ionic-x/src/constants/fontOptions.ts`.

Los instaladores se generan en:
```
desktop/src-tauri/target/release/bundle/
```

## Troubleshooting

**La app no conecta al backend**
- Revisa los logs en:
  - macOS: `~/Library/Application Support/ionicX/logs/ionicx.log`
  - Windows: `%APPDATA%\\ionicX\\logs\\ionicx.log`
  - Linux: `~/.local/share/ionicX/logs/ionicx.log`
- El backend escribe `runtime.json` en el directorio de datos con el puerto real.

**Base de datos**
- Archivo: `<APP_DATA_DIR>/app.db`
- Migraciones embebidas, se ejecutan al iniciar.

**Falla `bundle_dmg.sh` (macOS)**
- Asegura tener Xcode Command Line Tools (`xcode-select --install`).
- Ejecuta el build desde una sesión con UI (no headless) y permite a la terminal controlar Finder/Automation si macOS lo solicita.
- Fallback manual de DMG (sin AppleScript):
  ```bash
  scripts/build-dmg-simple.sh
  ```

## Notas
- No se usa Docker.
- El backend nunca escribe dentro del bundle de la app.
- El puerto es dinámico en desktop (`PORT=0`).
- Windows: el instalador incluye el runtime de WebView2 (modo `offlineInstaller`), no requiere descargas ni instalación previa del usuario.
- Linux: AppImage es la opción más “portable”, pero aún depende de librerías del sistema (ej. glibc/GTK).
