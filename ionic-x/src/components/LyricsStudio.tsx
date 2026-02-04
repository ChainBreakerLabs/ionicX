import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    ChevronLeft,
    ChevronRight,
    GripVertical,
    Layers,
    ListMusic,
    Music,
    PenLine,
    Plus,
    Save,
    Send,
    Trash2,
    Wand2
} from "lucide-react";
import lyricsService, { LyricsSegment, LyricsSettings, LyricsSongSummary } from "../services/lyrics";
import { useLiveContext } from "../contexts/LiveContext";
import SceneRenderer from "./live/SceneRenderer";
import AccordionSection from "./ui/accordion-section";
import { useElementSize } from "../hooks/useElementSize";

type SegmentKind = "Verso" | "Coro" | "Puente" | "Intro" | "Outro";

type Segment = LyricsSegment & {
    kind: SegmentKind;
};

const segmentKinds: SegmentKind[] = ["Verso", "Coro", "Puente", "Intro", "Outro"];

const colorPalette = [
    { value: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Verde" },
    { value: "bg-blue-100 text-blue-700 border-blue-200", label: "Azul" },
    { value: "bg-rose-100 text-rose-700 border-rose-200", label: "Rojo" },
    { value: "bg-amber-100 text-amber-700 border-amber-200", label: "Ámbar" },
    { value: "bg-purple-100 text-purple-700 border-purple-200", label: "Púrpura" },
];

const defaultSettings: LyricsSettings = {
    fontFamily: "Arial",
    fontSize: 46,
    textColor: "#ffffff",
    backgroundColor: "#000000",
    align: "center",
    highlightColor: "#22c55e",
};

const buildId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const LIVE_SNAPSHOT_KEY = "ionicx:lyricsLiveSnapshot";

export default function LyricsStudio() {
    const [songs, setSongs] = useState<LyricsSongSummary[]>([]);
    const [activeSongId, setActiveSongId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [lyrics, setLyrics] = useState("");
    const [segments, setSegments] = useState<Segment[]>([]);
    const [settings, setSettings] = useState<LyricsSettings>(defaultSettings);
    const [selectedText, setSelectedText] = useState("");
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const dragIndexRef = useRef<number | null>(null);
    const dragSelectionRef = useRef(false);
    const lastPayloadRef = useRef<string>("");
    const autoFollowArmedRef = useRef(false);
    const hasRestoredRef = useRef(false);
    const lyricsSceneIdRef = useRef("lyrics-scene");
    const previewRef = useRef<HTMLDivElement | null>(null);
    const { width: previewWidth, height: previewHeight } = useElementSize(previewRef);

    const { sendScene, isConnected, autoFollow, status, scene: liveScene } = useLiveContext();
    const isLive = status.mode === "live";
    const isLiveLyrics = isLive && liveScene?.type === "lyrics";

    useEffect(() => {
        lyricsService.listSongs()
            .then(setSongs)
            .catch(() => setSongs([]));
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isLiveLyrics) {
            window.localStorage.removeItem(LIVE_SNAPSHOT_KEY);
            hasRestoredRef.current = false;
            return;
        }
        if (hasRestoredRef.current) return;
        const raw = window.localStorage.getItem(LIVE_SNAPSHOT_KEY);
        if (!raw) return;
        try {
            const saved = JSON.parse(raw) as {
                activeSongId?: string | null;
                title?: string;
                lyrics?: string;
                segments?: Segment[];
                settings?: LyricsSettings;
                activeSegmentId?: string | null;
            };
            if (saved.title !== undefined) setTitle(saved.title);
            if (saved.lyrics !== undefined) setLyrics(saved.lyrics);
            if (saved.segments !== undefined) setSegments(saved.segments);
            if (saved.settings !== undefined) setSettings(saved.settings);
            if (saved.activeSongId !== undefined) setActiveSongId(saved.activeSongId);
            if (saved.activeSegmentId !== undefined) setActiveSegmentId(saved.activeSegmentId);
            autoFollowArmedRef.current = false;
            hasRestoredRef.current = true;
        } catch {
            // ignore invalid snapshot
        }
    }, [isLiveLyrics]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isLiveLyrics) return;
        const payload = {
            activeSongId,
            title,
            lyrics,
            segments,
            settings,
            activeSegmentId,
        };
        window.localStorage.setItem(LIVE_SNAPSHOT_KEY, JSON.stringify(payload));
    }, [isLiveLyrics, activeSongId, title, lyrics, segments, settings, activeSegmentId]);

    useEffect(() => {
        if (!autoFollow) {
            autoFollowArmedRef.current = false;
        }
    }, [autoFollow]);

    useEffect(() => {
        if (status.mode !== "live") {
            autoFollowArmedRef.current = false;
        }
    }, [status.mode]);

    useEffect(() => {
        if (liveScene?.type !== "lyrics") {
            autoFollowArmedRef.current = false;
        }
    }, [liveScene?.type]);

    const updateSelectedText = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        if (start === end) {
            setSelectedText("");
            return;
        }
        const snippet = lyrics.slice(start, end).trim();
        setSelectedText(snippet);
    }, [lyrics]);

    const addSegment = useCallback((content: string) => {
        setSegments(prev => {
            const id = buildId();
            const color = colorPalette[prev.length % colorPalette.length]?.value ?? colorPalette[0].value;
            const next: Segment = {
                id,
                title: `Segmento ${prev.length + 1}`,
                content: content.trim(),
                kind: "Verso",
                color,
            };
            return [next, ...prev];
        });
    }, []);

    const handleCreateSegment = useCallback(() => {
        if (!selectedText) return;
        addSegment(selectedText);
        setSelectedText("");
    }, [addSegment, selectedText]);

    const handleAutoSegment = useCallback(() => {
        const blocks = lyrics
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean);
        if (blocks.length === 0) return;
        setSegments(prev => {
            const created = blocks.map((block, index) => {
                const color = colorPalette[(prev.length + index) % colorPalette.length]?.value ?? colorPalette[0].value;
                return {
                    id: buildId(),
                    title: `Segmento ${prev.length + index + 1}`,
                    content: block,
                    kind: "Verso" as SegmentKind,
                    color,
                };
            });
            return [...created, ...prev];
        });
    }, [lyrics]);

    const handleUpdateSegment = useCallback((id: string, patch: Partial<Segment>) => {
        setSegments(prev => prev.map(seg => (seg.id === id ? { ...seg, ...patch } : seg)));
    }, []);

    const handleRemoveSegment = useCallback((id: string) => {
        setSegments(prev => prev.filter(seg => seg.id !== id));
        if (activeSegmentId === id) {
            setActiveSegmentId(null);
        }
    }, [activeSegmentId]);

    const handleReorderSegment = useCallback((targetIndex: number) => {
        const sourceIndex = dragIndexRef.current;
        if (sourceIndex === null || sourceIndex === targetIndex) return;
        setSegments(prev => {
            const next = [...prev];
            const [moved] = next.splice(sourceIndex, 1);
            next.splice(targetIndex, 0, moved);
            return next;
        });
        dragIndexRef.current = null;
    }, []);

    const activeSegment = useMemo(
        () => segments.find(seg => seg.id === activeSegmentId) || null,
        [segments, activeSegmentId]
    );

    const previewScene = useMemo(() => {
        const baseScene = activeSegment
            ? {
                id: "preview",
                type: "lyrics" as const,
                version: 0,
                updatedAt: 0,
                payload: {
                    title: title || "Sin título",
                    segmentTitle: activeSegment.title,
                    content: activeSegment.content,
                },
                styles: {
                    fontFamily: settings.fontFamily,
                    fontSize: settings.fontSize,
                    textColor: settings.textColor,
                    backgroundColor: settings.backgroundColor,
                    align: settings.align,
                },
                meta: {
                    title: title || "Letra",
                    subtitle: activeSegment.title,
                    sourceModule: "lyrics" as const,
                },
            }
            : liveScene?.type === "lyrics"
                ? {
                    ...liveScene,
                    id: "preview-live",
                }
                : null;
        return baseScene ?? null;
    }, [activeSegment, title, settings, liveScene]);

    const { previewScale, previewOffset } = useMemo(() => {
        if (!previewWidth || !previewHeight) {
            return { previewScale: 1, previewOffset: { x: 0, y: 0 } };
        }
        const scale = Math.max(previewWidth / 1920, previewHeight / 1080);
        const x = (previewWidth - 1920 * scale) / 2;
        const y = (previewHeight - 1080 * scale) / 2;
        return { previewScale: scale, previewOffset: { x, y } };
    }, [previewWidth, previewHeight]);

    useEffect(() => {
        if (!liveScene || liveScene.type !== "lyrics") return;
        if (activeSegmentId) return;
        const match = segments.find((segment) => segment.content.trim() === liveScene.payload.content.trim());
        if (match) {
            setActiveSegmentId(match.id);
        }
    }, [liveScene, segments, activeSegmentId]);

    const handleSendSegment = useCallback((segment: Segment, forceLive?: boolean) => {
        if (!isConnected) return;
        const scene = {
            id: lyricsSceneIdRef.current,
            type: "lyrics" as const,
            payload: {
                title,
                segmentTitle: segment.title,
                content: segment.content,
            },
            styles: {
                fontFamily: settings.fontFamily,
                fontSize: settings.fontSize,
                textColor: settings.textColor,
                backgroundColor: settings.backgroundColor,
                align: settings.align,
            },
            meta: {
                title: title || "Letra",
                subtitle: segment.title,
                sourceModule: "lyrics" as const,
            },
        };
        sendScene(scene, { forceLive: forceLive ?? true });
        setActiveSegmentId(segment.id);
        lastPayloadRef.current = JSON.stringify(scene);
        autoFollowArmedRef.current = true;
    }, [isConnected, sendScene, title, settings]);

    const handleNextSegment = () => {
        if (!segments.length) return;
        const currentIndex = segments.findIndex(seg => seg.id === activeSegmentId);
        const nextIndex = currentIndex >= 0 ? Math.min(currentIndex + 1, segments.length - 1) : 0;
        handleSendSegment(segments[nextIndex]);
    };

    const handlePrevSegment = () => {
        if (!segments.length) return;
        const currentIndex = segments.findIndex(seg => seg.id === activeSegmentId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        handleSendSegment(segments[prevIndex]);
    };

    useEffect(() => {
        if (!autoFollow || !isConnected || !activeSegment) return;
        if (!isLiveLyrics) return;
        if (!autoFollowArmedRef.current) return;
        const scene = {
            id: lyricsSceneIdRef.current,
            type: "lyrics" as const,
            payload: {
                title,
                segmentTitle: activeSegment.title,
                content: activeSegment.content,
            },
            styles: {
                fontFamily: settings.fontFamily,
                fontSize: settings.fontSize,
                textColor: settings.textColor,
                backgroundColor: settings.backgroundColor,
                align: settings.align,
            },
            meta: {
                title: title || "Letra",
                subtitle: activeSegment.title,
                sourceModule: "lyrics" as const,
            },
        };
        const serialized = JSON.stringify(scene);
        if (serialized === lastPayloadRef.current) return;
        sendScene(scene, { forceLive: false });
        lastPayloadRef.current = serialized;
    }, [autoFollow, isConnected, activeSegment, settings, title, sendScene, isLiveLyrics]);

    const handleSaveSong = async () => {
        if (!title.trim()) return;
        setIsSaving(true);
        try {
            const saved = await lyricsService.saveSong({
                id: activeSongId ?? undefined,
                title: title.trim(),
                lyrics,
                segments,
                settings,
            });
            setActiveSongId(saved.id);
            setSongs(prev => {
                const existing = prev.filter(song => song.id !== saved.id);
                return [{ id: saved.id, title: saved.title, updatedAt: saved.updatedAt }, ...existing];
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadSong = async (id: string) => {
        const song = await lyricsService.getSong(id);
        setActiveSongId(song.id);
        setTitle(song.title);
        setLyrics(song.lyrics);
        setSegments(song.segments as Segment[]);
        setSettings(song.settings ?? defaultSettings);
        setActiveSegmentId(null);
        lastPayloadRef.current = "";
        autoFollowArmedRef.current = false;
    };

    const handleNewSong = () => {
        setActiveSongId(null);
        setTitle("");
        setLyrics("");
        setSegments([]);
        setSettings(defaultSettings);
        setSelectedText("");
        setActiveSegmentId(null);
        lastPayloadRef.current = "";
        autoFollowArmedRef.current = false;
    };

    const handleDeleteSong = async () => {
        if (!activeSongId) return;
        await lyricsService.deleteSong(activeSongId);
        setSongs(prev => prev.filter(song => song.id !== activeSongId));
        handleNewSong();
    };

    return (
        <Card className="glass-panel w-full min-h-[calc(100vh-220px)]">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-2xl font-semibold">Letras de alabanza</CardTitle>
                        <p className="text-sm text-slate-500">
                            Segmentos editables, orden libre y envío en vivo a pantallas externas.
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
                <section className="flex flex-col gap-4">
                    <AccordionSection title="Biblioteca" icon={<ListMusic className="h-4 w-4" />} defaultOpen>
                        <div className="flex flex-col gap-2 max-h-40 overflow-auto">
                            {songs.length === 0 && (
                                <p className="text-sm text-slate-400">Aún no hay canciones guardadas.</p>
                            )}
                            {songs.map(song => (
                                <button
                                    key={song.id}
                                    type="button"
                                    onClick={() => handleLoadSong(song.id)}
                                    className={`rounded-xl px-3 py-2 text-left text-sm ${
                                        activeSongId === song.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    {song.title}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <Button
                                size="sm"
                                onClick={handleSaveSong}
                                disabled={isSaving || !title.trim()}
                                className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800"
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Guardar
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleNewSong}
                                className="h-8 text-xs"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Nuevo
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-rose-600 hover:text-rose-700"
                                onClick={handleDeleteSong}
                                disabled={!activeSongId}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                            </Button>
                        </div>
                    </AccordionSection>
                    <AccordionSection title="Letra principal" icon={<PenLine className="h-4 w-4" />} defaultOpen>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Título de la canción"
                            className="mt-3"
                        />
                        <textarea
                            ref={textareaRef}
                            value={lyrics}
                            onChange={(e) => setLyrics(e.target.value)}
                            onMouseUp={updateSelectedText}
                            onKeyUp={updateSelectedText}
                            placeholder="Pega aquí toda la letra. Selecciona un párrafo para convertirlo en segmento."
                            className="mt-3 h-64 w-full resize-none rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                onClick={handleCreateSegment}
                                disabled={!selectedText}
                                size="sm"
                                className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Crear segmento
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAutoSegment}
                                disabled={!lyrics.trim()}
                                size="sm"
                                className="h-8 text-xs"
                            >
                                <Wand2 className="mr-2 h-4 w-4" />
                                Auto-segmentar
                            </Button>
                            {selectedText && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">
                                        Selección lista: {selectedText.slice(0, 48)}...
                                    </span>
                                    <div
                                        draggable
                                        onDragStart={() => {
                                            dragSelectionRef.current = true;
                                        }}
                                        onDragEnd={() => {
                                            dragSelectionRef.current = false;
                                        }}
                                        className="cursor-grab rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700"
                                    >
                                        Arrastra para crear
                                    </div>
                                </div>
                            )}
                        </div>
                    </AccordionSection>
                </section>

                <section className="flex flex-col gap-4">
                    <AccordionSection title="Banco de segmentos" icon={<Music className="h-4 w-4" />} defaultOpen>
                        <div
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                                if (dragSelectionRef.current && selectedText) {
                                    addSegment(selectedText);
                                    setSelectedText("");
                                }
                                dragSelectionRef.current = false;
                            }}
                        >
                        <p className="mt-2 text-xs text-slate-500">Arrastra para definir el orden de la canción.</p>
                        <div className="mt-3 flex flex-col gap-3 max-h-[520px] overflow-auto px-2">
                            {segments.length === 0 && (
                                <p className="text-sm text-slate-400">
                                    Crea segmentos desde la letra o usa auto-segmentar.
                                </p>
                            )}
                            {segments.map((segment, index) => (
                                <div
                                    key={segment.id}
                                    className={`rounded-xl border border-slate-200 bg-white/80 p-2 shadow-sm ${
                                        activeSegmentId === segment.id ? "ring-2 ring-emerald-300 border-emerald-300/60" : ""
                                    }`}
                                    draggable
                                    onClick={() => {
                                        autoFollowArmedRef.current = false;
                                        setActiveSegmentId(segment.id);
                                    }}
                                    onDragStart={() => (dragIndexRef.current = index)}
                                    onDragEnd={() => {
                                        dragIndexRef.current = null;
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => handleReorderSegment(index)}
                                >
                                    <div className="flex items-start gap-2">
                                        <GripVertical className="mt-1 h-4 w-4 text-slate-400" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={segment.title}
                                                    onChange={(e) => handleUpdateSegment(segment.id, { title: e.target.value })}
                                                    className="h-7 border-slate-200 bg-white/90 text-xs font-medium"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSegment(segment.id)}
                                                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                                                    aria-label="Eliminar segmento"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <p className="mt-2 max-h-14 overflow-hidden text-[11px] text-slate-500">{segment.content}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {segmentKinds.map((kind) => (
                                                    <button
                                                        key={kind}
                                                        type="button"
                                                        onClick={() => handleUpdateSegment(segment.id, { kind })}
                                                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                                                            segment.kind === kind
                                                                ? "bg-slate-900 text-white"
                                                                : "bg-slate-100 text-slate-500"
                                                        }`}
                                                    >
                                                        {kind}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    {colorPalette.map((color) => (
                                                        <button
                                                            key={color.label}
                                                            type="button"
                                                            onClick={() => handleUpdateSegment(segment.id, { color: color.value })}
                                                            className={`h-4 w-4 rounded-full border ${color.value} ${
                                                                segment.color === color.value ? "ring-2 ring-slate-300" : ""
                                                            }`}
                                                            aria-label={`Color ${color.label}`}
                                                        />
                                                    ))}
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="h-7 px-3 text-[11px] bg-slate-900 text-white hover:bg-slate-800"
                                                    onClick={() => handleSendSegment(segment)}
                                                    disabled={!isConnected}
                                                >
                                                    <Send className="mr-1 h-3 w-3" />
                                                    Enviar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        </div>
                    </AccordionSection>
                </section>

                <section className="flex flex-col gap-4">
                    <AccordionSection title="Vista previa" icon={<Layers className="h-4 w-4" />} defaultOpen>
                        <div ref={previewRef} className="mt-3 h-[320px] overflow-hidden rounded-2xl bg-black">
                            <div className="relative h-full w-full">
                                <div
                                    className="absolute left-0 top-0 origin-top-left"
                                    style={{
                                        width: 1920,
                                        height: 1080,
                                        transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
                                    }}
                                >
                                    <SceneRenderer
                                        scene={previewScene}
                                        className="h-full w-full"
                                        placeholder="Selecciona un segmento para previsualizar"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>
                                {status.mode === "live" && liveScene?.type === "lyrics"
                                    ? `Letra en salida: ${liveScene.payload.title || "Sin título"}`
                                    : status.mode === "live"
                                        ? "Otra salida activa"
                                        : status.mode === "paused"
                                            ? "Transmisión en espera"
                                            : "Transmisión detenida"}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={handlePrevSegment} disabled={!isConnected || !activeSegment}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={handleNextSegment} disabled={!isConnected || segments.length === 0}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3 text-xs text-slate-500">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1">
                                    Fuente
                                    <Input
                                        value={settings.fontFamily}
                                        onChange={(e) => setSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    Tamaño
                                    <Input
                                        type="number"
                                        value={settings.fontSize}
                                        onChange={(e) => setSettings(prev => ({ ...prev, fontSize: Number(e.target.value) || 32 }))}
                                        className="h-8 text-xs"
                                    />
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1">
                                    Texto
                                    <Input
                                        type="color"
                                        value={settings.textColor}
                                        onChange={(e) => setSettings(prev => ({ ...prev, textColor: e.target.value }))}
                                        className="h-8 w-full p-0"
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    Fondo
                                    <Input
                                        type="color"
                                        value={settings.backgroundColor}
                                        onChange={(e) => setSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                                        className="h-8 w-full p-0"
                                    />
                                </label>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-slate-500">Alinear</span>
                                <div className="flex gap-2">
                                    {(["left", "center", "right"] as const).map((align) => (
                                        <button
                                            key={align}
                                            type="button"
                                            onClick={() => setSettings(prev => ({ ...prev, align }))}
                                            className={`rounded-full px-2 py-1 text-[11px] ${
                                                settings.align === align ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                                            }`}
                                        >
                                            {align === "left" ? "Izq" : align === "center" ? "Centro" : "Der"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </AccordionSection>
                </section>
            </CardContent>
        </Card>
    );
}
