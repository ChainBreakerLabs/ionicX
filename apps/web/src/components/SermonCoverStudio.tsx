import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Lock,
  Palette,
  Plus,
  Save,
  Send,
  Sparkles,
  Square,
  TextCursorInput,
  Trash2,
  Unlock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AccordionSection from "./ui/accordion-section";
import bibleService from "../services/bible";
import coversService, { CoverSettings, SermonCoverSummary, SermonCover } from "../services/covers";
import { useLiveContext } from "../contexts/LiveContext";
import { useElementSize } from "../hooks/useElementSize";
import { buildLegacyCoverDoc } from "../utils/coverDesign";
import CoverThumbnail from "./cover/CoverThumbnail";
import { fontOptions } from "../constants/fontOptions";
import type {
  BadgeLayer,
  CoverDocument,
  CoverLayer,
  CoverBackground,
  IconLayer,
  ImageLayer,
  ShapeLayer,
  TextLayer,
} from "../types/cover-design";

type LayerPatch =
  | Partial<TextLayer>
  | Partial<ImageLayer>
  | Partial<ShapeLayer>
  | Partial<BadgeLayer>
  | Partial<IconLayer>;

type ImageBackground = Extract<CoverBackground, { type: "image" }>;

const defaultSettings: CoverSettings = {
  fontFamily: "Space Grotesk",
  titleColor: "#ffffff",
  subtitleColor: "#e2e8f0",
  accentColor: "#22c55e",
  backgroundTint: "#000000",
  titleSize: 54,
  subtitleSize: 26,
  align: "center",
  badgeLabel: "Nuevo",
  imagePosX: 0,
  imagePosY: 0,
  imageScale: 1,
  showInBible: true,
};

