"use client";

/* JellyRadio —— React Bits Pro「JellyRadio」果冻分段按钮（用户提供源码的 TypeScript 移植）：
   选中块带弹性位移与果冻形变；键盘方向键可切换；prefers-reduced-motion 直接跳变。 */

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, motionValue, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";

const DEFAULT_ITEMS = ["Off", "Low", "Medium", "High", "Max"];
const SIZES: Record<string, [number, number, number]> = {
  sm: [28, 12, 12],
  md: [36, 13, 16],
  lg: [44, 14, 20],
};

export type JellyItem =
  | string
  | { value: string; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean };

type Mv = { x: MotionValue<number>; sx: MotionValue<number>; sy: MotionValue<number> };

type SpringConfig = { type: "spring"; stiffness: number; damping: number; mass: number };

const spring = (k: number, m: number, bounce: number): SpringConfig => ({
  type: "spring",
  stiffness: k,
  damping: 2 * Math.sqrt(k * m) * (1 - bounce),
  mass: m,
});

type ChipProps = {
  mv: Mv;
  children: React.ReactNode;
  type?: "button";
  role?: string;
  "aria-checked"?: boolean;
  tabIndex?: number;
  disabled?: boolean;
  className?: string;
  "data-on"?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
};

const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ mv, children, ...rest }, ref) {
  const transform = useTransform(() => `translateX(${mv.x.get()}px) scale(${mv.sx.get()}, ${mv.sy.get()})`);
  return (
    <motion.button ref={ref} style={{ transform }} {...rest}>
      {children}
    </motion.button>
  );
});

