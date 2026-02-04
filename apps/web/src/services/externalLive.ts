import { isTauri } from "./backend";

let windowCount = 0;

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;
  const anyWindow = window as typeof window & {
    __TAURI__?: { core?: { invoke?: TauriInvoke }; invoke?: TauriInvoke };
    __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
  };
  return (
    anyWindow.__TAURI__?.core?.invoke ??
    anyWindow.__TAURI__?.invoke ??
    anyWindow.__TAURI_INTERNALS__?.invoke ??
    null
  );
}

export async function openExternalLiveWindow() {
  const url = "external-live";

  if (isTauri()) {
    const invoke = getTauriInvoke();
    if (invoke) {
      const label = `external-live-${Date.now()}-${windowCount++}`;
      try {
        await invoke("open_external_live", { label, url });
        return;
      } catch (error) {
        console.error("Failed to open external live window", error);
        return;
      }
    }
  }

  window.open(`/${url}`, "_blank", "noopener,noreferrer");
}
