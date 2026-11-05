import type { CSSProperties, ElementType, HTMLAttributes, ReactElement, ReactNode } from "react";

export interface StarBorderProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  href?: string;
  children?: ReactNode;
  color?: string;
  trailColor?: string;
  duration?: number;
  thickness?: number;
  radius?: number;
  trailLength?: number;
  stars?: number;
  glow?: number;
  sparkle?: boolean;
  direction?: "clockwise" | "counterclockwise";
  hover?: "lap" | "brighten" | "reveal" | "none";
  clickPulse?: boolean;
  theme?: "dark" | "light";
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  className?: string;
  style?: CSSProperties;
}

export default function StarBorder(props: StarBorderProps): ReactElement;
