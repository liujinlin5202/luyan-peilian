// 忘记密码：校验邮箱验证码 → 用 Admin API 重置密码（无需真实邮件）。
// 复用 send-code 签发的验证码；SUPABASE_SERVICE_ROLE_KEY 只在服务端读取。

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeCode } from "@/lib/verify-store";

export const runtime = "nodejs";

/** 把底层网络错误翻译成可读提示 */
function friendly(message: string): string {
  return /fetch|network|ECONN|ENOTFOUND|ETIMEDOUT|reset/i.test(message)
    ? "无法连接云端服务（supabase.co），请检查网络或代理后重试"
    : message;
}

export async function POST(req: Request) {
  const { email, code, password } = (await req.json()) as {
    email?: string;
    code?: string;
    password?: string;
  };
  const addr = (email ?? "").trim();
  const pwd = password ?? "";
  if (!addr || !code) return NextResponse.json({ error: "缺少邮箱或验证码" }, { status: 400 });
  if (pwd.length < 6) return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "服务端未配置 SUPABASE_SERVICE_ROLE_KEY" }, { status: 501 });
  }

  const check = consumeCode(addr, code);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) return NextResponse.json({ error: friendly(listErr.message) }, { status: 502 });
    const user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === addr.toLowerCase());
    if (!user) return NextResponse.json({ error: "该邮箱未注册" }, { status: 404 });

    const { error } = await admin.auth.admin.updateUserById(user.id, { password: pwd });
    if (error) return NextResponse.json({ error: friendly(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: friendly(e instanceof Error ? e.message : String(e)) },
      { status: 502 }
    );
  }
}
