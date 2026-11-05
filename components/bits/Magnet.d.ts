import type { CSSProperties, ReactElement, ReactNode } from "react";

export interface MagnetProps {
  children?: ReactNode;
  /** 磁吸半径（px） */
  padding?: number;
  /** 跟随强度，越大位移越小 */
  magnetStrength?: number;
  maxOffset?: number;
  exclusive?: boolean;
  axis?: "both" | "x" | "y";
  tilt?: number;
  scale?: number;
  spring?: { stiffness?: number; damping?: number; mass?: number };
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  wrapperClassName?: string;
  innerClassName?: string;
  style?: CSSProperties;
}

export default function Magnet(props: MagnetProps): ReactElement;