export type JellyRadioProps = {
  items?: JellyItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  chipColor?: string;
  activeColor?: string;
  textColor?: string;
  activeTextColor?: string;
  size?: "sm" | "md" | "lg";
  gap?: number;
  radius?: number;
  swell?: number;
  barge?: number;
  shrink?: number;
  jelly?: number;
  bounce?: number;
  stagger?: number;
  stiffness?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function JellyRadio({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onChange,
  chipColor = "#27272a",
  activeColor = "#f5f5f5",
  textColor = "#f5f5f5",
  activeTextColor = "#18181b",
  size = "md",
  gap = 8,
  radius = 18,
  swell = 0.2,
  barge = 6,
  shrink = 0.05,
  jelly = 1,
  bounce = 0.25,
  stagger = 22,
  stiffness = 580,
  disabled = false,
  ariaLabel = "Options",
  className = "",
}: JellyRadioProps) {
  const list = items.map((it) => (typeof it === "string" ? { value: it, label: it } : it));
  const [inner, setInner] = useState<string | undefined>(() => defaultValue ?? list[0]?.value);
  const current = value ?? inner;
  const at = list.findIndex((it) => it.value === current);
  const reduce = useReducedMotion();
  const groupRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const widths = useRef<number[]>([]);
  const mvs = useRef<Mv[]>([]);
  const applied = useRef(at);
  const cfg = useRef({
    swell,
    barge,
    shrink,
    jelly,
    bounce,
    stagger,
    stiffness,
    reduce: !!reduce,
    count: list.length,
  });
  cfg.current = { swell, barge, shrink, jelly, bounce, stagger, stiffness, reduce: !!reduce, count: list.length };
  const [h, font, px] = SIZES[size] ?? SIZES.md;
  const itemsKey = list.map((it) => it.value).join("|");

  const mvFor = (i: number): Mv => {
    let mv = mvs.current[i];
    if (!mv) {
      mv = { x: motionValue(0), sx: motionValue(1), sy: motionValue(1) };
      mvs.current[i] = mv;
    }
    return mv;
  };

  const apply = (sel: number, instant: boolean) => {
    const C = cfg.current;
    const group = groupRef.current;
    const rtl = group ? getComputedStyle(group).direction === "rtl" : false;
    const push = sel >= 0 ? ((widths.current[sel] ?? 0) * C.swell) / 2 + C.barge : 0;
    for (let i = 0; i < C.count; i++) {
      const mv = mvFor(i);
      const on = i === sel;
      const far = Math.abs(i - sel);
      const dir = Math.sign(i - sel) * (rtl ? -1 : 1);
      const x = dir * push;
      const s = on ? 1 + C.swell : 1 - C.shrink;
      if (instant || C.reduce) {
        mv.x.jump(x);
        mv.sx.jump(s);
        mv.sy.jump(s);
        continue;
      }
      const k = C.stiffness * (1 - 0.12 * Math.min(far, 3));
      const inFlight = mv.x.isAnimating() || mv.sx.isAnimating() || mv.sy.isAnimating();
      const delay = inFlight ? 0 : (far * C.stagger) / 1000;
      animate(mv.x, x, { ...spring(k, 0.9, C.bounce), delay });
      const j = C.jelly;
      animate(mv.sx, s, {
        ...spring(k * (1 + 0.24 * j), 0.9 - 0.1 * j, Math.min(0.85, C.bounce + 0.3 * j)),
        delay,
      });
      animate(mv.sy, s, { ...spring(k * (1 - 0.14 * j), 0.9 + 0.05 * j, C.bounce), delay: delay + 0.05 * j });
    }
  };

  const measure = () => {
    const group = groupRef.current;
    if (!group) return;
    widths.current = chipRefs.current.map((el) => el?.offsetWidth ?? 0);
    const chipH = chipRefs.current[0]?.offsetHeight ?? 0;
    const maxW = Math.max(0, ...widths.current);
    group.style.setProperty("--jr-pad-x", `${Math.ceil((maxW * cfg.current.swell * 1.3) / 2 + cfg.current.barge) + 2}px`);
    group.style.setProperty("--jr-pad-y", `${Math.ceil((chipH * cfg.current.swell) / 2) + 2}px`);
  };

  useLayoutEffect(() => {
    const settle = () => {
      measure();
      apply(applied.current, true);
    };
    settle();
    const observer = new ResizeObserver(settle);
    if (groupRef.current) observer.observe(groupRef.current);
    document.fonts?.ready.then(settle);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, size, gap, swell, barge, shrink]);

  useEffect(() => {
    if (applied.current === at) return;
    applied.current = at;
    apply(at, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(
    () => () =>
      mvs.current.forEach((mv) => {
        mv.x.destroy();
        mv.sx.destroy();
        mv.sy.destroy();
      }),
    []
  );

  const commit = (i: number, instant: boolean) => {
    if (disabled || i === at || !list[i] || list[i].disabled) return;
    applied.current = i;
    apply(i, instant);
    if (value === undefined) setInner(list[i].value);
    onChange?.(list[i].value, i);
  };

  const stepFrom = (i: number, dir: number) => {
    const n = list.length;
    let j = i;
    for (let tries = 0; tries < n; tries++) {
      j = (j + dir + n) % n;
      if (!list[j].disabled) return j;
    }
    return i;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = stepFrom(i, 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = stepFrom(i, -1);
    else if (e.key === "Home") next = stepFrom(-1, 1);
    else if (e.key === "End") next = stepFrom(list.length, -1);
    else if (e.key === " " || e.key === "Enter") next = i;
    if (next === null) return;
    e.preventDefault();
    commit(next, true);
    chipRefs.current[next]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-disabled={disabled ? "" : undefined}
      className={`jelly-radio${className ? ` ${className}` : ""}`}
      style={
        {
          "--jr-chip": chipColor,
          "--jr-active": activeColor,
          "--jr-text": textColor,
          "--jr-active-text": activeTextColor,
          "--jr-gap": `${gap}px`,
          "--jr-radius": `${radius}px`,
          "--jr-h": `${h}px`,
          "--jr-font": `${font}px`,
          "--jr-px": `${px}px`,
        } as React.CSSProperties
      }
    >
      {list.map((it, i) => (
        <Chip
          key={it.value}
          mv={mvFor(i)}
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === at}
          tabIndex={i === at || (at < 0 && i === 0) ? 0 : -1}
          disabled={disabled || !!it.disabled}
          className="jelly-radio__chip"
          data-on={i === at ? "true" : "false"}
          onClick={(e) => commit(i, e.detail === 0)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <span className="jelly-radio__skin">
            {it.icon ? <span className="jelly-radio__icon">{it.icon}</span> : null}
            <span className="jelly-radio__label">{it.label}</span>
          </span>
        </Chip>
      ))}
    </div>
  );
}
