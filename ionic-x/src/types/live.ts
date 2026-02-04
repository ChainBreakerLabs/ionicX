import type { CoverDocument } from "./cover-design";

export type SceneType = "verse" | "lyrics" | "cover" | "media";

export type LiveMode = "connected" | "live" | "paused";

export interface LiveStatus {
  mode: LiveMode;
  updatedAt: number;
}

export interface SceneMeta {
  title?: string;
  subtitle?: string;
  sourceModule?: "search" | "lyrics" | "covers" | "media" | "system";
}

export interface SceneBase<TType extends SceneType, TPayload, TStyles = Record<string, unknown>> {
  id: string;
  type: TType;
  version: number;
  updatedAt: number;
  payload: TPayload;
  styles?: TStyles;
  meta?: SceneMeta;
}

export interface VersePayload {
  reference: string;
  text: string;
  translation?: string;
  background?: VerseBackground;
  layout?: VerseLayout;
  showText?: boolean;
  showReference?: boolean;
  mediaState?: VerseMediaState;
}

export interface VerseStyles {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  align?: "left" | "center" | "right";
  backgroundColor?: string;
  referenceSize?: number;
  referenceColor?: string;
  maxWidth?: number;
}

export type VerseScene = SceneBase<"verse", VersePayload, VerseStyles>;

export type VerseLayout = "overlay" | "split";

export interface VerseBackground {
  kind: "color" | "image" | "video";
  color?: string;
  src?: string;
  fit?: "contain" | "cover";
  overlayColor?: string;
  overlayOpacity?: number;
}

export interface VerseMediaState {
  isPlaying?: boolean;
  currentTime?: number;
  muted?: boolean;
  loop?: boolean;
}

export interface VersePreferences {
  styles: VerseStyles;
  background: VerseBackground;
  layout: VerseLayout;
  showText: boolean;
  showReference: boolean;
  mediaState: VerseMediaState;
}

export interface LyricsPayload {
  title: string;
  segmentTitle?: string;
  content: string;
}

export interface LyricsStyles {
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  align?: "left" | "center" | "right";
}

export type LyricsScene = SceneBase<"lyrics", LyricsPayload, LyricsStyles>;

export interface CoverPayload {
  doc: CoverDocument;
}

export type CoverScene = SceneBase<"cover", CoverPayload>;

export interface MediaPayload {
  kind: "image" | "video" | "color";
  src?: string;
  color?: string;
  fit?: "cover" | "contain";
  loop?: boolean;
  muted?: boolean;
  isPlaying?: boolean;
  currentTime?: number;
}

export interface MediaStyles {
  backgroundColor?: string;
}

export type MediaScene = SceneBase<"media", MediaPayload, MediaStyles>;

export type Scene = VerseScene | LyricsScene | CoverScene | MediaScene;

export type LiveMessage =
  | { type: "sceneUpdate"; scene: Scene | null }
  | { type: "liveStatus"; status: LiveStatus }
  | { type: "clientCount"; count: number }
  | { type: string; [key: string]: unknown };
