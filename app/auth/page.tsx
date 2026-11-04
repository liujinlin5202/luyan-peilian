"use client";

/* 登录 / 注册（邮箱 + 密码）。未配置 Supabase 时显示本地模式说明。 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function AuthPage() {
  const { isConfigured, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await signIn(email.trim(), password);
        if (err) throw new Error(err);
        router.push("/archive");
      } else {
        const { error: err, needsConfirm } = await signUp(email.trim(), password, displayName.trim());
        if (err) throw new Error(err);
        if (needsConfirm) {
          setNotice("注册成功：请到邮箱完成确认后再登录。");
        } else {
          router.push("/archive");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-5 pt-28 pb-14">
      <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">
        ← 返回首页
      </Link>
      <h1 className="font-serif font-bold text-3xl mt-5 mb-1">{mode === "signin" ? "登录" : "注册"}</h1>
      <p className="text-muted text-sm mb-6">
        登录后训练数据存入云端，跨设备同步；不登录也可以继续本地模式。
      </p>

      {!isConfigured ? (
        <div className="border border-copper/40 bg-copper/10 text-ink text-sm px-4 py-3 mb-6">
          <strong className="text-copper font-semibold">云端未启用</strong>
          <span className="text-muted">
            ：当前为本地模式，训练数据仅存于本机浏览器。配置 NEXT_PUBLIC_SUPABASE_URL 与
            NEXT_PUBLIC_SUPABASE_ANON_KEY 后，此页即可登录上云。
          </span>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-5 bg-card border border-line p-6 lg:p-8">
        {mode === "signup" && (
          <label className="block">
            <span className="text-sm font-medium block mb-1.5">昵称（可选）</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-copper transition-colors"
              placeholder="如：星舟团队队长"
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium block mb-1.5">邮箱</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-copper transition-colors"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium block mb-1.5">密码</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-copper transition-colors"
            placeholder="至少 6 位"
          />
        </label>

        {error && <p className="text-crimson text-sm border border-crimson/30 bg-crimson/5 px-3 py-2">{error}</p>}
        {notice && <p className="text-pine text-sm border border-pine/30 bg-pine/5 px-3 py-2">{notice}</p>}

        <button
          type="submit"
          disabled={busy || !isConfigured}
          className="w-full bg-pine text-paper font-bold text-lg py-3.5 hover:bg-pinedeep transition-colors disabled:opacity-60"
        >
          {busy ? "处理中…" : mode === "signin" ? "登录" : "注册并进入训练档案"}
        </button>
        <p className="text-sm text-muted text-center">
          {mode === "signin" ? "还没有账号？" : "已有账号？"}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
            className="ml-1 text-copper underline underline-offset-4 hover:text-copperbright"
          >
            {mode === "signin" ? "去注册" : "去登录"}
          </button>
        </p>
      </form>
    </section>
  );
}
