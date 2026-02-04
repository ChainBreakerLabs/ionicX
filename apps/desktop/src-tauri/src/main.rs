use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const APP_DATA_DIR_NAME: &str = "ionicX";
const RUNTIME_FILE: &str = "runtime.json";
static WINDOW_COUNT: AtomicUsize = AtomicUsize::new(0);

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<CommandChild>>,
    info: Mutex<Option<BackendInfo>>,
    data_dir: Mutex<Option<PathBuf>>,
}

#[derive(Clone, Serialize)]
struct BackendInfo {
    origin: String,
    #[serde(rename = "wsUrl")]
    ws_url: String,
    #[serde(rename = "logDir")]
    log_dir: String,
    #[serde(rename = "dataDir")]
    data_dir: String,
}

#[derive(Deserialize)]
struct RuntimeInfo {
    port: u16,
    addr: String,
    #[serde(rename = "appDataDir")]
    app_data_dir: String,
    #[serde(rename = "logDir")]
    log_dir: String,
}

fn log_to_file(data_dir: &Path, message: &str) {
    let log_dir = data_dir.join("logs");
    if fs::create_dir_all(&log_dir).is_err() {
        return;
    }
    let log_path = log_dir.join("tauri.log");
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(file, "[{}] {}", ts, message);
    }
}

#[tauri::command]
fn get_backend_info(app: tauri::AppHandle, state: tauri::State<BackendState>) -> Result<BackendInfo, String> {
    if let Some(info) = state.info.lock().unwrap().clone() {
        return Ok(info);
    }

    let data_dir = resolve_app_data_dir();
    if state.data_dir.lock().unwrap().is_none() {
        *state.data_dir.lock().unwrap() = Some(data_dir.clone());
    }
    log_to_file(&data_dir, "get_backend_info: starting backend resolution");

    ensure_sidecar(&app, &state, &data_dir)?;
    let runtime = wait_for_runtime_file(&data_dir)?;
    if let Err(err) = wait_for_health(runtime.port, Duration::from_secs(30)) {
        log_to_file(&data_dir, &format!("health check pending: {err}"));
        eprintln!("Backend health check pending: {err}");
    }

    let origin = format!("http://127.0.0.1:{}", runtime.port);
    let ws_url = format!("ws://127.0.0.1:{}/ws", runtime.port);

    let info = BackendInfo {
        origin,
        ws_url,
        log_dir: runtime.log_dir,
        data_dir: runtime.app_data_dir,
    };

    *state.info.lock().unwrap() = Some(info.clone());
    Ok(info)
}

#[tauri::command]
async fn open_external_live(
    app: tauri::AppHandle,
    label: Option<String>,
    url: Option<String>,
) -> Result<(), String> {
    let label = label.unwrap_or_else(|| {
        let id = WINDOW_COUNT.fetch_add(1, Ordering::SeqCst);
        format!("external-live-{id}")
    });
    let path = url.unwrap_or_else(|| "external-live".to_string());
    log_to_file(
        &resolve_app_data_dir(),
        &format!("open_external_live: label={} path={}", label, path),
    );

    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(path.into()))
        .title("Salida en vivo")
        .inner_size(1280.0, 720.0)
        .resizable(true)
        .focused(true)
        .center()
        .build()
        .map_err(|e| format!("No se pudo abrir External Live: {e}"))?;

    Ok(())
}

fn ensure_sidecar(
    app: &tauri::AppHandle,
    state: &tauri::State<BackendState>,
    data_dir: &Path,
) -> Result<(), String> {
    let mut guard = state.child.lock().unwrap();
    if guard.is_some() {
        log_to_file(data_dir, "ensure_sidecar: backend already running");
        return Ok(());
    }

    let runtime_path = data_dir.join(RUNTIME_FILE);
    if runtime_path.exists() {
        if let Err(err) = fs::remove_file(&runtime_path) {
            log_to_file(
                data_dir,
                &format!("ensure_sidecar: failed to remove stale runtime.json: {err}"),
            );
        } else {
            log_to_file(data_dir, "ensure_sidecar: removed stale runtime.json");
        }
    }

    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    log_to_file(
        data_dir,
        &format!(
            "ensure_sidecar: spawning backend APP_DATA_DIR={} LOG_LEVEL={} PORT=0",
            data_dir.to_string_lossy(),
            log_level
        ),
    );
    if let Ok(path) = resolve_sidecar_path("ionicx-api") {
        log_to_file(data_dir, &format!("ensure_sidecar: resolved sidecar path {}", path.display()));
        if !path.exists() {
            log_to_file(data_dir, "ensure_sidecar: sidecar binary missing");
        }
    }

    let mut cmd = app
        .shell()
        .sidecar("ionicx-api")
        .map_err(|e| format!("No se pudo preparar el backend: {e}"))?;
    cmd = cmd.env("APP_DATA_DIR", data_dir.to_string_lossy().to_string());
    cmd = cmd.env("PORT", "0");
    cmd = cmd.env("LOG_LEVEL", log_level);
    cmd = cmd.env("CORS_ALLOW_ALL", "0");

    let (mut rx, child) = cmd.spawn().map_err(|e| {
        log_to_file(data_dir, &format!("ensure_sidecar: spawn failed: {e}"));
        format!("No se pudo iniciar el backend: {e}")
    })?;
    log_to_file(data_dir, "ensure_sidecar: spawn ok");

    let app_handle = app.clone();
    let log_dir = data_dir.to_path_buf();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    println!("{}", text);
                    log_to_file(&log_dir, &format!("sidecar stdout: {}", text.trim_end()));
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    eprintln!("{}", text);
                    log_to_file(&log_dir, &format!("sidecar stderr: {}", text.trim_end()));
                }
                CommandEvent::Error(err) => {
                    eprintln!("sidecar error: {err}");
                    log_to_file(&log_dir, &format!("sidecar error: {err}"));
                    let state = app_handle.state::<BackendState>();
                    clear_backend_state(&state);
                }
                CommandEvent::Terminated(_) => {
                    log_to_file(&log_dir, "sidecar terminated");
                    let state = app_handle.state::<BackendState>();
                    clear_backend_state(&state);
                }
                _ => {}
            }
        }
    });

    *guard = Some(child);
    Ok(())
}

