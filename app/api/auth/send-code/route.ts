// 简易邮箱验证（第一步）：校验邮箱格式与域名 MX，签发 6 位验证码。
// 演示模式：无邮件服务时直接把验证码返回给前端展示；接入真实 SMTP 后可改为发送邮件。

import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { issueCode } from "@/lib/verify-store";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  const addr = (email ?? "").trim();
  if (!EMAIL_RE.test(addr)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  const domain = addr.split("@")[1];
  // 域名真实可收信校验（无 MX 记录的域名直接拒绝）
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return NextResponse.json({ error: "该邮箱域名无法接收邮件，请更换" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "该邮箱域名不存在或无法解析，请更换" }, { status: 400 });
  }

  const result = issueCode(addr);
  if (result.error) {
    return NextResponse.json({ error: result.error, retryAfter: result.retryAfter }, { status: 429 });
  }
  // 演示模式：直接返回验证码，由前端展示（不发送真实邮件）
  return NextResponse.json({ ok: true, demoCode: result.code });
}
