// AI 接口轻量防护：可选 Token 校验 + 简单限流。
// 演示部署是公网裸 IP，扫描者刷接口会把 DeepSeek 额度打光，全场静默降级为假数据。
// 用法：.env.local 里配 DEMO_TOKEN（服务端）与 NEXT_PUBLIC_DEMO_TOKEN（前端，同值），
// 两者都配置后自动启用校验；不配置则完全不影响本地开发。

import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQ = 10; // 每客户端每分钟 10 次，正常演示节奏（3-5 秒一题）远低于此

const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

/** 返回 null 表示放行；否则返回应直接回复的 4xx 响应 */
export function guardApi(req: Request): NextResponse | null {
  const expected = process.env.DEMO_TOKEN;
  if (expected) {
    const got = req.headers.get("x-demo-token");
    if (got !== expected) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }
  }
  const key = clientKey(req);
  const now = Date.now();
  const slot = hits.get(key);
  if (!slot || slot.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    slot.count += 1;
    if (slot.count > MAX_REQ) {
      return NextResponse.json({ error: "请求太频繁，请稍后再试" }, { status: 429 });
    }
  }
  // 防内存泄漏：过期槽位定期清掉
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      if (v.resetAt < now) hits.delete(k);
    }
  }
  return null;
}

