"use client";

import { usePathname } from "next/navigation";

/* 首页保持纯一屏（不可下滑），页脚只在其余页面显示 */
export default function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-line mt-16">
      <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted flex flex-wrap gap-x-6 gap-y-1 justify-between">
        <span>AI 评分与点评均为训练参考，最终判断请结合指导教师意见。</span>
        <span>基于国产智能体技术栈构建 · 数据仅存于本机浏览器，可在训练档案中随时删除</span>
      </div>
    </footer>
  );
}