fn clear_backend_state(state: &BackendState) {
    *state.child.lock().unwrap() = None;
    *state.info.lock().unwrap() = None;
}

fn resolve_sidecar_path(command: &str) -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "current exe has no parent".to_string())?;

    let base_dir = if exe_dir
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name == "deps")
        .unwrap_or(false)
    {
        exe_dir.parent().unwrap_or(exe_dir)
    } else {
        exe_dir
    };

    let mut command_path = base_dir.join(command);

    #[cfg(windows)]
    {
        if command_path.extension().is_none() {
            command_path.set_extension("exe");
        }
    }

    #[cfg(not(windows))]
    {
        if command_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext == "exe")
            .unwrap_or(false)
        {
            command_path.set_extension("");
        }
    }

    Ok(command_path)
}

fn resolve_app_data_dir() -> PathBuf {
    if let Ok(value) = std::env::var("APP_DATA_DIR") {
        if !value.trim().is_empty() {
            return PathBuf::from(value);
        }
    }

    if cfg!(target_os = "windows") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join(APP_DATA_DIR_NAME);
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            return PathBuf::from(profile).join(APP_DATA_DIR_NAME);
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        if cfg!(target_os = "macos") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join(APP_DATA_DIR_NAME);
        }

        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            return PathBuf::from(xdg).join(APP_DATA_DIR_NAME);
        }

        return PathBuf::from(home)
            .join(".local")
            .join("share")
            .join(APP_DATA_DIR_NAME);
    }

    std::env::temp_dir().join(APP_DATA_DIR_NAME)
}

fn wait_for_runtime_file(data_dir: &Path) -> Result<RuntimeInfo, String> {
    let runtime_path = data_dir.join(RUNTIME_FILE);
    let start = Instant::now();
    let timeout = Duration::from_secs(45);
    log_to_file(data_dir, "wait_for_runtime_file: waiting for runtime.json");

    while start.elapsed() < timeout {
        if runtime_path.exists() {
            let content =
                fs::read_to_string(&runtime_path).map_err(|e| format!("No se pudo leer runtime: {e}"))?;
            let info: RuntimeInfo =
                serde_json::from_str(&content).map_err(|e| format!("Runtime inválido: {e}"))?;
            if info.port > 0 {
                log_to_file(
                    data_dir,
                    &format!("wait_for_runtime_file: runtime loaded port={}", info.port),
                );
                return Ok(info);
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    log_to_file(data_dir, "wait_for_runtime_file: timeout");
    Err("El backend no entregó información de puerto.".to_string())
}

fn wait_for_health(port: u16, timeout: Duration) -> Result<(), String> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if health_check(port).is_ok() {
            log_to_file(
                &resolve_app_data_dir(),
                &format!("wait_for_health: backend healthy on port {port}"),
            );
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err("El backend no respondió a /health.".to_string())
}

fn health_check(port: u16) -> Result<(), String> {
    let addr = format!("127.0.0.1:{port}");
    let mut stream = TcpStream::connect(addr).map_err(|_| "connect failed".to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "timeout failed".to_string())?;
    let request = b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    stream
        .write_all(request)
        .map_err(|_| "write failed".to_string())?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|_| "read failed".to_string())?;
    if response.contains("200 OK") {
        Ok(())
    } else {
        Err("unhealthy".to_string())
    }
}

fn try_shutdown_backend(state: &BackendState) {
    let info = state.info.lock().unwrap().clone();
    let Some(info) = info else { return };

    if let Some(data_dir) = state.data_dir.lock().unwrap().clone() {
        log_to_file(&data_dir, "try_shutdown_backend: shutting down");
    }

    if let Some(port) = extract_port(&info.origin) {
        let _ = send_shutdown(port);
    }

    if let Some(child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    }
}

fn extract_port(origin: &str) -> Option<u16> {
    origin
        .rsplit_once(':')
        .and_then(|(_, port)| port.parse::<u16>().ok())
}

fn send_shutdown(port: u16) -> Result<(), String> {
    let addr = format!("127.0.0.1:{port}");
    let mut stream = TcpStream::connect(addr).map_err(|_| "connect failed".to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "timeout failed".to_string())?;
    let request = b"POST /api/ionicx/shutdown HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    stream
        .write_all(request)
        .map_err(|_| "write failed".to_string())?;
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .manage(BackendState::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_backend_info, open_external_live])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit { .. }) {
            let state = app_handle.state::<BackendState>();
            try_shutdown_backend(&state);
        }
    });
}
