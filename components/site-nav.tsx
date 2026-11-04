"use client";

/* 全站主导航：果冻分段按钮（JellyRadio），按当前路由高亮 */
import { usePathname, useRouter } from "next/navigation";
import { JellyRadio } from "@/components/jelly-radio";

const ITEMS = [
  { value: "/new", label: "新建训练" },
  { value: "/archive", label: "训练档案" },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = ITEMS.find((it) => pathname === it.value || pathname.startsWith(it.value + "/"));

  return (
    <JellyRadio
      items={ITEMS}
      value={active?.value ?? ""}
      onChange={(v) => router.push(v)}
      ariaLabel="主导航"
      size="md"
      gap={6}
      radius={14}
      chipColor="rgba(22,22,19,0.06)"
      activeColor="#161613"
      textColor="#5e5d57"
      activeTextColor="#eceae5"
      swell={0.2}
      barge={6}
      shrink={0.05}
      jelly={1}
      bounce={0.25}
      stagger={22}
      stiffness={580}
    />
  );
}
