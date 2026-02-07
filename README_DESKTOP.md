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
- `apps/web/`: frontend React (Vite).
- `services/api/`: backend Go (API + SQLite).
- `apps/desktop/`: wrapper Tauri.

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
1. `cd services/api`
2. `go run ./cmd`
3. `cd ../../apps/web`
4. `npm run dev`

**Desktop (Tauri + sidecar)**
1. `cd apps/web`
2. `npm run dev`
3. En otra terminal: `npm run tauri dev`

> `npm run tauri dev` delega a `apps/desktop/` y levanta el sidecar Go con puerto dinámico.

## Build

**Backend**
```bash
scripts/build-backend.sh
```

**Desktop (todo en uno)**
```bash
scripts/build-desktop.sh
```
> Este comando ahora falla si Tauri no puede generar el bundle oficial.  
> Ya no hace fallback automático a DMG simple para evitar publicar instaladores defectuosos.

**Release macOS (firmado y notarizado)**
- Configura estos secretos en GitHub Actions:
  - `APPLE_CERTIFICATE` (contenido base64 del certificado `.p12` Developer ID Application)
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_API_KEY` (Key ID de App Store Connect)
  - `APPLE_API_ISSUER` (Issuer ID de App Store Connect)
  - `APPLE_API_KEY_P8` (contenido del archivo `AuthKey_XXXX.p8`)
- El workflow valida que existan esos secretos, firma/notariza el build y verifica cada `.dmg` con `hdiutil verify` y `xcrun stapler validate` antes de publicarlo.
- El workflow fuerza el layout de DMG en CI con `TAURI_BUNDLER_DMG_IGNORE_CI=true` para evitar ventanas gigantes sin posicionamiento de íconos.

**Fuentes embebidas (50 familias)**
```bash
python3 scripts/fetch-fonts.py
```
Esto descarga las fuentes a `apps/web/public/fonts/` y genera `apps/web/src/fonts.css` y `apps/web/src/constants/fontOptions.ts`.

Los instaladores se generan en:
```
apps/desktop/src-tauri/target/release/bundle/
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
- Fallback manual de DMG (sin AppleScript, solo pruebas locales):
  ```bash
  ALLOW_SIMPLE_DMG_FALLBACK=1 scripts/build-dmg-simple.sh
  ```
  No distribuir ese artefacto: no es equivalente al instalador de release.

## Notas
- No se usa Docker.
- El backend nunca escribe dentro del bundle de la app.
- El puerto es dinámico en desktop (`PORT=0`).
- Windows: el instalador incluye el runtime de WebView2 (modo `offlineInstaller`), no requiere descargas ni instalación previa del usuario.
- Linux: AppImage es la opción más “portable”, pero aún depende de librerías del sistema (ej. glibc/GTK).
