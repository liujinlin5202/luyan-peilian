"use client";

/* 页头用户区：登录入口 / 已登录邮箱与退出 */

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function UserMenu() {
  const { user, loading, isConfigured, signOut } = useAuth();

  if (!isConfigured) return null; // 本地模式：页头不加登录入口
  if (loading) {
    return <span className="text-xs text-muted w-16 inline-block">…</span>;
  }
  if (!user) {
    return (
      <Link href="/auth" className="text-sm text-muted hover:text-ink transition-colors">
        登录
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className="truncate max-w-[10rem]" title={user.email ?? ""}>
        {user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="underline underline-offset-2 hover:text-ink transition-colors"
      >
        退出
      </button>
    </span>
  );
}
