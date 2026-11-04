"use client";

/* 认证上下文 —— Supabase Auth（邮箱 + 密码）。
   未配置 Supabase 时 isConfigured=false，页面自动使用本地模式。 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

interface AuthState {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  sendCode: (email: string) => Promise<{ error?: string; demoCode?: string }>;
  signUp: (email: string, password: string, code: string, displayName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: false,
  isConfigured: false,
  signIn: async () => ({ error: "Supabase 未配置" }),
  sendCode: async () => ({ error: "Supabase 未配置" }),
  signUp: async () => ({ error: "Supabase 未配置" }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isConfigured: isSupabaseConfigured,
      async signIn(email, password) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase 未配置" };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },
      async sendCode(email) {
        try {
          const res = await fetch("/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = (await res.json()) as { error?: string; demoCode?: string };
          if (!res.ok || data.error) return { error: data.error || "验证码发送失败" };
          return { demoCode: data.demoCode };
        } catch {
          return { error: "网络异常，请重试" };
        }
      },
      async signUp(email, password, code, displayName) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase 未配置" };
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, code, displayName }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok || data.error) return { error: data.error || "注册失败" };
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return error ? { error: error.message } : {};
        } catch {
          return { error: "网络异常，请重试" };
        }
      },
      async signOut() {
        const supabase = getSupabase();
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
