import type { ReactNode } from "react";
import GlassSurface from "@/components/bits/GlassSurface";

/**
 * 玻璃面板：纸面底 + 柔光斑 + GlassSurface 折射，内容浮在上层。
 * 报告页 CTA / 复盘页收尾卡 / 陪练页答完条共用同一套参数，保证观感一致。
 */
export function GlassCard({
  children,
  className = "",
  contentClassName = "",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={`relative rounded-2xl ${className}`.trim()}>
      {/* 玻璃背后的柔光：给折射提供可弯折的彩色底 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[#2b46ff]/[0.26] blur-2xl" />
        <div className="absolute -bottom-24 right-6 h-56 w-56 rounded-full bg-[#c29d5f]/[0.32] blur-2xl" />
        <div className="absolute left-1/3 -top-14 h-44 w-44 rounded-full bg-[#8a9fd4]/[0.45] blur-2xl" />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={16}
          backgroundOpacity={0.42}
          displace={1.4}
          blur={16}
          distortionScale={-150}
          saturation={1.15}
        />
      </div>
      <div className={`relative ${contentClassName}`.trim()}>{children}</div>
    </div>
  );
}
