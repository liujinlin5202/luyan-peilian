"use client";

import { usePathname } from "next/navigation";

/* 路由切换淡入：template 在一级路由变化时重挂载，动画随每次导航重放。
   欢迎页（/）自带开屏 hero-rise 序列，不重复包裹。 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return <div className="page-fade">{children}</div>;
}
