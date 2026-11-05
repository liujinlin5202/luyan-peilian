import type { CSSProperties, ReactNode } from "react";

export interface ThoughtLineProps {
  label?: string;
  doneLabel?: string;
  renderLabel?: (label: string, working: boolean) => ReactNode;
  glyph?: ReactNode;
  steps?: string[];
  completedSteps?: number;
  collapsible?: boolean;
  collapseOnSettle?: boolean;
  color?: string;
  glyphColor?: string;
  fontSize?: number;
  breathPeriod?: number;
  breathDepth?: number;
  shimmer?: boolean;
  shimmerDuration?: number;
  settleDuration?: number;
  settleBlur?: number;
  working?: boolean;
  settleAfter?: number;
  elapsed?: number;
  showTimer?: boolean;
  onSettle?: (seconds: number) => void;
  className?: string;
  style?: CSSProperties;
}

export default function ThoughtLine(props: ThoughtLineProps): ReactNode;
