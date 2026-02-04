import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useElementSize } from "../../hooks/useElementSize";
import type { CoverLayer, CoverDocument, TextLayer, BadgeLayer, ShapeLayer, ImageLayer, IconLayer } from "../../types/cover-design";
import type { Scene, VerseScene, LyricsScene, MediaScene, CoverScene, VerseBackground } from "../../types/live";

interface SceneRendererProps {
  scene: Scene | null;
  className?: string;
  showPlaceholder?: boolean;
  placeholder?: string;
  playMedia?: boolean;
  mode?: "preview" | "live";
}

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const defaultPlaceholder = "Esperando contenido...";

export default function SceneRenderer({
  scene,
  className,
  showPlaceholder = true,
  placeholder = defaultPlaceholder,
  playMedia = false,
  mode = "preview",
}: SceneRendererProps) {
  if (!scene) {
    return showPlaceholder ? (
      <div className={`flex h-full w-full items-center justify-center text-center text-white/80 ${className ?? ""}`}>
        <p className="rounded-2xl bg-black/40 px-6 py-4 text-lg">{placeholder}</p>
      </div>
    ) : null;
  }

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <AnimatePresence mode="wait">
        {scene.type === "verse" && (
          <VerseSceneView key={scene.id} scene={scene} playMedia={playMedia} />
        )}
        {scene.type === "lyrics" && (
          <LyricsSceneView key={scene.id} scene={scene} />
        )}
        {scene.type === "media" && (
          <MediaSceneView key={scene.id} scene={scene} playMedia={playMedia} />
        )}
        {scene.type === "cover" && (
          <CoverSceneView key={scene.id} scene={scene} mode={mode} />
        )}
      </AnimatePresence>
    </div>
  );
}

