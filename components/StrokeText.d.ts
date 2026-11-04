import type { CSSProperties, ReactElement } from "react";

export interface StrokeTextProps {
  text?: string;
  strokeColor?: string;
  fillColor?: string | null;
  strokeWidth?: number;
  drawDuration?: number;
  fillDelay?: number;
  stagger?: number;
  ease?: string;
  trigger?: "mount" | "hover" | "scroll" | "loop";
  fillMode?: "wipe" | "fade" | "none";
  wipeFrom?: "left" | "right" | "top" | "bottom";
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  letterSpacing?: number;
  reverse?: boolean;
  strokeStyle?: "solid" | "dashed" | "dotted";
  dashLength?: number;
  marching?: boolean;
  hoverRedraw?: boolean;
  shadow?: boolean;
  shadowColor?: string | null;
  className?: string;
  style?: CSSProperties;
}

export default function StrokeText(props: StrokeTextProps): ReactElement;
