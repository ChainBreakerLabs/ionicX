import type { CoverDocument, CoverLayer } from "../types/cover-design";
import type { Scene } from "../types/live";

const ABSOLUTE_URL_PATTERN = /^(https?:|tauri:|data:|blob:|file:)/i;

export function ensureAbsoluteUrl(url?: string | null, origin?: string | null) {
  if (!url) return url ?? undefined;
  if (ABSOLUTE_URL_PATTERN.test(url)) {
    if (!origin) return url;
    try {
      const parsed = new URL(url);
      const originUrl = new URL(origin);
      const isLocalHost =
        parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "tauri.localhost";
      if (isLocalHost && parsed.pathname.startsWith("/api/ionicx/")) {
        if (parsed.origin !== originUrl.origin) {
          return `${originUrl.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      }
    } catch {
      return url;
    }
    return url;
  }
  if (!origin) return url;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}

export function stripBackendOrigin(url?: string | null, origin?: string | null) {
  if (!url) return url ?? undefined;
  if (!origin) return url;
  return url.startsWith(origin) ? url.slice(origin.length) || "/" : url;
}

export function normalizeCoverDoc(doc: CoverDocument, origin: string) {
  const background = doc.canvas.background;
  const normalizedBackground =
    background.type === "image" && background.src
      ? { ...background, src: ensureAbsoluteUrl(background.src, origin) ?? background.src }
      : background;

  const normalizedLayers = doc.layers.map((layer: CoverLayer) => {
    if (layer.type !== "image") return layer;
    const src = ensureAbsoluteUrl(layer.src, origin);
    if (!src || src === layer.src) return layer;
    return { ...layer, src };
  });

  return {
    ...doc,
    canvas: {
      ...doc.canvas,
      background: normalizedBackground,
    },
    layers: normalizedLayers,
  };
}

export function stripCoverDoc(doc: CoverDocument, origin: string) {
  const background = doc.canvas.background;
  const strippedBackground =
    background.type === "image" && background.src
      ? { ...background, src: stripBackendOrigin(background.src, origin) ?? background.src }
      : background;

  const strippedLayers = doc.layers.map((layer: CoverLayer) => {
    if (layer.type !== "image") return layer;
    const src = stripBackendOrigin(layer.src, origin);
    if (!src || src === layer.src) return layer;
    return { ...layer, src };
  });

  return {
    ...doc,
    canvas: {
      ...doc.canvas,
      background: strippedBackground,
    },
    layers: strippedLayers,
  };
}

export function normalizeSceneUrls(scene: Scene, origin: string): Scene {
  if (!origin) return scene;

  if (scene.type === "media") {
    const src = ensureAbsoluteUrl(scene.payload.src, origin);
    return src && src !== scene.payload.src
      ? { ...scene, payload: { ...scene.payload, src } }
      : scene;
  }

  if (scene.type === "verse") {
    const bg = scene.payload.background;
    if (bg && (bg.kind === "image" || bg.kind === "video") && bg.src) {
      const src = ensureAbsoluteUrl(bg.src, origin);
      if (src && src !== bg.src) {
        return {
          ...scene,
          payload: {
            ...scene.payload,
            background: { ...bg, src },
          },
        };
      }
    }
    return scene;
  }

  if (scene.type === "cover") {
    const doc = normalizeCoverDoc(scene.payload.doc, origin);
    return doc !== scene.payload.doc ? { ...scene, payload: { ...scene.payload, doc } } : scene;
  }

  return scene;
}