const createId = () => `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const extractCoverAssets = (doc: CoverDocument) => {
  const assets = new Set<string>();
  if (doc.canvas.background.type === "image" && doc.canvas.background.src) {
    assets.add(doc.canvas.background.src);
  }
  doc.layers.forEach((layer) => {
    if (layer.type === "image" && layer.src) {
      assets.add(layer.src);
    }
  });
  return Array.from(assets);
};

const createDefaultDocument = (): CoverDocument => ({
  canvas: {
    width: 1440,
    height: 1080,
    safeArea: 80,
    preset: "4:3",
    background: {
      type: "solid",
      color: "#000000",
    },
  },
  layers: [
    {
      id: createId(),
      type: "text",
      role: "title",
      name: "Título",
      x: 160,
      y: 340,
      width: 1600,
      height: 180,
      text: "Título de la predicación",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 72,
        fontWeight: 700,
        color: "#ffffff",
        align: "left",
        lineHeight: 1.1,
      },
    },
    {
      id: createId(),
      type: "text",
      role: "subtitle",
      name: "Subtítulo",
      x: 160,
      y: 520,
      width: 1400,
      height: 120,
      text: "Subtítulo y enfoque principal",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 38,
        fontWeight: 500,
        color: "#e2e8f0",
        align: "left",
        lineHeight: 1.2,
      },
    },
    {
      id: createId(),
      type: "text",
      role: "speaker",
      name: "Predicador",
      x: 160,
      y: 690,
      width: 800,
      height: 80,
      text: "Predicador invitado",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 26,
        fontWeight: 600,
        color: "#ffffff",
        align: "left",
        letterSpacing: 4,
      },
    },
    {
      id: createId(),
      type: "badge",
      role: "badge",
      name: "Badge",
      x: 160,
      y: 200,
      width: 220,
      height: 60,
      text: "Nuevo",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 20,
        fontWeight: 700,
        color: "#0f172a",
        background: "#22c55e",
        radius: 999,
        letterSpacing: 4,
      },
    },
    {
      id: createId(),
      type: "text",
      role: "date",
      name: "Fecha",
      x: 160,
      y: 140,
      width: 600,
      height: 50,
      text: "Serie especial · Febrero 2026",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 18,
        fontWeight: 500,
        color: "rgba(255,255,255,0.7)",
        align: "left",
        letterSpacing: 5,
      },
    },
  ],
});

const buildLegacyFields = (doc: CoverDocument) => {
  const findTextByRole = (role: TextLayer["role"]) =>
    doc.layers.find(
      (layer) => layer.type === "text" && layer.role === role
    ) as TextLayer | undefined;
  const findBadge = () =>
    doc.layers.find(
      (layer) => layer.type === "badge" && layer.role === "badge"
    ) as BadgeLayer | undefined;

  const titleLayer = findTextByRole("title");
  const subtitleLayer = findTextByRole("subtitle");
  const speakerLayer = findTextByRole("speaker");
  const dateLayer = findTextByRole("date");
  const badgeLayer = findBadge();

  const background =
    doc.canvas.background.type === "image" ? doc.canvas.background.src : "";

  const settings: CoverSettings = {
    ...defaultSettings,
    fontFamily: titleLayer?.style.fontFamily ?? defaultSettings.fontFamily,
    titleColor: titleLayer?.style.color ?? defaultSettings.titleColor,
    subtitleColor: subtitleLayer?.style.color ?? defaultSettings.subtitleColor,
    accentColor: badgeLayer?.style.background ?? defaultSettings.accentColor,
    backgroundTint:
      doc.canvas.background.type === "solid"
        ? doc.canvas.background.color
        : defaultSettings.backgroundTint,
    titleSize: titleLayer?.style.fontSize ?? defaultSettings.titleSize,
    subtitleSize: subtitleLayer?.style.fontSize ?? defaultSettings.subtitleSize,
    align: titleLayer?.style.align ?? defaultSettings.align,
    badgeLabel: badgeLayer?.text ?? defaultSettings.badgeLabel,
    imagePosX: 0,
    imagePosY: 0,
    imageScale: 1,
    showInBible: defaultSettings.showInBible,
  };

  return {
    title: titleLayer?.text ?? "Portada",
    subtitle: subtitleLayer?.text ?? "",
    speaker: speakerLayer?.text ?? "",
    dateLabel: dateLayer?.text ?? "",
    background,
    settings,
  };
};

export default function SermonCoverStudio() {
  const { sendScene, isConnected } = useLiveContext();
  const [covers, setCovers] = useState<SermonCoverSummary[]>([]);
  const [coverDetails, setCoverDetails] = useState<Record<string, SermonCover>>({});
  const [activeCoverId, setActiveCoverId] = useState<string | null>(null);
  const [coverName, setCoverName] = useState("Nueva portada");
  const [doc, setDoc] = useState<CoverDocument>(() => createDefaultDocument());
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageTargetId, setImageTargetId] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const { width: canvasWidth, height: canvasHeight } = useElementSize(canvasRef);

  useEffect(() => {
    coversService
      .listCovers()
      .then(async (list) => {
        setCovers(list);
        const details = await Promise.all(
          list.map((item) => coversService.getCover(item.id).catch(() => null))
        );
        const map: Record<string, SermonCover> = {};
        details.forEach((cover) => {
          if (cover) {
            map[cover.id] = cover;
          }
        });
        setCoverDetails(map);
      })
      .catch(() => {
        setCovers([]);
        setCoverDetails({});
      });
  }, []);

  const selectedLayer = useMemo(
    () => doc.layers.find((layer) => layer.id === selectedLayerId) || null,
    [doc.layers, selectedLayerId]
  );

  const centerGuides = useMemo(() => {
    if (!selectedLayer) return { x: false, y: false };
    const centerX = doc.canvas.width / 2;
    const centerY = doc.canvas.height / 2;
    const layerCenterX = selectedLayer.x + selectedLayer.width / 2;
    const layerCenterY = selectedLayer.y + selectedLayer.height / 2;
    return {
      x: Math.abs(layerCenterX - centerX) <= 6,
      y: Math.abs(layerCenterY - centerY) <= 6,
    };
  }, [doc.canvas.width, doc.canvas.height, selectedLayer]);

  const scale = useMemo(() => {
    if (!canvasWidth || !canvasHeight) return 1;
    return Math.min(canvasWidth / doc.canvas.width, canvasHeight / doc.canvas.height);
  }, [canvasWidth, canvasHeight, doc.canvas.width, doc.canvas.height]);

  const scaledCanvas = useMemo(
    () => ({
      width: doc.canvas.width * scale,
      height: doc.canvas.height * scale,
    }),
    [doc.canvas.width, doc.canvas.height, scale]
  );

  const snapValue = useCallback(
    (value: number) => (snapToGrid ? Math.round(value / 10) * 10 : value),
    [snapToGrid]
  );

  const snapToCenter = useCallback((value: number, size: number, canvasSize: number) => {
    const center = canvasSize / 2;
    const layerCenter = value + size / 2;
    const diff = center - layerCenter;
    return Math.abs(diff) <= 6 ? value + diff : value;
  }, []);

  const updateLayer = useCallback((id: string, patch: LayerPatch) => {
    setDoc((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) =>
        layer.id === id ? ({ ...layer, ...patch } as CoverLayer) : layer
      ),
    }));
  }, []);

  const handleLayerPointerDown = useCallback(
    (event: ReactPointerEvent, layer: CoverLayer) => {
      event.stopPropagation();
      event.preventDefault();
      setSelectedLayerId(layer.id);
      if (layer.locked) return;
      dragStateRef.current = {
        id: layer.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: layer.x,
        originY: layer.y,
      };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    },
    []
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const dx = (event.clientX - dragState.startX) / Math.max(scale, 0.001);
      const dy = (event.clientY - dragState.startY) / Math.max(scale, 0.001);
      setDoc((prev) => {
        const layer = prev.layers.find((item) => item.id === dragState.id);
        if (!layer || layer.locked) return prev;
        let nextX = snapValue(dragState.originX + dx);
        let nextY = snapValue(dragState.originY + dy);
        nextX = snapToCenter(nextX, layer.width, prev.canvas.width);
        nextY = snapToCenter(nextY, layer.height, prev.canvas.height);
        if (nextX === layer.x && nextY === layer.y) return prev;
        return {
          ...prev,
          layers: prev.layers.map((item) =>
            item.id === dragState.id
              ? {
                  ...item,
                  x: nextX,
                  y: nextY,
              }
              : item
          ),
        };
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [scale, snapValue]);

  const updateLayerStyle = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setDoc((prev) => ({
        ...prev,
        layers: prev.layers.map((layer) => {
          if (layer.id !== id) return layer;
          if ("style" in layer) {
            return { ...layer, style: { ...layer.style, ...patch } } as CoverLayer;
          }
          return layer;
        }),
      }));
    },
    []
  );

  const updateImageBackground = useCallback((patch: Partial<ImageBackground>) => {
    setDoc((prev) => ({
      ...prev,
      canvas: {
        ...prev.canvas,
        background: {
          ...(prev.canvas.background.type === "image"
            ? prev.canvas.background
            : { type: "image", src: "", fit: "cover" }),
          ...patch,
          type: "image",
        },
      },
    }));
  }, []);

  const addLayer = useCallback((layer: CoverLayer) => {
    setDoc((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedLayerId(layer.id);
  }, []);

  const handleAddText = () => {
    const layer: TextLayer = {
      id: createId(),
      type: "text",
      role: "custom",
      name: "Texto",
      x: 240,
      y: 260,
      width: 1200,
      height: 120,
      text: "Nuevo texto",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 48,
        fontWeight: 600,
        color: "#ffffff",
        align: "left",
      },
    };
    addLayer(layer);
  };

  const handleAddBadge = () => {
    const layer: BadgeLayer = {
      id: createId(),
      type: "badge",
      role: "custom",
      name: "Badge",
      x: 240,
      y: 200,
      width: 200,
      height: 60,
      text: "Nuevo",
      style: {
        fontFamily: "Space Grotesk",
        fontSize: 18,
        fontWeight: 700,
        color: "#0f172a",
        background: "#22c55e",
        radius: 999,
        letterSpacing: 3,
      },
    };
    addLayer(layer);
  };

  const handleAddShape = (shape: ShapeLayer["shape"]) => {
    const layer: ShapeLayer = {
      id: createId(),
      type: "shape",
      role: "custom",
      name: shape === "circle" ? "Círculo" : "Rectángulo",
      x: 400,
      y: 200,
      width: 260,
      height: 260,
      shape,
      fill: "rgba(255,255,255,0.15)",
      stroke: "rgba(255,255,255,0.35)",
      strokeWidth: 2,
    };
    addLayer(layer);
  };

  const handleAddIcon = () => {
    const layer: IconLayer = {
      id: createId(),
      type: "icon",
      role: "custom",
      name: "Icono",
      x: 300,
      y: 300,
      width: 120,
      height: 120,
      icon: "*",
      color: "#ffffff",
      size: 72,
    };
    addLayer(layer);
  };

  const handleUploadLayerImage = async (file: File, targetId?: string | null) => {
    setIsUploading(true);
    try {
      const url = await bibleService.uploadImage(file, (progress) => setUploadProgress(progress));
      if (targetId) {
        updateLayer(targetId, { src: url } as Partial<ImageLayer>);
        setSelectedLayerId(targetId);
      } else {
        const layer: ImageLayer = {
          id: createId(),
          type: "image",
          role: "custom",
          name: "Imagen",
          x: 280,
          y: 180,
          width: 720,
          height: 420,
          src: url,
          fit: "contain",
          radius: 16,
          positionX: 50,
          positionY: 50,
          scale: 1,
        };
        addLayer(layer);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUploadBackground = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await bibleService.uploadImage(file, (progress) => setUploadProgress(progress));
      setDoc((prev) => ({
        ...prev,
        canvas: {
          ...prev.canvas,
          background: {
            type: "image",
            src: url,
            fit: "contain",
            opacity: 1,
            positionX: 50,
            positionY: 50,
            scale: 1,
            blur: 0,
            vignette: 0,
            overlayColor: "#000000",
            overlayOpacity: 0.6,
          },
        },
      }));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReorderLayer = (direction: "up" | "down") => {
    if (!selectedLayerId) return;
    setDoc((prev) => {
      const index = prev.layers.findIndex((layer) => layer.id === selectedLayerId);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? Math.min(index + 1, prev.layers.length - 1) : Math.max(index - 1, 0);
      if (index === nextIndex) return prev;
      const layers = [...prev.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(nextIndex, 0, layer);
      return { ...prev, layers };
    });
  };

  const handleDeleteLayer = () => {
    if (!selectedLayerId) return;
    setDoc((prev) => ({ ...prev, layers: prev.layers.filter((layer) => layer.id !== selectedLayerId) }));
    setSelectedLayerId(null);
  };

  const handleDuplicateLayer = () => {
    if (!selectedLayer) return;
    const duplicated = { ...selectedLayer, id: createId(), name: `${selectedLayer.name} copia`, x: selectedLayer.x + 20, y: selectedLayer.y + 20 };
    addLayer(duplicated);
  };

  const handlePresetChange = (preset: CoverDocument["canvas"]["preset"]) => {
    const nextCanvas = preset === "4:3" ? { width: 1440, height: 1080 } : { width: 1920, height: 1080 };
    setDoc((prev) => {
      const scaleX = nextCanvas.width / prev.canvas.width;
      const scaleY = nextCanvas.height / prev.canvas.height;
      const resizedLayers = prev.layers.map((layer) => ({
        ...layer,
        x: layer.x * scaleX,
        y: layer.y * scaleY,
        width: layer.width * scaleX,
        height: layer.height * scaleY,
      }));
      return {
        ...prev,
        canvas: {
          ...prev.canvas,
          preset,
          width: nextCanvas.width,
          height: nextCanvas.height,
        },
        layers: resizedLayers,
      };
    });
  };

  const handleSave = async () => {
    if (!coverName.trim()) return;
    setIsSaving(true);
    try {
      const legacy = buildLegacyFields(doc);
      const assets = extractCoverAssets(doc);
      const saved = await coversService.saveCover({
        id: activeCoverId ?? undefined,
        title: coverName.trim(),
        subtitle: legacy.subtitle,
        speaker: legacy.speaker,
        dateLabel: legacy.dateLabel,
        background: legacy.background,
        settings: legacy.settings,
        design: doc,
        assets,
      });
      setCoverDetails((prev) => ({ ...prev, [saved.id]: saved }));
      setActiveCoverId(saved.id);
      setCoverName(saved.title);
      setCovers((prev) => {
        const rest = prev.filter((item) => item.id !== saved.id);
        return [{ id: saved.id, title: saved.title, updatedAt: saved.updatedAt }, ...rest];
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    const cover = await coversService.getCover(id);
    setCoverDetails((prev) => ({ ...prev, [cover.id]: cover }));
    setActiveCoverId(cover.id);
    setCoverName(cover.title);
    if (cover.design) {
      setDoc(cover.design);
    } else {
      const legacyDoc = createDefaultDocument();
      const titleLayer = legacyDoc.layers.find((layer) => layer.role === "title") as TextLayer | undefined;
      const subtitleLayer = legacyDoc.layers.find((layer) => layer.role === "subtitle") as TextLayer | undefined;
      const speakerLayer = legacyDoc.layers.find((layer) => layer.role === "speaker") as TextLayer | undefined;
      const dateLayer = legacyDoc.layers.find((layer) => layer.role === "date") as TextLayer | undefined;
      const badgeLayer = legacyDoc.layers.find((layer) => layer.role === "badge") as BadgeLayer | undefined;
      if (titleLayer) titleLayer.text = cover.title;
      if (subtitleLayer) subtitleLayer.text = cover.subtitle;
      if (speakerLayer) speakerLayer.text = cover.speaker;
      if (dateLayer) dateLayer.text = cover.dateLabel;
      if (badgeLayer) badgeLayer.text = cover.settings?.badgeLabel ?? badgeLayer.text;
      if (cover.background) {
        legacyDoc.canvas.background = {
          type: "image",
          src: cover.background,
          fit: "cover",
          opacity: 1,
          positionX: 50,
          positionY: 50,
          scale: 1,
          blur: 0,
          vignette: 0,
          overlayColor: cover.settings?.backgroundTint ?? "#000000",
          overlayOpacity: 0.6,
        };
      }
      setDoc(legacyDoc);
    }
  };

  const handleNew = () => {
    setActiveCoverId(null);
    setCoverName("Nueva portada");
    setDoc(createDefaultDocument());
    setSelectedLayerId(null);
  };

  const handleDuplicateCover = () => {
    setActiveCoverId(null);
    setCoverName(`${coverName} copia`);
  };

  const handleDelete = async () => {
    if (!activeCoverId) return;
    await coversService.deleteCover(activeCoverId);
    setCovers((prev) => prev.filter((item) => item.id !== activeCoverId));
    setCoverDetails((prev) => {
      const next = { ...prev };
      delete next[activeCoverId];
      return next;
    });
    handleNew();
  };

  const handleSendLive = () => {
    sendScene(
      {
        type: "cover",
        payload: { doc },
        meta: { title: coverName, sourceModule: "covers" },
      },
      { forceLive: true }
    );
  };

  const layerControls = selectedLayer && (
    <div className="grid grid-cols-4 gap-2 shrink-0">
      <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => handleReorderLayer("down")}>
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => handleReorderLayer("up")}>
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={handleDuplicateLayer}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={handleDeleteLayer}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <Card className="glass-panel w-full min-h-[calc(100vh-220px)]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-semibold">Portadas de predicación</CardTitle>
            <p className="text-sm text-slate-500">Editor por capas con inspector contextual.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr_0.9fr] h-[calc(100vh-260px)] min-h-[640px] overflow-hidden min-h-0">
        <aside className="flex flex-col gap-4 h-full overflow-y-auto pr-1 min-h-0">
          <AccordionSection title="Biblioteca" icon={<LayoutTemplate className="h-4 w-4" />} defaultOpen>
            <div className="flex flex-col gap-2 max-h-72 overflow-auto">
              {covers.length === 0 && (
                <p className="text-sm text-slate-400">Aún no hay portadas guardadas.</p>
              )}
              {covers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleLoad(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                    activeCoverId === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <div className="h-10 aspect-[4/3] overflow-hidden rounded-lg bg-black">
                    {coverDetails[item.id] ? (
                      <CoverThumbnail
                        doc={coverDetails[item.id].design ?? buildLegacyCoverDoc(coverDetails[item.id])}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="h-full w-full bg-black" />
                    )}
                  </div>
                  <span className="line-clamp-1">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleSave}
                disabled={isSaving || !coverName.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleDuplicateCover}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleDelete} disabled={!activeCoverId}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSendLive} disabled={!isConnected}>
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </div>
            <div className="mt-3">
              <Input value={coverName} onChange={(e) => setCoverName(e.target.value)} placeholder="Nombre de portada" />
            </div>
          </AccordionSection>

          <AccordionSection title="Capas" icon={<Layers className="h-4 w-4" />} defaultOpen>
            <div className="flex flex-col gap-2 max-h-72 overflow-auto">
              {doc.layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    selectedLayerId === layer.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className="flex-1 text-left"
                  >
                    {layer.name}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateLayer(layer.id, { visible: layer.visible === false ? true : false })}
                      className="text-slate-500"
                    >
                      {layer.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLayer(layer.id, { locked: layer.locked ? false : true })}
                      className="text-slate-500"
                    >
                      {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>
        </aside>

        <section className="flex flex-col gap-4 h-full min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleAddText}>
                <TextCursorInput className="mr-2 h-4 w-4" />
                Texto
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setImageTargetId(null);
                  imageInputRef.current?.click();
                }}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Imagen
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAddShape("rect")}>
                <Square className="mr-2 h-4 w-4" />
                Rect
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAddShape("circle")}>
                <BadgeCheck className="mr-2 h-4 w-4" />
                Círculo
              </Button>
              <Button size="sm" variant="outline" onClick={handleAddBadge}>
                <BadgeCheck className="mr-2 h-4 w-4" />
                Badge
              </Button>
              <Button size="sm" variant="outline" onClick={handleAddIcon}>
                <Sparkles className="mr-2 h-4 w-4" />
                Ícono
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showGrid ? "default" : "outline"}
                className={showGrid ? "bg-slate-900 text-white hover:bg-slate-800" : "hover:border-slate-300 hover:bg-slate-50"}
                onClick={() => setShowGrid((prev) => !prev)}
              >
                <Grid3X3 className="mr-2 h-4 w-4" />
                Grid
              </Button>
              <Button
                size="sm"
                variant={showSafeArea ? "default" : "outline"}
                className={showSafeArea ? "bg-slate-900 text-white hover:bg-slate-800" : "hover:border-slate-300 hover:bg-slate-50"}
                onClick={() => setShowSafeArea((prev) => !prev)}
              >
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Safe
              </Button>
              <Button
                size="sm"
                variant={snapToGrid ? "default" : "outline"}
                onClick={() => setSnapToGrid((prev) => !prev)}
              >
                Snap
              </Button>
            </div>
          </div>

          <div
            ref={canvasRef}
            className="relative h-[520px] overflow-hidden rounded-3xl border border-white/70 bg-black shadow-xl flex items-center justify-center"
            onClick={() => setSelectedLayerId(null)}
            style={{ touchAction: "none" }}
          >
            <div
              className="relative"
              style={{
                width: scaledCanvas.width,
                height: scaledCanvas.height,
              }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: doc.canvas.width,
                  height: doc.canvas.height,
                  transform: `scale(${scale})`,
                  background:
                    doc.canvas.background.type === "solid"
                      ? doc.canvas.background.color
                      : doc.canvas.background.type === "gradient"
                        ? `linear-gradient(${doc.canvas.background.angle ?? 135}deg, ${doc.canvas.background.from}, ${doc.canvas.background.to})`
                        : "#000000",
                  borderRadius: 28,
                  overflow: "hidden",
                }}
              >
                {doc.canvas.background.type === "image" && doc.canvas.background.src && (
                  <img
                    src={doc.canvas.background.src}
                    alt="Fondo"
                    className="absolute inset-0 h-full w-full"
                    style={{
                      objectFit: doc.canvas.background.fit === "contain" ? "contain" : "cover",
                      objectPosition: `${doc.canvas.background.positionX ?? 50}% ${doc.canvas.background.positionY ?? 50}%`,
                      opacity: doc.canvas.background.opacity ?? 1,
                      filter: doc.canvas.background.blur ? `blur(${doc.canvas.background.blur}px)` : undefined,
                      transform: doc.canvas.background.scale && doc.canvas.background.scale !== 1 ? `scale(${doc.canvas.background.scale})` : undefined,
                      transformOrigin: `${doc.canvas.background.positionX ?? 50}% ${doc.canvas.background.positionY ?? 50}%`,
                    }}
                  />
                )}
                {doc.canvas.background.type === "image" && doc.canvas.background.overlayColor && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: doc.canvas.background.overlayColor,
                      opacity: doc.canvas.background.overlayOpacity ?? 0.5,
                    }}
                  />
                )}
                {doc.canvas.background.type === "image" && (doc.canvas.background.vignette ?? 0) > 0 && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)",
                      opacity: Math.min(0.9, doc.canvas.background.vignette ?? 0),
                    }}
                  />
                )}
                {showGrid && (
                  <div
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:120px_120px]"
                    style={{ backgroundPosition: "center" }}
                  />
                )}
                {showSafeArea && (
                  <div
                    className="pointer-events-none absolute border border-white/50"
                    style={{
                      left: doc.canvas.safeArea,
                      top: doc.canvas.safeArea,
                      right: doc.canvas.safeArea,
                      bottom: doc.canvas.safeArea,
                    }}
                  />
                )}
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className={`absolute top-0 bottom-0 w-px ${centerGuides.x ? "bg-emerald-400/80" : "bg-white/15"}`}
                    style={{ left: doc.canvas.width / 2 }}
                  />
                  <div
                    className={`absolute left-0 right-0 h-px ${centerGuides.y ? "bg-emerald-400/80" : "bg-white/15"}`}
                    style={{ top: doc.canvas.height / 2 }}
                  />
                </div>
                {doc.layers.map((layer) => (
                  <LayerView
                    key={layer.id}
                    layer={layer}
                    isSelected={selectedLayerId === layer.id}
                    onPointerDown={handleLayerPointerDown}
                  />
                ))}
              </div>
            </div>
          </div>
          {isUploading && (
            <div className="text-xs text-slate-500">Subiendo media... {uploadProgress}%</div>
          )}
        </section>

        <aside className="flex flex-col gap-4 h-full overflow-y-auto pr-1 min-h-0">
          <AccordionSection title="Inspector" icon={<Palette className="h-4 w-4" />} defaultOpen>
            {!selectedLayer && (
              <div className="space-y-3 text-sm text-slate-600">
                <div>
                  <label className="text-xs text-slate-500">Preset</label>
                  <select
                    className="select-control mt-2 h-10 text-sm"
                    value={doc.canvas.preset}
                    onChange={(e) => handlePresetChange(e.target.value as CoverDocument["canvas"]["preset"])}
                  >
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Fondo</label>
                  <select
                    className="select-control mt-2 h-10 text-sm"
                    value={doc.canvas.background.type}
                    onChange={(e) => {
                      const type = e.target.value as CoverDocument["canvas"]["background"]["type"];
                      setDoc((prev) => {
                        if (type === "solid") {
                          return {
                            ...prev,
                            canvas: {
                              ...prev.canvas,
                              background: {
                                type: "solid",
                                color:
                                  prev.canvas.background.type === "solid"
                                    ? prev.canvas.background.color
                                    : "#000000",
                              },
                            },
                          };
                        }
                        if (type === "gradient") {
                          return {
                            ...prev,
                            canvas: {
                              ...prev.canvas,
                              background: {
                                type: "gradient",
                                from: "#000000",
                                to: "#000000",
                                angle: 135,
                              },
                            },
                          };
                        }
                        return {
                          ...prev,
                          canvas: {
                            ...prev.canvas,
                            background: {
                              type: "image",
                              src:
                                prev.canvas.background.type === "image"
                                  ? prev.canvas.background.src
                                  : "",
                              fit: "contain",
                              opacity: 1,
                              positionX: 50,
                              positionY: 50,
                              scale: 1,
                              blur: 0,
                              vignette: 0,
                              overlayColor: "#000000",
                              overlayOpacity: 0.6,
                            },
                          },
                        };
                      });
                    }}
                  >
                    <option value="solid">Color sólido</option>
                    <option value="gradient">Gradiente</option>
                    <option value="image">Imagen</option>
                  </select>
                  {doc.canvas.background.type === "solid" && (
                    <Input
                      type="color"
                      value={doc.canvas.background.color}
                      onChange={(e) =>
                        setDoc((prev) => ({
                          ...prev,
                          canvas: {
                            ...prev.canvas,
                            background: { type: "solid", color: e.target.value },
                          },
                        }))
                      }
                      className="mt-2 h-9"
                    />
                  )}
                  {doc.canvas.background.type === "gradient" && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Input
                        type="color"
                        value={doc.canvas.background.from}
                        onChange={(e) =>
                          setDoc((prev) => ({
                            ...prev,
                            canvas: {
                              ...prev.canvas,
                              background: {
                                ...prev.canvas.background,
                                from: e.target.value,
                                type: "gradient",
                                to: prev.canvas.background.type === "gradient" ? prev.canvas.background.to : "#1f2937",
                                angle: prev.canvas.background.type === "gradient" ? prev.canvas.background.angle : 135,
                              },
                            },
                          }))
                        }
                        className="h-9"
                      />
                      <Input
                        type="color"
                        value={doc.canvas.background.to}
                        onChange={(e) =>
                          setDoc((prev) => ({
                            ...prev,
                            canvas: {
                              ...prev.canvas,
                              background: {
                                ...prev.canvas.background,
                                to: e.target.value,
                                type: "gradient",
                                from: prev.canvas.background.type === "gradient" ? prev.canvas.background.from : "#000000",
                                angle: prev.canvas.background.type === "gradient" ? prev.canvas.background.angle : 135,
                              },
                            },
                          }))
                        }
                        className="h-9"
                      />
                      <Input
                        type="number"
                        value={doc.canvas.background.angle ?? 135}
                        onChange={(e) =>
                          setDoc((prev) => ({
                            ...prev,
                            canvas: {
                              ...prev.canvas,
                              background: {
                                ...prev.canvas.background,
                                angle: Number(e.target.value) || 135,
                                type: "gradient",
                                from: prev.canvas.background.type === "gradient" ? prev.canvas.background.from : "#000000",
                                to: prev.canvas.background.type === "gradient" ? prev.canvas.background.to : "#000000",
                              },
                            },
                          }))
                        }
                        className="h-9 col-span-2"
                      />
                    </div>
                  )}
                  {doc.canvas.background.type === "image" && (
                    <div className="mt-2 space-y-3">
                      <Button size="sm" variant="outline" onClick={() => backgroundInputRef.current?.click()}>
                        <ImagePlus className="mr-2 h-4 w-4" />
                        Subir imagen
                      </Button>
                      <div>
                        <label className="text-xs text-slate-500">Ajuste</label>
                        <select
                          className="select-control mt-2 h-9 text-sm"
                          value={doc.canvas.background.fit ?? "cover"}
                          onChange={(e) => updateImageBackground({ fit: e.target.value as ImageBackground["fit"] })}
                        >
                          <option value="cover">Cubrir</option>
                          <option value="contain">Contener</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Opacidad</label>
                          <Input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={doc.canvas.background.opacity ?? 1}
                            onChange={(e) => updateImageBackground({ opacity: Number(e.target.value) || 0 })}
                            className="mt-2 h-9"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Escala</label>
                          <Input
                            type="number"
                            step="0.05"
                            min="0.5"
                            max="2"
                            value={doc.canvas.background.scale ?? 1}
                            onChange={(e) => updateImageBackground({ scale: Number(e.target.value) || 1 })}
                            className="mt-2 h-9"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Posición X</label>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={doc.canvas.background.positionX ?? 50}
                            onChange={(e) => updateImageBackground({ positionX: Number(e.target.value) || 0 })}
                            className="mt-2 h-9"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Posición Y</label>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={doc.canvas.background.positionY ?? 50}
                            onChange={(e) => updateImageBackground({ positionY: Number(e.target.value) || 0 })}
                            className="mt-2 h-9"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Blur</label>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="30"
                            value={doc.canvas.background.blur ?? 0}
                            onChange={(e) => updateImageBackground({ blur: Number(e.target.value) || 0 })}
                            className="mt-2 h-9"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Viñeta</label>
                          <Input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={doc.canvas.background.vignette ?? 0}
                            onChange={(e) => updateImageBackground({ vignette: Number(e.target.value) || 0 })}
                            className="mt-2 h-9"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Overlay</label>
                          <Input
                            type="color"
                            value={doc.canvas.background.overlayColor ?? "#000000"}
                            onChange={(e) => updateImageBackground({ overlayColor: e.target.value })}
                            className="mt-2 h-9"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Overlay Opacidad</label>
                          <Input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={doc.canvas.background.overlayOpacity ?? 0.6}
                            onChange={(e) => updateImageBackground({ overlayOpacity: Number(e.target.value) || 0 })}
                            className="mt-2 h-9"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Safe area</label>
                  <Input
                    type="number"
                    value={doc.canvas.safeArea}
                    onChange={(e) => setDoc((prev) => ({
                      ...prev,
                      canvas: { ...prev.canvas, safeArea: Number(e.target.value) || 0 },
                    }))}
                    className="mt-2 h-9"
                  />
                </div>
              </div>
            )}

            {selectedLayer && (
              <div className="space-y-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{selectedLayer.type}</div>
                    <div className="font-semibold text-slate-700">{selectedLayer.name}</div>
                  </div>
                  {layerControls}
                </div>
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Transformación</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <label className="flex flex-col gap-1">
                      X
                      <Input
                        type="number"
                        value={Math.round(selectedLayer.x)}
                        onChange={(e) => updateLayer(selectedLayer.id, { x: snapValue(Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Y
                      <Input
                        type="number"
                        value={Math.round(selectedLayer.y)}
                        onChange={(e) => updateLayer(selectedLayer.id, { y: snapValue(Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Ancho
                      <Input
                        type="number"
                        value={Math.round(selectedLayer.width)}
                        onChange={(e) => updateLayer(selectedLayer.id, { width: snapValue(Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Alto
                      <Input
                        type="number"
                        value={Math.round(selectedLayer.height)}
                        onChange={(e) => updateLayer(selectedLayer.id, { height: snapValue(Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Opacidad %
                      <Input
                        type="number"
                        value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                        onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) / 100 })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Rotación
                      <Input
                        type="number"
                        value={Math.round(selectedLayer.rotation ?? 0)}
                        onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) || 0 })}
                      />
                    </label>
                  </div>
                </div>

                {selectedLayer.type === "text" && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Texto</div>
                    <Input
                      value={selectedLayer.text}
                      onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                    />
                    <select
                      className="select-control h-9 text-sm"
                      value={selectedLayer.style.fontFamily}
                      onChange={(e) => updateLayerStyle(selectedLayer.id, { fontFamily: e.target.value })}
                    >
                      {fontOptions.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={selectedLayer.style.fontSize}
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { fontSize: Number(e.target.value) || 32 })}
                      />
                      <Input
                        type="number"
                        value={selectedLayer.style.fontWeight ?? 600}
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { fontWeight: Number(e.target.value) || 600 })}
                      />
                      <Input
                        type="color"
                        value={selectedLayer.style.color}
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { color: e.target.value })}
                      />
                      <Input
                        type="number"
                        value={selectedLayer.style.lineHeight ?? 1.1}
                        step="0.1"
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { lineHeight: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={selectedLayer.style.letterSpacing ?? 0}
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { letterSpacing: Number(e.target.value) || 0 })}
                      />
                      <Input
                        type="color"
                        value={selectedLayer.style.shadow?.color ?? "#000000"}
                        onChange={(e) => {
                          const shadow = selectedLayer.style.shadow ?? { color: "#000000", x: 0, y: 4, blur: 12 };
                          updateLayerStyle(selectedLayer.id, { shadow: { ...shadow, color: e.target.value } });
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        value={selectedLayer.style.shadow?.x ?? 0}
                        onChange={(e) => {
                          const shadow = selectedLayer.style.shadow ?? { color: "#000000", x: 0, y: 4, blur: 12 };
                          updateLayerStyle(selectedLayer.id, { shadow: { ...shadow, x: Number(e.target.value) || 0 } });
                        }}
                      />
                      <Input
                        type="number"
                        value={selectedLayer.style.shadow?.y ?? 4}
                        onChange={(e) => {
                          const shadow = selectedLayer.style.shadow ?? { color: "#000000", x: 0, y: 4, blur: 12 };
                          updateLayerStyle(selectedLayer.id, { shadow: { ...shadow, y: Number(e.target.value) || 0 } });
                        }}
                      />
                      <Input
                        type="number"
                        value={selectedLayer.style.shadow?.blur ?? 12}
                        onChange={(e) => {
                          const shadow = selectedLayer.style.shadow ?? { color: "#000000", x: 0, y: 4, blur: 12 };
                          updateLayerStyle(selectedLayer.id, { shadow: { ...shadow, blur: Number(e.target.value) || 0 } });
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="color"
                        value={selectedLayer.style.outline?.color ?? "#000000"}
                        onChange={(e) => {
                          const outline = selectedLayer.style.outline ?? { color: "#000000", width: 0 };
                          updateLayerStyle(selectedLayer.id, { outline: { ...outline, color: e.target.value } });
                        }}
                      />
                      <Input
                        type="number"
                        value={selectedLayer.style.outline?.width ?? 0}
                        onChange={(e) => {
                          const outline = selectedLayer.style.outline ?? { color: "#000000", width: 0 };
                          updateLayerStyle(selectedLayer.id, { outline: { ...outline, width: Number(e.target.value) || 0 } });
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {(["left", "center", "right"] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateLayerStyle(selectedLayer.id, { align })}
                          className={`rounded-full px-3 py-1 text-xs ${
                            selectedLayer.style.align === align ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {align === "left" ? "Izq" : align === "center" ? "Centro" : "Der"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLayer.type === "badge" && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Badge</div>
                    <Input value={selectedLayer.text} onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="color"
                        value={selectedLayer.style.background}
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { background: e.target.value })}
                      />
                      <Input
                        type="color"
                        value={selectedLayer.style.color}
                        onChange={(e) => updateLayerStyle(selectedLayer.id, { color: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {selectedLayer.type === "shape" && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Forma</div>
                    <Input
                      type="color"
                      value={selectedLayer.fill}
                      onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                    />
                    <Input
                      type="color"
                      value={selectedLayer.stroke ?? "#ffffff"}
                      onChange={(e) => updateLayer(selectedLayer.id, { stroke: e.target.value })}
                    />
                  </div>
                )}

                {selectedLayer.type === "image" && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Imagen</div>
                    <select
                      className="select-control h-9 text-sm"
                      value={selectedLayer.fit ?? "cover"}
                      onChange={(e) => updateLayer(selectedLayer.id, { fit: e.target.value as ImageLayer["fit"] })}
                    >
                      <option value="cover">Cubrir</option>
                      <option value="contain">Contener</option>
                    </select>
                    <Input
                      type="number"
                      value={selectedLayer.radius ?? 16}
                      onChange={(e) => updateLayer(selectedLayer.id, { radius: Number(e.target.value) || 0 })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={selectedLayer.positionX ?? 50}
                        onChange={(e) => updateLayer(selectedLayer.id, { positionX: Number(e.target.value) || 0 })}
                      />
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={selectedLayer.positionY ?? 50}
                        onChange={(e) => updateLayer(selectedLayer.id, { positionY: Number(e.target.value) || 0 })}
                      />
                      <Input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="2"
                        value={selectedLayer.scale ?? 1}
                        onChange={(e) => updateLayer(selectedLayer.id, { scale: Number(e.target.value) || 1 })}
                      />
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                        onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) / 100 })}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setImageTargetId(selectedLayer.id);
                        imageInputRef.current?.click();
                      }}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      Reemplazar imagen
                    </Button>
                  </div>
                )}

                {selectedLayer.type === "icon" && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Ícono</div>
                    <Input value={selectedLayer.icon} onChange={(e) => updateLayer(selectedLayer.id, { icon: e.target.value })} />
                    <Input type="color" value={selectedLayer.color} onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })} />
                  </div>
                )}
              </div>
            )}
          </AccordionSection>
        </aside>
      </CardContent>

      <Input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleUploadLayerImage(file, imageTargetId);
          }
          e.target.value = "";
          setImageTargetId(null);
        }}
      />
      <Input
        ref={backgroundInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleUploadBackground(file);
          }
          e.target.value = "";
        }}
      />
    </Card>
  );
}