function VerseSceneView({ scene, playMedia }: { scene: VerseScene; playMedia: boolean }) {
  const styles = scene.styles ?? {};
  const rawBackground: VerseBackground =
    scene.payload.background ?? {
      kind: "color",
      color: styles.backgroundColor || "#000000",
    };
  const background: VerseBackground =
    (rawBackground.kind === "image" || rawBackground.kind === "video") && !rawBackground.src
      ? { kind: "color", color: styles.backgroundColor || "#000000" }
      : rawBackground;
  const layout = scene.payload.layout ?? "overlay";
  const showText = scene.payload.showText !== false;
  const showReference = scene.payload.showReference !== false;
  const mediaState = scene.payload.mediaState ?? {};
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (mediaState.currentTime !== undefined) {
      const diff = Math.abs(videoRef.current.currentTime - mediaState.currentTime);
      if (diff > 0.4) {
        videoRef.current.currentTime = mediaState.currentTime;
      }
    }
    if (playMedia && mediaState.isPlaying) {
      videoRef.current.play().catch(() => undefined);
    } else {
      videoRef.current.pause();
    }
  }, [playMedia, mediaState.isPlaying, mediaState.currentTime, background.src]);
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {layout === "split" && (background.kind === "image" || background.kind === "video") ? (
        <div className="flex h-full w-full items-center justify-center gap-6 px-10">
          <div className="flex h-full w-1/2 items-center justify-center">
            {background.kind === "image" && background.src && (
              <img
                src={background.src}
                alt="Fondo"
                className={`h-full w-full ${background.fit === "cover" ? "object-cover" : "object-contain"}`}
              />
            )}
            {background.kind === "video" && background.src && (
              <video
                ref={videoRef}
                src={background.src}
                className={`h-full w-full ${background.fit === "cover" ? "object-cover" : "object-contain"}`}
                playsInline
                preload="metadata"
                muted={mediaState.muted ?? true}
                loop={mediaState.loop ?? true}
                onLoadedMetadata={() => {
                  if (mediaState.currentTime !== undefined && videoRef.current) {
                    videoRef.current.currentTime = mediaState.currentTime;
                  }
                }}
              />
            )}
          </div>
          {showText && (
            <div
              className="w-1/2 rounded-3xl bg-black/50 p-10 text-center shadow-2xl"
              style={{
                fontFamily: styles.fontFamily || "Space Grotesk",
                color: styles.textColor || "#ffffff",
                textAlign: styles.align || "center",
              }}
            >
              {showReference && (
                <p
                  className="uppercase tracking-[0.4em] opacity-70"
                  style={{ fontSize: styles.referenceSize || 18, color: styles.referenceColor || "#ffffff" }}
                >
                  {scene.payload.reference}
                </p>
              )}
              <p
                className="mt-6 break-words"
                style={{
                  fontSize: styles.fontSize || 56,
                  lineHeight: styles.lineHeight || 1.2,
                }}
              >
                {scene.payload.text}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative h-full w-full">
          {background.kind === "color" && (
            <div className="absolute inset-0" style={{ backgroundColor: background.color || styles.backgroundColor || "#000000" }} />
          )}
          {background.kind === "image" && background.src && (
            <img
              src={background.src}
              alt="Fondo"
              className={`absolute inset-0 h-full w-full ${background.fit === "cover" ? "object-cover" : "object-contain"}`}
            />
          )}
          {background.kind === "video" && background.src && (
            <video
              ref={videoRef}
              src={background.src}
              className={`absolute inset-0 h-full w-full ${background.fit === "cover" ? "object-cover" : "object-contain"}`}
              playsInline
              preload="metadata"
              muted={mediaState.muted ?? true}
              loop={mediaState.loop ?? true}
              onLoadedMetadata={() => {
                if (mediaState.currentTime !== undefined && videoRef.current) {
                  videoRef.current.currentTime = mediaState.currentTime;
                }
              }}
            />
          )}
          {(background.kind === "image" || background.kind === "video") && background.overlayColor && (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: background.overlayColor, opacity: background.overlayOpacity ?? 0.4 }}
            />
          )}
          {showText && (
            <div className="absolute inset-0 flex items-center justify-center px-10">
              <div
                className="rounded-3xl bg-black/50 p-10 text-center shadow-2xl"
                style={{
                  maxWidth: styles.maxWidth ? `${styles.maxWidth}px` : "90%",
                  fontFamily: styles.fontFamily || "Space Grotesk",
                  color: styles.textColor || "#ffffff",
                  textAlign: styles.align || "center",
                }}
              >
                {showReference && (
                  <p
                    className="uppercase tracking-[0.4em] opacity-70"
                    style={{ fontSize: styles.referenceSize || 18, color: styles.referenceColor || "#ffffff" }}
                  >
                    {scene.payload.reference}
                  </p>
                )}
                <p
                  className="mt-6 break-words"
                  style={{
                    fontSize: styles.fontSize || 56,
                    lineHeight: styles.lineHeight || 1.2,
                  }}
                >
                  {scene.payload.text}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function LyricsSceneView({ scene }: { scene: LyricsScene }) {
  const styles = scene.styles ?? {};
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-10"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div
        className="w-full max-w-5xl rounded-3xl p-10 text-center shadow-2xl"
        style={{
          backgroundColor: styles.backgroundColor || "#000000",
          color: styles.textColor || "#ffffff",
          fontFamily: styles.fontFamily || "Space Grotesk",
          textAlign: styles.align || "center",
        }}
      >
        <p className="text-xs uppercase tracking-[0.4em] opacity-70">{scene.payload.title}</p>
        <p className="mt-6 whitespace-pre-line" style={{ fontSize: styles.fontSize || 52 }}>
          {scene.payload.content}
        </p>
      </div>
    </motion.div>
  );
}

function MediaSceneView({ scene, playMedia }: { scene: MediaScene; playMedia: boolean }) {
  const { kind, src, color, fit, currentTime, isPlaying, muted, loop } = scene.payload;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!videoRef.current) return;
    if (currentTime !== undefined) {
      const diff = Math.abs(videoRef.current.currentTime - currentTime);
      if (diff > 0.4) {
        videoRef.current.currentTime = currentTime;
      }
    }
    if (playMedia && isPlaying) {
      videoRef.current.play().catch(() => undefined);
    } else {
      videoRef.current.pause();
    }
  }, [playMedia, isPlaying, currentTime, src]);

  if (kind === "color") {
    return (
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: color || "#000000" }}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      />
    );
  }

  if (kind === "video" && src) {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center bg-black"
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <video
          ref={videoRef}
          src={src}
          className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
          playsInline
          preload="metadata"
          muted={muted ?? true}
          loop={loop ?? true}
          onLoadedMetadata={() => {
            if (currentTime !== undefined && videoRef.current) {
              videoRef.current.currentTime = currentTime;
            }
            if (playMedia && isPlaying && videoRef.current) {
              videoRef.current.play().catch(() => undefined);
            }
          }}
          onTimeUpdate={() => {
            if (!playMedia || !isPlaying) {
              videoRef.current?.pause();
            }
          }}
        />
      </motion.div>
    );
  }

  if (kind === "image" && src) {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center bg-black"
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <img src={src} alt="Media" className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
      </motion.div>
    );
  }

  return null;
}

function CoverSceneView({ scene, mode }: { scene: CoverScene; mode: "preview" | "live" }) {
  const doc = scene.payload.doc;
  return (
    <motion.div
      className="absolute inset-0"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <CoverDocumentRenderer doc={doc} mode={mode} />
    </motion.div>
  );
}

