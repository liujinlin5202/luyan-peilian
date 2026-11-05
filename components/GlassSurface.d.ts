import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";

export interface GlassSurfaceProps {
  children?: ReactNode;
  /** 宽度，数字按 px 处理，也可传 "100%" 这类 CSS 值 */
  width?: number | string;
  /** 高度，同上 */
  height?: number | string;
  /** 圆角（px），使用 shape 时不生效 */
  borderRadius?: number;
  /** 边缘折射宽度，占短边的比例 */
  borderWidth?: number;
  /** 中心亮度（%） */
  brightness?: number;
  /** 中心静止程度 0-1 */
  opacity?: number;
  /** 边缘到中心的过渡柔化（px） */
  blur?: number;
  /** 透过玻璃的光线模糊（毛玻璃感） */
  displace?: number;
  /** 玻璃上的磨砂底色浓度 0-1 */
  backgroundOpacity?: number;
  saturation?: number;
  /** 边缘弯折强度，负值向内收 */
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: "R" | "G" | "B";
  yChannel?: "R" | "G" | "B";
  mixBlendMode?: string;
  /** false 时使用全表面磨砂效果 */
  refraction?: boolean;
  renderer?: "auto" | "svg" | "webgl";
  /** 玻璃背后的图片/视频/canvas，用于 WebGL 折射 */
  backdrop?: RefObject<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null>;
  /** 用 SVG/PNG 轮廓决定玻璃形状 */
  shape?: string;
  className?: string;
  style?: CSSProperties;
}

export default function GlassSurface(props: GlassSurfaceProps): ReactElement;
