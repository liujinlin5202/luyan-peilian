import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";

export interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  container?: string | HTMLElement | null;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  blur?: number;
  rotate?: number;
  tilt?: number;
  wipe?: "none" | "up" | "down" | "left" | "right" | "center";
  threshold?: number;
  delay?: number;
  stagger?: number;
  staggerFrom?: "start" | "end" | "center" | "random" | number;
  trigger?: "scroll" | "mount";
  once?: boolean;
  scrub?: boolean | number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

export default function AnimatedContent(props: AnimatedContentProps): ReactElement;
