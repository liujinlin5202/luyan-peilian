"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AIBadge, MockBanner } from "@/components/ui";
import { RadarChart, ScoreBars } from "@/components/scores";
import { demoTokenHeaders } from "@/lib/demo-token";
import { COMPETITIONS } from "@/lib/knowledge";
import { useDataLayer } from "@/lib/data-layer";
import type { QARecord, ReviewReport, Session, WeaknessItem, WeaknessStatus } from "@/lib/types";

const SEVERITY: Record<string, { label: string; cls: string }> = {
  high: { label: "高危", cls: "bg-crimson/10 text-crimson border-crimson/30" },
  mid: { label: "中等", cls: "bg-copper/15 text-copper border-copper/40" },
  low: { label: "轻微", cls: "bg-line/60 text-muted border-line" },
};

function SectionHead({ no, title, desc }: { no: string; title: string; desc?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-2.5 mb-5">
      <span className="font-serif text-copper font-bold text-xl">{no}</span>
      <h2 className="font-serif font-bold text-xl">{title}</h2>
      {desc && <span className="text-xs text-muted hidden sm:inline">{desc}</span>}
    </div>
  );
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { layer } = useDataLayer();
  const [session, setSession] = useState<Session | null>(null);
  const [review, setReview] = useState<ReviewReport | null>(null);
  const [records, setRecords] = useState<QARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState(false); // 场次不存在/无记录这类不可重试错误
  const [retryNonce, setRetryNonce] = useState(0);
  const [prevScore, setPrevScore] = useState<number | undefined>();
  const [verdicts, setVerdicts] = useState<Record<number, WeaknessStatus>>({});
  const [pastItems, setPastItems] = useState<WeaknessItem[]>([]);
  const [openRef, setOpenRef] = useState<Record<number, boolean>>({});
  const [exported, setExported] = useState(false);
  // reviewedRef 防重：React StrictMode 下 effect 会执行两次，只允许发一次复盘请求
  const reviewedRef = useRef(false);

  useEffect(() => {
    if (!layer || reviewedRef.current) return;
    // reviewedRef 只拦截「复盘 API 重复调用」；前面的本地/云端读取是幂等的，
    // 不用 alive 取消模式（StrictMode 双跑会取消第一次的写入导致永远 loading）。
    reviewedRef.current = true;
    (async () => {
      try {
        const s = await layer.session.get(id);
        if (!s) {
          setLoading(false);
          setFatal(true);
          setError("训练场次不存在");
          return;
        }
        setSession(s);
        const records = await layer.qa.listBySession(id);
        setRecords(records);

        // 历史未闭合漏洞（本场之前确认/待确认的），用于「上场漏洞追踪」与复盘 AI 的复发判断
        const pastAll = await layer.weakness.listByTeam(s.team_id);
        const past = pastAll.filter(
          (w) => (w.status === "confirmed" || w.status === "open") && w.created_at < s.created_at
        );
        setPastItems(past);

        // 上一场答辩表现分（同量纲对比：取上一场复盘的维度分之和，而非 BP 诊断分）
        const prev = await layer.session.prevReviewed(s.team_id, id);
        const prevTotal = prev?.review?.dimension_scores.reduce((acc, d) => acc + d.score, 0);
        setPrevScore(prevTotal);

        if (s.review) {
          setReview(s.review);
        } else if (records.length) {
          const res = await fetch("/api/review", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...demoTokenHeaders },
            // 复盘输出 6000 tokens，给到 90 秒：低于它会在慢 key 下误杀正常请求
            signal: AbortSignal.timeout(90_000),
            body: JSON.stringify({
              competition: s.competition,
              bp_summary: s.bp_summary,
              diagnosis_overall: s.overall_score,
              prev_score: prevTotal, // 与页面 delta 同源：上一场复盘维度分之和
              records: records.map((r) => ({
                round: r.round,
                question: r.question,
                answer: r.answer,
                score: r.score,
                comment: r.comment,
                persona: r.persona,
              })),
              past_weaknesses: past.map((w) => w.description),
            }),
          });
          const data = (await res.json()) as { error?: string } & ReviewReport;
          if (!res.ok || data.error) throw new Error(data.error || "复盘失败");
          setReview(data);
          await layer.session.update(id, { review: data, status: "reviewed" });
        } else {
          setFatal(true);
          setError("本场没有问答记录，无法复盘。");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "复盘失败，请重试");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, layer, retryNonce]);

  // 复盘失败重试（网络/接口类错误；场次不存在等 fatal 错误不显示此按钮）
  function retryReview() {
    reviewedRef.current = false;
    setError("");
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }

  const confirmedCount = Object.keys(verdicts).length;

  async function verdict(idx: number, status: WeaknessStatus) {
    if (!session || !review || !layer) return;
    const w = review.weaknesses[idx];
    const existing = (await layer.weakness.listByTeam(session.team_id)).find(
      (x) => x.session_id === session.session_id && x.description === w.description
    );
    if (existing) {
      await layer.weakness.update(existing.item_id, {
        status,
        closed_session: status === "closed" ? session.session_id : existing.closed_session,
      });
    } else {
      await layer.weakness.add({
        team_id: session.team_id,
        session_id: session.session_id,
        description: w.description,
        severity: w.severity,
        status,
        created_session: session.session_id,
        created_at: new Date().toISOString(),
      });
    }
    setVerdicts((v) => ({ ...v, [idx]: status }));
  }

  // 上场漏洞人工闭环：确认已补上后写入训练档案（closed_session 指向本场）
  function closePast(item_id: string) {
    if (!session || !layer) return;
    layer.weakness.update(item_id, { status: "closed", closed_session: session.session_id });
    setPastItems((ws) => ws.map((w) => (w.item_id === item_id ? { ...w, status: "closed" as const } : w)));
  }

  async function exportReport() {
    if (!session || !review || !layer) return;
    const records = await layer.qa.listBySession(id);
    const md = [
      `# 赛前模拟舱 · 复盘报告`,
      ``,
      `**团队**：${session.team_name} ｜ **赛事**：${COMPETITIONS[session.competition]?.name}`,
      `**日期**：${new Date(session.created_at).toLocaleString("zh-CN")}`,
      ``,
      `## 一、本场总评`,
      ``,
      review.overall_comment,
      ``,
      `**下场建议**：${review.next_suggestion}`,
      ``,
      `## 二、评分卡`,
      ``,
      `| 维度 | 得分 | 满分 |`,
      `| --- | --- | --- |`,
      ...review.dimension_scores.map((d) => `| ${d.name} | ${d.score} | ${d.max} |`),
      ``,
      `## 三、逐题点评`,
      ``,
      ...records.map((r) => {
        const pq = review.per_question.find((p) => p.round === r.round);
        return [
          `### Q${r.round}（${r.score ?? "?"}/5）`,
          ``,
          `> ${pq?.comment ?? ""}`,
          ``,
          `**评委**：${r.question}`,
          ``,
          `**回答**：${r.answer}`,
          ...(pq?.reference ? [``, `**AI 参考回答**：${pq.reference}`] : []),
          ``,
        ].join("\n");
      }),
      `## 四、漏洞清单`,
      ``,
      ...review.weaknesses.map(
        (w, i) =>
          `${i + 1}. **[${w.severity}]** ${w.description}（出自第 ${w.source_round} 题）—— 状态：${
            verdicts[i] === "confirmed" ? "已确认成立" : verdicts[i] === "invalid" ? "已标记不成立" : "待确认"
          }`
      ),
      ``,
      `---`,
      ``,
      `*AI 生成，仅供参考；漏洞经人工确认后计入训练档案。*`,
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `赛前模拟舱-复盘-${session.team_name}-${session.session_id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExported(true);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-28 text-center">
        <p className="font-serif text-2xl text-pine mb-3">复盘官正在逐题回看你的表现…</p>
        <p className="text-muted text-sm">对照问答实录生成评分卡、参考回答与漏洞清单，通常需要几十秒。</p>
      </div>
    );
  }

  if (!session || !review || error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="font-serif text-2xl mb-3">{error || "复盘报告不存在"}</p>
        <div className="flex items-center justify-center gap-5">
          {!fatal && (
            <button onClick={retryReview} className="bg-pine text-paper font-bold px-5 py-2.5 hover:bg-pinedeep transition-colors">
              重试复盘
            </button>
          )}
          <Link href={`/practice/${id}`} className="text-pine underline underline-offset-4">
            返回本场陪练
          </Link>
          <Link href="/" className="text-muted underline underline-offset-4">
            新建一场训练
          </Link>
        </div>
      </div>
    );
  }

  const total = review.dimension_scores.reduce((s, d) => s + d.score, 0);
  const maxTotal = review.dimension_scores.reduce((s, d) => s + d.max, 0);
  const delta = prevScore != null ? total - prevScore : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-24 pb-10">
      {review.mock && <MockBanner />}

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-pine pb-5 mb-10">
        <div>
          <p className="text-xs text-muted tracking-widest mb-1">复盘报告 · {COMPETITIONS[session.competition]?.name}</p>
          <h1 className="font-serif font-bold text-3xl">{session.team_name} 的第 {records.length} 题战役复盘</h1>
        </div>
        <div className="flex items-center gap-3 no-print">
          <AIBadge />
          <button onClick={exportReport} className="text-sm border border-pine text-pine px-4 py-2 hover:bg-pine hover:text-paper transition-colors">
            {exported ? "已导出 ✓" : "导出 Markdown"}
          </button>
          <button onClick={() => window.print()} className="text-sm border border-line text-muted px-4 py-2 hover:border-pine hover:text-pine transition-colors">
            打印 / 存 PDF
          </button>
        </div>
      </div>

      {/* ── 栏目一 · 本场评分 ─────────────────────────── */}
      <SectionHead no="01" title="本场评分" desc="答辩表现分 · 与 BP 诊断分无关" />
      <section className="grid lg:grid-cols-[2fr_3fr] gap-6 mb-14">
        <div className="bg-card border border-line p-7 flex flex-col justify-center">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            {prevScore != null && (
              <div className="text-center opacity-60">
                <span className="font-serif text-4xl font-bold">{prevScore}</span>
                <p className="text-xs text-muted mt-1">上一场</p>
              </div>
            )}
            {prevScore != null && <span className="font-serif text-2xl text-muted pb-5">→</span>}
            <div className="text-center">
              <span className="font-serif text-6xl font-bold text-pine">{total}</span>
              <p className="text-xs text-muted mt-1">本场 · 满分 {maxTotal}</p>
            </div>
            {delta != null && (
              <span className={`text-sm font-bold pb-5 ${delta >= 0 ? "text-pine" : "text-crimson"}`}>
                {delta >= 0 ? "+" : ""}
                {delta}
              </span>
            )}
          </div>
        </div>
        <div className="bg-card border border-line p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0">
              <RadarChart dims={review.dimension_scores} size={230} />
            </div>
            <div className="flex-1 w-full">
              <ScoreBars dims={review.dimension_scores} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 栏目二 · 逐题点评 ─────────────────────────── */}
      <SectionHead no="02" title="逐题点评" desc="每一题附 AI 参考回答，点击展开" />
      <section className="mb-14">
        <ol className="space-y-3">
          {records.map((r) => {
            const pq = review.per_question.find((p) => p.round === r.round);
            return (
              <li key={r.record_id} className="bg-card border border-line px-5 py-4 text-sm">
                <div className="flex items-baseline gap-2.5 mb-1.5 flex-wrap">
                  <span className="font-serif font-bold text-copper">Q{r.round}</span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 border ${
                      (r.score ?? 3) >= 4
                        ? "border-pine text-pine"
                        : (r.score ?? 3) >= 3
                          ? "border-copper text-copper"
                          : "border-crimson text-crimson"
                    }`}
                  >
                    {r.score ?? "?"}/5
                  </span>
                  <span className="text-muted text-xs">{pq?.comment}</span>
                </div>
                <p className="leading-relaxed">
                  <span className="font-bold">问：</span>
                  <span className="text-muted">{r.question}</span>
                </p>
                {r.answer && (
                  <p className="text-muted leading-relaxed mt-1">
                    <span className="text-ink/60">答：</span>
                    {r.answer}
                  </p>
                )}
                {pq?.reference && (
                  <div className="mt-3 no-print">
                    <button
                      onClick={() => setOpenRef((o) => ({ ...o, [r.round]: !o[r.round] }))}
                      className="text-xs text-copper hover:underline underline-offset-4"
                    >
                      {openRef[r.round] ? "收起 AI 参考回答 ▴" : "看 AI 参考回答 ▾"}
                    </button>
                    {openRef[r.round] && (
                      <div className="mt-2 border border-copper/30 bg-copper/5 px-4 py-3 leading-relaxed">
                        <p className="text-[10px] text-copper tracking-widest mb-1.5">AI 生成 · 仅供参考，请改写成自己的语言</p>
                        {pq.reference}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── 栏目三 · 漏洞确认 ─────────────────────────── */}
      <SectionHead no="03" title="漏洞确认" desc="人工确认后才写入训练档案，这是 AI 与你的分工边界" />
      <section className="mb-4">
        {pastItems.length > 0 && (
          <div className="mb-8 border border-copper/40 bg-copper/5 px-5 py-4">
            <div className="flex items-baseline gap-3 flex-wrap mb-4">
              <span className="font-serif font-bold text-copper">上场漏洞追踪</span>
              <span className="text-xs text-muted">AI 对照本场实录判断复发情况，由你确认是否闭环</span>
            </div>
            <ul className="space-y-2.5">
              {pastItems.map((w) => {
                const v = review.past_weakness_verdicts?.find((p) => p.description === w.description);
                const st = v?.status;
                const cls =
                  st === "recurred"
                    ? "border-crimson/40 text-crimson"
                    : st === "improved"
                      ? "border-pine text-pine"
                      : "border-line text-muted";
                return (
                  <li key={w.item_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-card border border-line px-4 py-3">
                    <span className={`text-[11px] px-1.5 py-0.5 border shrink-0 ${cls}`}>
                      {st === "recurred" ? "本场复发" : st === "improved" ? "本场已改善" : st === "untouched" ? "本场未涉及" : "本场未评估"}
                    </span>
                    <span className={`text-sm flex-1 min-w-0 ${w.status === "closed" ? "text-muted line-through" : ""}`}>{w.description}</span>
                    {w.status === "closed" ? (
                      <span className="text-xs font-bold text-pine shrink-0">已闭环 ✓</span>
                    ) : (
                      <button
                        onClick={() => closePast(w.item_id)}
                        className="text-xs border border-line px-2.5 py-1 hover:border-pine hover:text-pine transition-colors shrink-0"
                      >
                        已补上，闭环
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <ul className="grid lg:grid-cols-2 gap-3">
          {review.weaknesses.map((w, i) => {
            const v = verdicts[i];
            return (
              <li key={i} className="bg-card border border-line px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className={`text-[11px] px-1.5 py-0.5 border shrink-0 mt-0.5 ${SEVERITY[w.severity]?.cls}`}>
                    {SEVERITY[w.severity]?.label}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{w.description}</p>
                    {w.source_round > 0 && (
                      <p className="text-xs text-muted mt-1">出处：第 {w.source_round} 题被问住</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 justify-end no-print">
                  {(["confirmed", "invalid"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => verdict(i, st)}
                      disabled={!!v}
                      className={`text-xs px-3 py-1.5 border transition-colors disabled:cursor-default ${
                        v === st
                          ? st === "confirmed"
                            ? "bg-crimson text-paper border-crimson"
                            : "bg-muted text-paper border-muted"
                          : "border-line hover:border-pine hover:text-pine"
                      } disabled:opacity-90`}
                    >
                      {v === st ? (st === "confirmed" ? "已确认成立 ✓" : "已标记不成立 ✓") : st === "confirmed" ? "成立，记入档案" : "不成立，忽略"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        {confirmedCount > 0 && (
          <p className="text-xs text-muted mt-3">已确认 {confirmedCount} 条，写入档案成功。</p>
        )}

        <div className="mt-10 bg-pine text-paper p-6 space-y-3 no-print">
          <p className="font-serif font-bold text-xl">漏洞确认完，就再练一场。</p>
          <p className="text-paper/60 text-sm">
            每一场都会被档案记住。得分曲线和漏洞闭环率，就是你备赛进度最硬的证据。
          </p>
          <div className="flex gap-3 pt-2">
            <Link href="/" className="bg-copperbright text-ink font-bold px-5 py-2.5 hover:brightness-110 transition">
              再练一场
            </Link>
            <Link href="/archive" className="border border-paper/40 px-5 py-2.5 hover:border-copperbright hover:text-copperbright transition">
              查看训练档案
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
