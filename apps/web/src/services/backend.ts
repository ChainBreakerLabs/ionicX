export type BackendInfo = {
  origin: string;
  wsUrl: string;
  logDir?: string;
  dataDir?: string;
};

export const API_PATH_PREFIX = "/api/ionic-x-ms";

const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:3000";

const envOrigin = import.meta.env.VITE_BACKEND_ORIGIN as string | undefined;
const windowOrigin =
  typeof window !== "undefined" && window.location
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

const isTauriRuntime =
  typeof window !== "undefined" &&
  ((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined ||
    (window as typeof window & { __TAURI__?: unknown }).__TAURI__ !== undefined);

let cachedBackendInfo: Promise<BackendInfo> | null = null;

function toWsUrl(origin: string) {
  if (origin.startsWith("https://")) {
    return origin.replace("https://", "wss://");
  }
  return origin.replace("http://", "ws://");
}

export async function getBackendInfo(): Promise<BackendInfo> {
  if (cachedBackendInfo) {
    return cachedBackendInfo;
  }

  cachedBackendInfo = (async () => {
    if (isTauriRuntime) {
      const win = window as typeof window & {
        __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<BackendInfo> } };
        __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<BackendInfo> };
      };
      const invoke =
        win.__TAURI__?.core?.invoke ??
        (win.__TAURI__ as { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<BackendInfo> } | undefined)
          ?.invoke ??
        win.__TAURI_INTERNALS__?.invoke;
      if (!invoke) {
        throw new Error("Tauri runtime no disponible.");
      }
      return await invoke("get_backend_info");
    }

    const origin = envOrigin || windowOrigin || DEFAULT_BACKEND_ORIGIN;
    return {
      origin,
      wsUrl: `${toWsUrl(origin)}/ws`,
    };
  })().catch((error) => {
    cachedBackendInfo = null;
    throw error;
  });

  return cachedBackendInfo;
}

export function resetBackendInfoCache() {
  cachedBackendInfo = null;
}

export async function getBackendOrigin(): Promise<string> {
  const info = await getBackendInfo();
  return info.origin;
}

export async function getWsUrl(): Promise<string> {
  const info = await getBackendInfo();
  return info.wsUrl;
}

export function isTauri(): boolean {
  return isTauriRuntime;
}
