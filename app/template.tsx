"use client";

import { usePathname } from "next/navigation";
import AnimatedContent from "@/components/bits/AnimatedContent";

/* 路由切换进场：template 在一级路由变化时重挂载，动画随每次导航重放。
   欢迎页（/）自带开屏 hero-rise 序列，不重复包裹。 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return (
    <AnimatedContent
      trigger="mount"
      distance={100}
      direction="vertical"
      duration={0.8}
      ease="power3.out"
      blur={0}
      stagger={0.08}
      threshold={0.1}
    >
      {children}
    </AnimatedContent>
  );
}
