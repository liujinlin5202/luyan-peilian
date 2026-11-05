"use client";

/* 全站主导航：橡皮分段按钮（RubberSegment），按当前路由高亮，滑块可拖动 */
import { usePathname, useRouter } from "next/navigation";
import RubberSegment from "@/components/bits/RubberSegment";

const ITEMS = [
  { value: "/new", label: "新建训练" },
  { value: "/archive", label: "训练档案" },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = ITEMS.find((it) => pathname === it.value || pathname.startsWith(it.value + "/"));

  return (
    <RubberSegment
      items={ITEMS}
      value={active?.value ?? ""}
      onChange={(v) => router.push(v)}
      aria-label="主导航"
      size="md"
      radius={14}
      inset={3}
      trackColor="rgba(22,22,19,0.06)"
      thumbColor="#161613"
      textColor="#5e5d57"
      activeTextColor="#eceae5"
      draggable
    />
  );
}
