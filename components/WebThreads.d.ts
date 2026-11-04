import type { CSSProperties, ReactElement } from "react";

export interface WebThreadsProps {
  colors?: string[];
  coreColor?: string;
  backgroundColor?: string;
  lightMode?: boolean;
  threadCount?: number;
  speed?: number;
  frequency?: number;
  spread?: number;
  taper?: number;
  position?: number;
  pinch?: number;
  nodes?: number;
  angle?: number;
  glow?: number;
  falloff?: number;
  thickness?: number;
  brightness?: number;
  opacity?: number;
  depth?: number;
  pulses?: number;
  mirror?: boolean;
  shimmer?: boolean;
  fade?: number;
  grain?: number | boolean;
  intro?: boolean;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  pulseOnClick?: boolean;
  paused?: boolean;
  dpr?: number;
  className?: string;
  style?: CSSProperties;
}

export default function WebThreads(props: WebThreadsProps): ReactElement;
