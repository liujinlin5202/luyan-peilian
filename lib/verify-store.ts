// 简易邮箱验证码存储 —— 演示用途：内存 + globalThis（热更新不丢）。
// 生产环境请替换为数据库表或 Redis，并接入真实邮件发送。

export interface CodeEntry {
  code: string;
  expires: number;
  sentAt: number;
  attempts: number;
}

const g = globalThis as unknown as { __lpVerifyCodes?: Map<string, CodeEntry> };
const store: Map<string, CodeEntry> = g.__lpVerifyCodes ?? (g.__lpVerifyCodes = new Map());

const TTL_MS = 10 * 60 * 1000; // 10 分钟有效
const RESEND_MS = 60 * 1000; // 60 秒重发间隔
const MAX_ATTEMPTS = 5;

export function issueCode(email: string): { code?: string; error?: string; retryAfter?: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  const prev = store.get(key);
  if (prev && now - prev.sentAt < RESEND_MS) {
    return { error: "验证码发送过于频繁，请稍后再试", retryAfter: Math.ceil((RESEND_MS - (now - prev.sentAt)) / 1000) };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(key, { code, expires: now + TTL_MS, sentAt: now, attempts: 0 });
  return { code };
}

export function consumeCode(email: string, input: string): { ok: boolean; error?: string } {
  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) return { ok: false, error: "请先获取验证码" };
  if (Date.now() > entry.expires) {
    store.delete(key);
    return { ok: false, error: "验证码已过期，请重新获取" };
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, error: "尝试次数过多，请重新获取验证码" };
  }
  if (entry.code !== input.trim()) return { ok: false, error: "验证码不正确" };
  store.delete(key);
  return { ok: true };
}
