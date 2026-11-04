// 简易邮箱验证（第二步）：校验验证码 → 用 Admin API 创建「邮箱已确认」账号（不依赖真实邮件）。
// SUPABASE_SERVICE_ROLE_KEY 只在服务端读取，绝不下发浏览器。

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeCode } from "@/lib/verify-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email, password, displayName, code } = (await req.json()) as {
    email?: string;
    password?: string;
    displayName?: string;
    code?: string;
  };
  const addr = (email ?? "").trim();
  const pwd = password ?? "";
  if (!addr || !code) return NextResponse.json({ error: "缺少邮箱或验证码" }, { status: 400 });
  if (pwd.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "服务端未配置 SUPABASE_SERVICE_ROLE_KEY，无法创建账号（见 .env.example）" },
      { status: 501 }
    );
  }

  const check = consumeCode(addr, code);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: addr,
    password: pwd,
    email_confirm: true,
    user_metadata: displayName ? { display_name: displayName } : {},
  });
  if (error) {
    const msg = error.message.toLowerCase().includes("already")
      ? "该邮箱已注册，请直接登录"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user_id: data.user?.id ?? null });
}
