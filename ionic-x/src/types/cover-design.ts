export type CoverLayerType = "text" | "image" | "shape" | "badge" | "icon";

export type CoverBackground =
  | {
      type: "solid";
      color: string;
    }
  | {
      type: "gradient";
      from: string;
      to: string;
      angle?: number;
    }
  | {
      type: "image";
      src: string;
      fit?: "cover" | "contain";
      opacity?: number;
      positionX?: number;
      positionY?: number;
      scale?: number;
      overlayColor?: string;
      overlayOpacity?: number;
      blur?: number;
      vignette?: number;
    };

export interface CoverCanvas {
  width: number;
  height: number;
  safeArea: number;
  background: CoverBackground;
  preset: "16:9" | "4:3";
}

export interface CoverLayerBase {
  id: string;
  type: CoverLayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  role?: "title" | "subtitle" | "speaker" | "date" | "badge" | "custom";
}

export interface TextLayer extends CoverLayerBase {
  type: "text";
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight?: number;
    color: string;
    align?: "left" | "center" | "right";
    lineHeight?: number;
    letterSpacing?: number;
    shadow?: { color: string; x: number; y: number; blur: number };
    outline?: { color: string; width: number };
  };
}

export interface ImageLayer extends CoverLayerBase {
  type: "image";
  src: string;
  fit?: "cover" | "contain";
  radius?: number;
  positionX?: number;
  positionY?: number;
  scale?: number;
}

export interface ShapeLayer extends CoverLayerBase {
  type: "shape";
  shape: "rect" | "circle";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface BadgeLayer extends CoverLayerBase {
  type: "badge";
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight?: number;
    color: string;
    background: string;
    radius?: number;
    letterSpacing?: number;
  };
}

export interface IconLayer extends CoverLayerBase {
  type: "icon";
  icon: string;
  color: string;
  size?: number;
}

export type CoverLayer = TextLayer | ImageLayer | ShapeLayer | BadgeLayer | IconLayer;

export interface CoverDocument {
  canvas: CoverCanvas;
  layers: CoverLayer[];
}
