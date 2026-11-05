import type { ReactElement, ReactNode } from "react";

export interface RubberSegmentItem {
  value: string;
  label?: ReactNode;
  icon?: ReactNode;
}

export interface RubberSegmentProps {
  items: (string | RubberSegmentItem)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  trackColor?: string;
  thumbColor?: string;
  textColor?: string;
  activeTextColor?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  inset?: number;
  equalSlots?: boolean;
  stretch?: number;
  squash?: number;
  speed?: number;
  glide?: number;
  draggable?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export default function RubberSegment(props: RubberSegmentProps): ReactElement;
