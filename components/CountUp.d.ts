import type { CSSProperties, ReactElement } from "react";

export interface CountUpProps {
  /** 目标数字（必填） */
  to: number;
  /** 起始数字，默认 0 */
  from?: number;
  /** up 递增 / down 递减（down 时 from 与 to 语义互换） */
  direction?: "up" | "down";
  /** 开始前的延迟（秒） */
  delay?: number;
  /** 动画时长（秒） */
  duration?: number;
  className?: string;
  style?: CSSProperties;
  /** 为 false 时不会自动播放 */
  startWhen?: boolean;
  /** 千分位分隔符 */
  separator?: string;
  prefix?: string;
  suffix?: string;
  /** count 数字跳动 / roll 逐位滚轮（里程表效果） */
  mode?: "count" | "roll";
  easing?: "easeOut" | "linear" | "expo" | "spring";
  /** 固定小数位；不传则跟随 from/to 的小数位 */
  decimals?: number;
  /** standard 常规 / compact 缩写为 1.2K、3.4M */
  format?: "standard" | "compact";
  /** view 滚动进入视口时开始 / load 立即开始 */
  trigger?: "view" | "load";
  /** 鼠标悬停时重播 */
  replayOnHover?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp(props: CountUpProps): ReactElement;
