# Architecture (ionicX Desktop)

## Overview

```
┌───────────────┐           ┌──────────────────┐           ┌─────────────────────┐
│ React (Vite)  │  HTTP/WS  │ Tauri (Rust host)│  Sidecar │ Go API (Echo + SQLite)│
│ apps/web/     │──────────▶│ apps/desktop/    │──────────▶│ services/api/        │
└───────────────┘           └──────────────────┘           └─────────────────────┘
         ▲                           │                                 │
         │                           │                                 ▼
         │                           │                       <APP_DATA_DIR>/app.db
         │                           │                       <APP_DATA_DIR>/logs/
         │                           │
         │                   runtime.json (port)
         │
         └──────── UI waits for /health OK ─────────────────────────────┘
```

## Runtime Flow

1. Tauri inicia `services/api` como sidecar con `PORT=0` y `APP_DATA_DIR` por OS.
2. El backend escribe `runtime.json` con el puerto real y rutas de datos.
3. El frontend solicita `get_backend_info`, obtiene el puerto y hace `GET /health`.
4. Si `/health` responde `200`, la UI se habilita; si falla, se muestra el estado y la ruta de logs.
5. Al cerrar la app, Tauri envía `/shutdown` y finaliza el proceso.

## Data & Migrations

- SQLite vive en `<APP_DATA_DIR>/app.db`.
- Migraciones SQL están embebidas en el binario Go y se ejecutan al iniciar.
- WAL + `busy_timeout` habilitados para mejor concurrencia local.

## Logging

- Logs persistidos en `<APP_DATA_DIR>/logs/ionicx.log`.
- Errores críticos se reflejan en la UI con la ruta del log.