function LayerView({
  layer,
  isSelected,
  onPointerDown,
}: {
  layer: CoverLayer;
  isSelected: boolean;
  onPointerDown: (event: ReactPointerEvent, layer: CoverLayer) => void;
}) {
  if (layer.visible === false) return null;

  const baseStyle: CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity ?? 1,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: "center",
    border: isSelected ? "2px solid rgba(16,185,129,0.9)" : "1px solid transparent",
    boxShadow: isSelected ? "0 0 0 3px rgba(16,185,129,0.3)" : undefined,
    cursor: layer.locked ? "not-allowed" : "grab",
  };
  const handlePointerDown = (event: ReactPointerEvent) => {
    onPointerDown(event, layer);
  };
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  if (layer.type === "text") {
    const textLayer = layer as TextLayer;
    return (
      <div
        style={{
          ...baseStyle,
          fontFamily: textLayer.style.fontFamily,
          fontSize: textLayer.style.fontSize,
          fontWeight: textLayer.style.fontWeight ?? 600,
          color: textLayer.style.color,
          textAlign: textLayer.style.align ?? "left",
          lineHeight: textLayer.style.lineHeight ?? 1.1,
          letterSpacing: textLayer.style.letterSpacing ?? 0,
          textShadow: textLayer.style.shadow
            ? `${textLayer.style.shadow.x}px ${textLayer.style.shadow.y}px ${textLayer.style.shadow.blur}px ${textLayer.style.shadow.color}`
            : undefined,
          WebkitTextStroke: textLayer.style.outline
            ? `${textLayer.style.outline.width}px ${textLayer.style.outline.color}`
            : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent:
            textLayer.style.align === "center"
              ? "center"
              : textLayer.style.align === "right"
                ? "flex-end"
                : "flex-start",
          padding: 12,
          whiteSpace: "pre-wrap",
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        {textLayer.text}
      </div>
    );
  }

  if (layer.type === "badge") {
    const badgeLayer = layer as BadgeLayer;
    return (
      <div
        style={{
          ...baseStyle,
          backgroundColor: badgeLayer.style.background,
          color: badgeLayer.style.color,
          fontFamily: badgeLayer.style.fontFamily,
          fontSize: badgeLayer.style.fontSize,
          fontWeight: badgeLayer.style.fontWeight ?? 600,
          letterSpacing: badgeLayer.style.letterSpacing ?? 2,
          borderRadius: badgeLayer.style.radius ?? 999,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        {badgeLayer.text}
      </div>
    );
  }

  if (layer.type === "shape") {
    const shapeLayer = layer as ShapeLayer;
    return (
      <div
        style={{
          ...baseStyle,
          backgroundColor: shapeLayer.fill,
          border: shapeLayer.stroke ? `${shapeLayer.strokeWidth ?? 1}px solid ${shapeLayer.stroke}` : undefined,
          borderRadius: shapeLayer.shape === "circle" ? "999px" : "20px",
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      />
    );
  }

  if (layer.type === "image") {
    const imageLayer = layer as ImageLayer;
    return (
      <div
        style={{
          ...baseStyle,
          overflow: "hidden",
          borderRadius: imageLayer.radius ?? 16,
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <img
          src={imageLayer.src}
          alt={imageLayer.name}
          className="h-full w-full"
          style={{
            objectFit: imageLayer.fit === "contain" ? "contain" : "cover",
            objectPosition: `${imageLayer.positionX ?? 50}% ${imageLayer.positionY ?? 50}%`,
            transform: imageLayer.scale && imageLayer.scale !== 1 ? `scale(${imageLayer.scale})` : undefined,
            transformOrigin: `${imageLayer.positionX ?? 50}% ${imageLayer.positionY ?? 50}%`,
          }}
        />
      </div>
    );
  }

  if (layer.type === "icon") {
    const iconLayer = layer as IconLayer;
    return (
      <div
        style={{
          ...baseStyle,
          color: iconLayer.color,
          fontSize: iconLayer.size ?? 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        {iconLayer.icon}
      </div>
    );
  }

  return null;
}
