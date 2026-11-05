import Link from "next/link";
import type { ReactNode } from "react";
import Magnet from "@/components/bits/Magnet";

/**
 * 渐变胶囊主按钮（露米 → 玄灰）。样式定义在 globals.css 的 .pill-gradient。
 * 传 href 渲染成链接，否则渲染成按钮。外层套 Magnet：靠近时轻微吸附，离开弹回。
 */
export function GradientButton({
  children,
  href,
  onClick,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const cls = `pill-gradient ${className}`.trim();
  return (
    <Magnet padding={90} magnetStrength={5} maxOffset={14} scale={1.04} tilt={6}>
      {href ? (
        <Link href={href} className={cls}>
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={cls}>
          {children}
        </button>
      )}
    </Magnet>
  );
}