function CoverDocumentRenderer({ doc, mode }: { doc: CoverDocument; mode: "preview" | "live" }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useElementSize(containerRef);
  const isLive = mode === "live";

  const scale = useMemo(() => {
    if (!width || !height) return 1;
    return Math.min(width / doc.canvas.width, height / doc.canvas.height);
  }, [width, height, doc.canvas.width, doc.canvas.height]);

  const scaledCanvas = useMemo(
    () => ({
      width: doc.canvas.width * scale,
      height: doc.canvas.height * scale,
    }),
    [doc.canvas.width, doc.canvas.height, scale]
  );

  const backgroundStyle = useMemo(() => {
    const bg = doc.canvas.background;
    if (bg.type === "solid") {
      return { backgroundColor: bg.color };
    }
    if (bg.type === "gradient") {
      const angle = bg.angle ?? 135;
      return { background: `linear-gradient(${angle}deg, ${bg.from}, ${bg.to})` };
    }
    if (bg.type === "image") {
      return { backgroundColor: bg.overlayColor ?? "#000000" };
    }
    return { backgroundColor: "#000000" };
  }, [doc.canvas.background]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-black ${isLive ? "flex items-center justify-center" : ""}`}
    >
      <div
        className="relative"
        style={{
          width: scaledCanvas.width,
          height: scaledCanvas.height,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left overflow-hidden"
          style={{
            width: doc.canvas.width,
            height: doc.canvas.height,
            transform: `scale(${scale})`,
            borderRadius: isLive ? 0 : 28,
            boxShadow: isLive ? undefined : "0 30px 80px rgba(15,23,42,0.45)",
            ...backgroundStyle,
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
              opacity: doc.canvas.background.overlayOpacity ?? 0.4,
              backdropFilter: doc.canvas.background.blur ? `blur(${doc.canvas.background.blur}px)` : undefined,
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
          {doc.layers.map((layer) => renderLayer(layer, doc.canvas.width))}
        </div>
      </div>
    </div>
  );
}

function renderLayer(layer: CoverLayer, canvasWidth: number) {
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
  };

  switch (layer.type) {
    case "text":
      return renderTextLayer(layer, baseStyle, canvasWidth);
    case "badge":
      return renderBadgeLayer(layer, baseStyle);
    case "shape":
      return renderShapeLayer(layer, baseStyle);
    case "image":
      return renderImageLayer(layer, baseStyle);
    case "icon":
      return renderIconLayer(layer, baseStyle);
    default:
      return null;
  }
}

function renderTextLayer(layer: TextLayer, style: CSSProperties, canvasWidth: number) {
  const fontSize = layer.style.fontSize ?? 48;
  return (
    <div
      key={layer.id}
      style={{
        ...style,
        fontFamily: layer.style.fontFamily,
        fontWeight: layer.style.fontWeight ?? 600,
        fontSize: fontSize,
        lineHeight: layer.style.lineHeight ?? 1.1,
        letterSpacing: layer.style.letterSpacing ?? 0,
        color: layer.style.color,
        textAlign: layer.style.align ?? "left",
        display: "flex",
        alignItems: "center",
        justifyContent: layer.style.align === "center" ? "center" : layer.style.align === "right" ? "flex-end" : "flex-start",
        padding: Math.max(0, canvasWidth * 0.01),
        whiteSpace: "pre-wrap",
        textShadow: layer.style.shadow
          ? `${layer.style.shadow.x}px ${layer.style.shadow.y}px ${layer.style.shadow.blur}px ${layer.style.shadow.color}`
          : undefined,
        WebkitTextStroke: layer.style.outline
          ? `${layer.style.outline.width}px ${layer.style.outline.color}`
          : undefined,
      }}
    >
      {layer.text}
    </div>
  );
}

function renderBadgeLayer(layer: BadgeLayer, style: CSSProperties) {
  return (
    <div
      key={layer.id}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: layer.style.background,
        color: layer.style.color,
        fontFamily: layer.style.fontFamily,
        fontSize: layer.style.fontSize,
        fontWeight: layer.style.fontWeight ?? 600,
        letterSpacing: layer.style.letterSpacing ?? 2,
        borderRadius: layer.style.radius ?? 999,
        textTransform: "uppercase",
      }}
    >
      {layer.text}
    </div>
  );
}

function renderShapeLayer(layer: ShapeLayer, style: CSSProperties) {
  return (
    <div
      key={layer.id}
      style={{
        ...style,
        backgroundColor: layer.fill,
        border: layer.stroke ? `${layer.strokeWidth ?? 1}px solid ${layer.stroke}` : undefined,
        borderRadius: layer.shape === "circle" ? "999px" : "18px",
      }}
    />
  );
}

function renderImageLayer(layer: ImageLayer, style: CSSProperties) {
  return (
    <div
      key={layer.id}
      style={{
        ...style,
        overflow: "hidden",
        borderRadius: layer.radius ?? 16,
      }}
    >
      <img
        src={layer.src}
        alt={layer.name}
        className="h-full w-full"
        style={{
          objectFit: layer.fit === "contain" ? "contain" : "cover",
          objectPosition: `${layer.positionX ?? 50}% ${layer.positionY ?? 50}%`,
          transform: layer.scale && layer.scale !== 1 ? `scale(${layer.scale})` : undefined,
          transformOrigin: `${layer.positionX ?? 50}% ${layer.positionY ?? 50}%`,
        }}
      />
    </div>
  );
}

function renderIconLayer(layer: IconLayer, style: CSSProperties) {
  return (
    <div
      key={layer.id}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: layer.color,
        fontSize: layer.size ?? 48,
      }}
    >
      {layer.icon}
    </div>
  );
}
