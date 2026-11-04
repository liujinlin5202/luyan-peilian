// 合规组件：所有 AI 评分与结论旁固定展示（技术方案 §3.4 人在回路 / §10 数据安全）

export function AIBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] leading-none px-2 py-1 border border-line rounded-sm text-muted bg-card ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <circle cx="5" cy="5" r="4" stroke="currentColor" />
        <path d="M5 2.6v3M5 7.2v.2" stroke="currentColor" strokeLinecap="round" />
      </svg>
      AI 生成，仅供参考
    </span>
  );
}

export function MockBanner({ reason }: { reason?: "nokey" | "degraded" }) {
  const detail =
    reason === "degraded"
      ? "：AI 服务暂时不可用（网络/额度异常），已降级为内置模拟数据。恢复后刷新页面即为真实 AI 评委。"
      : "：未检测到 AI Key，当前为内置模拟数据。在项目根目录 .env.local 配置 DEEPSEEK_API_KEY 并重启后，即为真实 AI 诊断与评委。";
  return (
    <div className="border border-copper/40 bg-copper/10 text-ink text-sm px-4 py-3 rounded-md mb-6">
      <strong className="text-copper font-semibold">演示模式</strong>
      <span className="text-muted">{detail}</span>
    </div>
  );
}
