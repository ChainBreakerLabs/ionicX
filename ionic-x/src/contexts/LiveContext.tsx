/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebSocketConnection } from "../hooks/useWebSocketConnection";
import { useBackendContext } from "./BackendContext";
import { normalizeSceneUrls } from "../services/mediaUrls";
import type { LiveMessage, LiveMode, LiveStatus, Scene, VersePreferences } from "../types/live";

type SceneInput = Omit<Scene, "id" | "version" | "updatedAt"> & {
  id?: string;
  version?: number;
  updatedAt?: number;
};

interface LiveContextValue {
  isConnected: boolean;
  clientCount: number;
  status: LiveStatus;
  scene: Scene | null;
  versePrefs: VersePreferences;
  setVersePrefs: (prefs: VersePreferences) => void;
  autoFollow: boolean;
  setAutoFollow: (value: boolean) => void;
  sendScene: (scene: SceneInput, opts?: { forceLive?: boolean }) => void;
  clearScene: () => void;
  sendBlack: () => void;
  resendScene: () => void;
  setLiveMode: (mode: LiveMode) => void;
}

const LiveContext = createContext<LiveContextValue | undefined>(undefined);

const AUTO_FOLLOW_KEY = "ionicx:autoFollow";

const createSceneId = () => `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultStatus: LiveStatus = { mode: "connected", updatedAt: 0 };
const defaultVersePrefs: VersePreferences = {
  styles: {
    fontFamily: "Inter",
    fontSize: 40,
    lineHeight: 1.2,
    textColor: "#ffffff",
    align: "center",
    referenceSize: 15,
    referenceColor: "#ffffff",
    backgroundColor: "#000000",
  },
  background: {
    kind: "color",
    color: "#000000",
    fit: "contain",
    overlayColor: "#000000",
    overlayOpacity: 0.4,
  },
  layout: "overlay",
  showText: true,
  showReference: true,
  mediaState: {
    isPlaying: true,
    muted: true,
    loop: true,
    currentTime: 0,
  },
};

export function LiveProvider({ children }: { children: ReactNode }) {
  const { wsUrl, origin } = useBackendContext();
  const [scene, setScene] = useState<Scene | null>(null);
  const [status, setStatus] = useState<LiveStatus>(defaultStatus);
  const [clientCount, setClientCount] = useState(0);
  const [versePrefs, setVersePrefs] = useState<VersePreferences>(defaultVersePrefs);
  const [autoFollow, setAutoFollowState] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(AUTO_FOLLOW_KEY);
    return stored ? stored === "true" : true;
  });

  const sceneRef = useRef<Scene | null>(null);
  const statusRef = useRef<LiveStatus>(defaultStatus);

  const setAutoFollow = useCallback((value: boolean) => {
    setAutoFollowState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTO_FOLLOW_KEY, String(value));
    }
  }, []);

  const handleIncoming = useCallback((data: LiveMessage) => {
    if (data.type === "sceneUpdate") {
      const incoming = (data as { scene: Scene | null }).scene ?? null;
      if (!incoming) {
        sceneRef.current = null;
        setScene(null);
        return;
      }
      const normalized = origin ? normalizeSceneUrls(incoming, origin) : incoming;
      const current = sceneRef.current;
      if (!current || normalized.version >= current.version) {
        sceneRef.current = normalized;
        setScene(normalized);
      }
      return;
    }

    if (data.type === "liveStatus") {
      const incoming = (data as { status: LiveStatus }).status;
      const current = statusRef.current;
      if (!current || incoming.updatedAt >= current.updatedAt) {
        statusRef.current = incoming;
        setStatus(incoming);
      }
      return;
    }

    if (data.type === "clientCount") {
      const count = (data as { count?: number }).count;
      setClientCount(typeof count === "number" ? count : 0);
    }
  }, []);

  const { isConnected, sendJson } = useWebSocketConnection(wsUrl, {
    getRetryDelay: (retryCount) => Math.min(1200 * 2 ** retryCount, 12000),
    maxQueueSize: 10,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data) as LiveMessage;
        handleIncoming(data);
      } catch (error) {
        console.error("WebSocket parse error:", error);
      }
    },
  });

  const setLiveMode = useCallback(
    (mode: LiveMode) => {
      const next: LiveStatus = { mode, updatedAt: Date.now() };
      statusRef.current = next;
      setStatus(next);
      sendJson({ type: "liveStatus", status: next });
    },
    [sendJson]
  );

  const sendScene = useCallback(
    (input: SceneInput, opts?: { forceLive?: boolean }) => {
      const now = Date.now();
      const nextScene: Scene = {
        ...input,
        id: input.id ?? createSceneId(),
        version: input.version ?? now,
        updatedAt: input.updatedAt ?? now,
      } as Scene;

      const normalized = origin ? normalizeSceneUrls(nextScene, origin) : nextScene;
      sceneRef.current = normalized;
      setScene(normalized);
      sendJson({ type: "sceneUpdate", scene: normalized });
      if (opts?.forceLive && statusRef.current.mode !== "live") {
        setLiveMode("live");
      }
    },
    [sendJson, setLiveMode]
  );

  const clearScene = useCallback(() => {
    sceneRef.current = null;
    setScene(null);
    sendJson({ type: "sceneUpdate", scene: null });
  }, [sendJson]);

  const sendBlack = useCallback(() => {
    sendScene(
      {
        type: "media",
        payload: {
          kind: "color",
          color: "#000000",
        },
        meta: { title: "Negro", sourceModule: "system" },
        styles: { backgroundColor: "#000000" },
      },
      { forceLive: true }
    );
  }, [sendScene]);

  const resendScene = useCallback(() => {
    const current = sceneRef.current;
    if (!current) return;
    const now = Date.now();
    const bumped = { ...current, version: now, updatedAt: now };
    sceneRef.current = bumped;
    setScene(bumped);
    sendJson({ type: "sceneUpdate", scene: bumped });
  }, [sendJson]);

  const value = useMemo(
    () => ({
      isConnected,
      clientCount,
      status,
      scene,
      versePrefs,
      setVersePrefs,
      autoFollow,
      setAutoFollow,
      sendScene,
      clearScene,
      sendBlack,
      resendScene,
      setLiveMode,
    }),
    [
      isConnected,
      clientCount,
      status,
      scene,
      versePrefs,
      setVersePrefs,
      autoFollow,
      setAutoFollow,
      sendScene,
      clearScene,
      sendBlack,
      resendScene,
      setLiveMode,
    ]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLiveContext() {
  const context = useContext(LiveContext);
  if (!context) {
    throw new Error("useLiveContext must be used within LiveProvider");
  }
  return context;
}
