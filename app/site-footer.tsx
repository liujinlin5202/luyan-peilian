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
        <span>基于国产智能体技术栈构建 · 训练数据保存在你的浏览器本地（登录后存云端档案），可在训练档案随时删除或导出备份</span>
      </div>
    </footer>
  );
}
