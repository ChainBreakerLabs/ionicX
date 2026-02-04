import { useMemo } from "react";
import { Play, Square, Trash2, Radio, MonitorUp } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useLiveContext } from "../../contexts/LiveContext";
import type { Scene } from "../../types/live";
import { openExternalLiveWindow } from "../../services/externalLive";

const sceneTypeLabels: Record<string, string> = {
  verse: "Versículo",
  lyrics: "Letra",
  cover: "Portada",
  media: "Media",
};

function getSceneLabel(scene: Scene | null) {
  if (!scene) return "Sin salida activa";
  const typeLabel = sceneTypeLabels[scene.type] ?? "Scene";
  const title = scene.meta?.title || scene.meta?.subtitle;
  return title ? `${typeLabel}: ${title}` : typeLabel;
}

export default function LiveOutputBar() {
  const {
    isConnected,
    status,
    scene,
    setLiveMode,
    clearScene,
  } = useLiveContext();

  const statusLabel = useMemo(() => {
    if (!isConnected) return "Desconectado";
    if (status.mode === "live") return "En vivo";
    if (status.mode === "paused") return "En espera";
    return "Conectado";
  }, [isConnected, status.mode]);

  const statusTone = useMemo(() => {
    if (!isConnected) return "bg-rose-500/15 text-rose-600";
    if (status.mode === "live") return "bg-emerald-500/15 text-emerald-600";
    if (status.mode === "paused") return "bg-amber-500/15 text-amber-700";
    return "bg-slate-500/10 text-slate-600";
  }, [isConnected, status.mode]);

  const sceneLabel = useMemo(() => getSceneLabel(scene), [scene]);

  return (
    <div className="sticky top-16 z-30 w-full border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-none items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
            <Radio className="h-3 w-3" />
            <span>{statusLabel}</span>
          </div>
          <div className="min-w-0 text-sm font-medium text-slate-600 truncate">{sceneLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className={`h-9 w-9 rounded-full p-0 ${
                    status.mode === "live"
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  }`}
                  onClick={() => setLiveMode(status.mode === "live" ? "connected" : "live")}
                >
                  {status.mode === "live" ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {status.mode === "live" ? "Detener transmisión" : "Iniciar transmisión"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-9 rounded-full p-0"
                  onClick={clearScene}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpiar salida</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-9 rounded-full p-0"
                  onClick={openExternalLiveWindow}
                >
                  <MonitorUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir salida externa</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
