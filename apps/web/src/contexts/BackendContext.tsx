/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getBackendInfo, resetBackendInfoCache } from "../services/backend";

type BackendStatus = "starting" | "ready" | "error";

type BackendHealth = {
  logDir?: string;
  dataDir?: string;
};

type BackendContextValue = {
  status: BackendStatus;
  origin: string | null;
  wsUrl: string | null;
  logDir?: string;
  dataDir?: string;
  error?: string;
  retry: () => void;
};

const BackendContext = createContext<BackendContextValue | undefined>(undefined);

const MAX_ATTEMPTS = 80;
const INITIAL_DELAY_MS = 300;
const MAX_DELAY_MS = 2500;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitForHealth(origin: string): Promise<BackendHealth> {
  let delay = INITIAL_DELAY_MS;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${origin}/health`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as BackendHealth;
        return data ?? {};
      }
    } catch {
      // ignore and retry
    }
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), MAX_DELAY_MS);
  }

  throw new Error("No se pudo iniciar el backend local.");
}

export function BackendProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>("starting");
  const [origin, setOrigin] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [logDir, setLogDir] = useState<string | undefined>();
  const [dataDir, setDataDir] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    resetBackendInfoCache();
    setRetryToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const start = async () => {
      setStatus("starting");
      setError(undefined);
      try {
        const info = await getBackendInfo();
        if (!active) return;

        setOrigin(info.origin);
        setWsUrl(info.wsUrl);
        if (info.logDir) setLogDir(info.logDir);
        if (info.dataDir) setDataDir(info.dataDir);

        const health = await waitForHealth(info.origin);
        if (!active) return;

        if (health.logDir) setLogDir(health.logDir);
        if (health.dataDir) setDataDir(health.dataDir);
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        resetBackendInfoCache();
        const message =
          typeof err === "string"
            ? err
            : err instanceof Error
            ? err.message
            : "Error inesperado al iniciar el backend.";
        setError(message);
        setStatus("error");
      }
    };

    start();
    return () => {
      active = false;
    };
  }, [retryToken]);

  const value = useMemo(
    () => ({
      status,
      origin,
      wsUrl,
      logDir,
      dataDir,
      error,
      retry,
    }),
    [status, origin, wsUrl, logDir, dataDir, error, retry]
  );

  return (
    <BackendContext.Provider value={value}>
      {children}
      {status !== "ready" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-6 text-slate-100">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">ionicX</p>
            <h2 className="mt-2 text-xl font-semibold">
              {status === "starting" ? "Iniciando backend local" : "Backend no disponible"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {status === "starting"
                ? "Preparando la base de datos y servicios locales."
                : error ?? "No fue posible conectar con el backend local."}
            </p>
            {logDir && (
              <p className="mt-4 text-xs text-slate-400">
                Logs: <span className="font-mono">{logDir}</span>
              </p>
            )}
            {dataDir && (
              <p className="mt-2 text-xs text-slate-500">
                Datos: <span className="font-mono">{dataDir}</span>
              </p>
            )}
            {status === "error" && (
              <button
                type="button"
                onClick={retry}
                className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-400 hover:text-white"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}
    </BackendContext.Provider>
  );
}

export function useBackendContext() {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error("useBackendContext must be used within BackendProvider");
  }
  return context;
}
