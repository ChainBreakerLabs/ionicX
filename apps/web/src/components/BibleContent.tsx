import { useCallback, useMemo, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ImagePlus,
  Video,
  Send,
  Library,
  Wand2,
  Pause,
  Play,
  Square,
} from "lucide-react";
import bibleService from "../services/bible";
import { useLiveContext } from "../contexts/LiveContext";
import SceneRenderer from "./live/SceneRenderer";
import AccordionSection from "./ui/accordion-section";
import { useElementSize } from "../hooks/useElementSize";
import { fontOptions } from "../constants/fontOptions";
import type { VersePayload, VerseStyles } from "../types/live";

const MAX_MEDIA_LIBRARY = 12;

type MediaItem = { id: string; url: string; kind: "image" | "video" };

export default function BibleContent() {
  const { scene, status, isConnected, sendScene, versePrefs, setVersePrefs } = useLiveContext();
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [mediaFit, setMediaFit] = useState<"contain" | "cover">("contain");
  const [mediaLoop, setMediaLoop] = useState(true);
  const [mediaMuted, setMediaMuted] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { width: previewWidth, height: previewHeight } = useElementSize(previewRef);

  const updateVerseStyles = useCallback(
    (patch: Partial<VerseStyles>) => {
      setVersePrefs({
        ...versePrefs,
        styles: { ...versePrefs.styles, ...patch },
      });
    },
    [versePrefs, setVersePrefs]
  );

  const updateVerseBackground = useCallback(
    (patch: Partial<NonNullable<VersePayload["background"]>>) => {
      setVersePrefs({
        ...versePrefs,
        background: { ...versePrefs.background, ...patch },
      });
    },
    [versePrefs, setVersePrefs]
  );

  const updateVerseMediaState = useCallback(
    (patch: Partial<NonNullable<VersePayload["mediaState"]>>) => {
      setVersePrefs({
        ...versePrefs,
        mediaState: { ...versePrefs.mediaState, ...patch },
      });
    },
    [versePrefs, setVersePrefs]
  );

  const applyVersePrefsToLive = useCallback(() => {
    if (!scene || scene.type !== "verse") return;
    sendScene({
      ...scene,
      id: scene.id,
      version: Date.now(),
      updatedAt: Date.now(),
      payload: {
        ...scene.payload,
        background: versePrefs.background,
        layout: versePrefs.layout,
        showText: versePrefs.showText,
        showReference: versePrefs.showReference,
        mediaState: versePrefs.mediaState,
      },
      styles: versePrefs.styles,
    });
  }, [scene, sendScene, versePrefs]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await bibleService.uploadImage(file, (progress) => setUploadProgress(progress));
      const nextItem: MediaItem = { id: `img-${Date.now()}`, url, kind: "image" };
      setMediaLibrary((prev) => [nextItem, ...prev.filter((item) => item.url !== url)].slice(0, MAX_MEDIA_LIBRARY));
      setActiveMedia(nextItem);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = "";
    }
  }, []);

  const handleVideoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await bibleService.uploadVideo(file, (progress) => setUploadProgress(progress));
      const nextItem: MediaItem = { id: `vid-${Date.now()}`, url, kind: "video" };
      setMediaLibrary((prev) => [nextItem, ...prev.filter((item) => item.url !== url)].slice(0, MAX_MEDIA_LIBRARY));
      setActiveMedia(nextItem);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = "";
    }
  }, []);

  const handleSendMedia = useCallback(() => {
    if (!activeMedia) return;
    sendScene(
      {
        type: "media",
        payload: {
          kind: activeMedia.kind,
          src: activeMedia.url,
          fit: mediaFit,
          loop: mediaLoop,
          muted: mediaMuted,
          isPlaying: activeMedia.kind === "video",
        },
        meta: {
          title: activeMedia.kind === "image" ? "Imagen" : "Video",
          sourceModule: "media",
        },
      },
      { forceLive: true }
    );
  }, [activeMedia, sendScene, mediaFit, mediaLoop, mediaMuted]);

  const handleMediaControl = useCallback(
    (action: "play" | "pause" | "stop") => {
      if (!activeMedia || activeMedia.kind !== "video") return;
      sendScene({
        type: "media",
        payload: {
          kind: "video",
          src: activeMedia.url,
          fit: mediaFit,
          loop: mediaLoop,
          muted: mediaMuted,
          isPlaying: action === "play",
          currentTime: action === "stop" ? 0 : undefined,
        },
        meta: { title: "Video", sourceModule: "media" },
      }, { forceLive: true });
    },
    [activeMedia, sendScene, mediaFit, mediaLoop, mediaMuted]
  );

  const handleUseAsVerseBackground = useCallback(() => {
    if (!activeMedia) return;
    if (activeMedia.kind === "image") {
      setVersePrefs({
        ...versePrefs,
        background: {
          kind: "image",
          src: activeMedia.url,
          fit: "contain",
          overlayColor: versePrefs.background.overlayColor,
          overlayOpacity: versePrefs.background.overlayOpacity,
        },
      });
    } else {
      setVersePrefs({
        ...versePrefs,
        background: {
          kind: "video",
          src: activeMedia.url,
          fit: "contain",
          overlayColor: versePrefs.background.overlayColor,
          overlayOpacity: versePrefs.background.overlayOpacity,
        },
        mediaState: { ...versePrefs.mediaState, isPlaying: true },
      });
    }
  }, [activeMedia, versePrefs, setVersePrefs]);

  const handleVideoControl = useCallback(
    (action: "play" | "pause" | "stop") => {
      if (action === "play") {
        updateVerseMediaState({ isPlaying: true });
      } else if (action === "pause") {
        updateVerseMediaState({ isPlaying: false });
      } else {
        updateVerseMediaState({ isPlaying: false, currentTime: 0 });
      }
      applyVersePrefsToLive();
    },
    [updateVerseMediaState, applyVersePrefsToLive]
  );

  const canRenderPreview = !!scene;

  const previewLabel = useMemo(() => {
    if (!scene || !canRenderPreview) return "Sin salida activa";
    if (status.mode === "paused") return "Salida en pausa";
    if (status.mode === "live") return scene.meta?.title || "Salida en vivo";
    return scene.meta?.title || "Vista previa";
  }, [scene, canRenderPreview, status.mode]);

  const previewScene = useMemo(() => {
    if (!scene || !canRenderPreview) return null;
    if (scene.type !== "verse") return scene;
    if (!previewWidth || !previewHeight) return scene;

    const styles = scene.styles ?? {};
    const lineHeight = styles.lineHeight ?? versePrefs.styles.lineHeight ?? 1.2;
    const baseFontSize = styles.fontSize ?? versePrefs.styles.fontSize ?? 56;
    const baseReferenceSize = styles.referenceSize ?? versePrefs.styles.referenceSize ?? 16;
    const text = scene.payload.text ?? "";
    const showReference = scene.payload.showReference !== false;
    const widthFactor = scene.payload.layout === "split" ? 0.42 : 0.8;
    const maxWidth = Math.min(
      typeof styles.maxWidth === "number" ? styles.maxWidth : Infinity,
      previewWidth * widthFactor
    );
    const availableHeight = previewHeight * (scene.payload.layout === "split" ? 0.8 : 0.75);

    let fontSize = baseFontSize;
    let referenceSize = baseReferenceSize;

    for (let i = 0; i < 8; i += 1) {
      const charsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * 0.55)));
      const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
      const referenceHeight = showReference ? referenceSize * 1.6 : 0;
      const estimatedHeight = lineCount * fontSize * lineHeight + referenceHeight + fontSize * 0.8;
      if (estimatedHeight <= availableHeight || fontSize <= 18) break;
      fontSize *= 0.9;
      referenceSize = Math.max(10, referenceSize * 0.9);
    }

    return {
      ...scene,
      styles: {
        ...styles,
        fontFamily: styles.fontFamily ?? versePrefs.styles.fontFamily,
        fontSize,
        referenceSize,
        maxWidth,
      },
    };
  }, [
    scene,
    canRenderPreview,
    previewWidth,
    previewHeight,
    versePrefs.styles.fontFamily,
    versePrefs.styles.fontSize,
    versePrefs.styles.lineHeight,
    versePrefs.styles.referenceSize,
  ]);

  return (
    <Card className="glass-panel flex flex-col min-h-[560px] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Salida en vivo</h2>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div
          ref={previewRef}
          className="relative w-full overflow-hidden rounded-2xl border border-white/70 bg-black aspect-[4/3] min-h-[340px]"
        >
          <SceneRenderer
            scene={previewScene}
            className="h-full w-full"
            placeholder="Esperando salida..."
            playMedia
            mode="preview"
          />
          <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-500">
            {previewLabel}
          </div>
        </div>

        <AccordionSection title="Versículo" icon={<Wand2 className="h-4 w-4" />} defaultOpen>
          <div className="grid gap-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                className="select-control h-8 text-xs"
                value={versePrefs.styles.fontFamily}
                onChange={(e) => updateVerseStyles({ fontFamily: e.target.value })}
              >
                {fontOptions.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                value={versePrefs.styles.fontSize ?? 56}
                onChange={(e) => updateVerseStyles({ fontSize: Number(e.target.value) || 32 })}
                className="h-8 w-20 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <label className="flex items-center gap-2">
                Texto
                <Input
                  type="color"
                  value={versePrefs.styles.textColor ?? "#ffffff"}
                  onChange={(e) => updateVerseStyles({ textColor: e.target.value })}
                  className="h-8 w-10 p-0"
                />
              </label>
              <label className="flex items-center gap-2">
                Referencia
                <Input
                  type="color"
                  value={versePrefs.styles.referenceColor ?? "#ffffff"}
                  onChange={(e) => updateVerseStyles({ referenceColor: e.target.value })}
                  className="h-8 w-10 p-0"
                />
              </label>
              <label className="flex items-center gap-2">
                Tamaño
                <Input
                  type="number"
                  value={versePrefs.styles.referenceSize ?? 16}
                  onChange={(e) => updateVerseStyles({ referenceSize: Number(e.target.value) || 14 })}
                  className="h-8 w-16 text-xs"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => updateVerseStyles({ align })}
                  className={`rounded-full px-3 py-1 text-xs ${
                    versePrefs.styles.align === align ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {align === "left" ? "Izq" : align === "center" ? "Centro" : "Der"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setVersePrefs({ ...versePrefs, showReference: !versePrefs.showReference })}
                className={`rounded-full px-3 py-1 text-xs ${
                  versePrefs.showReference ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                Referencia
              </button>
              <button
                type="button"
                onClick={() => setVersePrefs({ ...versePrefs, showText: !versePrefs.showText })}
                className={`rounded-full px-3 py-1 text-xs ${
                  versePrefs.showText ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                Texto
              </button>
              <button
                type="button"
                onClick={() => setVersePrefs({ ...versePrefs, layout: versePrefs.layout === "overlay" ? "split" : "overlay" })}
                className={`rounded-full px-3 py-1 text-xs ${
                  versePrefs.layout === "split" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {versePrefs.layout === "split" ? "Split" : "Overlay"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="select-control h-8 text-xs"
                value={versePrefs.background.kind}
                onChange={(e) => updateVerseBackground({ kind: e.target.value as "color" | "image" | "video" })}
              >
                <option value="color">Color</option>
                <option value="image">Imagen</option>
                <option value="video">Video</option>
              </select>
              <select
                className="select-control h-8 text-xs"
                value={versePrefs.background.fit ?? "contain"}
                onChange={(e) => updateVerseBackground({ fit: e.target.value as "contain" | "cover" })}
              >
                <option value="contain">Contener</option>
                <option value="cover">Cubrir</option>
              </select>
            </div>
            {versePrefs.background.kind === "color" && (
              <Input
                type="color"
                value={versePrefs.background.color ?? "#000000"}
                onChange={(e) => updateVerseBackground({ color: e.target.value })}
                className="h-8 w-12 p-0"
              />
            )}
            {(versePrefs.background.kind === "image" || versePrefs.background.kind === "video") && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="color"
                  value={versePrefs.background.overlayColor ?? "#000000"}
                  onChange={(e) => updateVerseBackground({ overlayColor: e.target.value })}
                  className="h-8 w-12 p-0"
                />
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={versePrefs.background.overlayOpacity ?? 0.4}
                  onChange={(e) => updateVerseBackground({ overlayOpacity: Number(e.target.value) || 0 })}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={applyVersePrefsToLive} disabled={!isConnected || scene?.type !== "verse"}>
                Aplicar a salida
              </Button>
              <Button size="sm" variant="outline" onClick={handleUseAsVerseBackground} disabled={!activeMedia}>
                Usar media como fondo
              </Button>
            </div>
            {versePrefs.background.kind === "video" && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleVideoControl("play")}>
                  <Play className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleVideoControl("pause")}>
                  <Pause className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleVideoControl("stop")}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </AccordionSection>

        <AccordionSection title="Media" icon={<Library className="h-4 w-4" />} defaultOpen>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Subir imagen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
            >
              <Video className="mr-2 h-4 w-4" />
              Subir video
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleSendMedia}
              disabled={!activeMedia || !isConnected}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar
            </Button>
            {isUploading && (
              <span className="text-xs text-slate-500">Subiendo... {uploadProgress}%</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select
              className="select-control h-9 text-sm"
              value={mediaFit}
              onChange={(e) => setMediaFit(e.target.value as "contain" | "cover")}
            >
              <option value="contain">Contener</option>
              <option value="cover">Cubrir</option>
            </select>
            <button
              type="button"
              onClick={() => setMediaLoop((prev) => !prev)}
              className={`rounded-xl px-3 py-2 text-xs ${
                mediaLoop ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              Loop
            </button>
            <button
              type="button"
              onClick={() => setMediaMuted((prev) => !prev)}
              className={`rounded-xl px-3 py-2 text-xs ${
                mediaMuted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              Mute
            </button>
          </div>
          {mediaLibrary.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/70 bg-white/80 p-2">
              {mediaLibrary.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMedia(item)}
                  className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border ${
                    activeMedia?.id === item.id ? "border-emerald-400 ring-2 ring-emerald-200" : "border-white/60"
                  }`}
                  aria-label="Seleccionar media"
                >
                  {item.kind === "image" ? (
                    <img src={item.url} alt="media" className="h-full w-full object-contain bg-black" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black text-white text-[10px]">
                      <Video className="h-4 w-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {activeMedia?.kind === "video" && (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleMediaControl("play")}>
                <Play className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleMediaControl("pause")}>
                <Pause className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleMediaControl("stop")}>
                <Square className="h-4 w-4" />
              </Button>
            </div>
          )}
        </AccordionSection>

      </div>

      <Input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <Input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />
    </Card>
  );
}
