"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AIBadge, MockBanner } from "@/components/ui";
import { GlassCard } from "@/components/glass-card";
import { GradientButton } from "@/components/gradient-button";
import { RadarChart, ScoreBars, ScoreRing } from "@/components/scores";
import { COMPETITIONS } from "@/lib/knowledge";
import { useDataLayer } from "@/lib/data-layer";
import type { Session } from "@/lib/types";

const SEVERITY: Record<string, { label: string; cls: string }> = {
  high: { label: "高危", cls: "bg-crimson/10 text-crimson border-crimson/30" },
  mid: { label: "中等", cls: "bg-copper/15 text-copper border-copper/40" },
  low: { label: "轻微", cls: "bg-line/60 text-muted border-line" },
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { layer, ready } = useDataLayer();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!layer) return;
    let alive = true;
    layer.session
      .get(id)
      .then((s) => {
        if (!alive) return;
        setSession(s);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [id, layer]);

  if (!ready || !loaded) return null;
  if (!session?.diagnosis) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="font-serif text-2xl mb-3">没有找到这份诊断报告</p>
        <p className="text-muted text-sm mb-8">它可能已被删除，或链接不完整。</p>
        <Link href="/" className="action-button">
          新建一场训练
        </Link>
      </div>
    );
  }

  const d = session.diagnosis;
  const comp = COMPETITIONS[session.competition] ?? COMPETITIONS.opc;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-24 pb-10">
      {d.mock && <MockBanner />}

      {/* 抬头 */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-pine pb-5 mb-8">
        <div>
          <p className="text-xs text-muted tracking-widest mb-1">
            诊断报告 · {comp.name}
          </p>
          <h1 className="font-serif font-bold text-3xl">{session.team_name} 的 BP 体检</h1>
          <p className="text-sm text-muted mt-2">
            {new Date(session.created_at).toLocaleString("zh-CN")} · 训练强度：
            {session.mode === "hell" ? "地狱模式" : "普通模式"}
          </p>
        </div>
        <AIBadge />
      </div>

      <div className="grid lg:grid-cols-[2fr_3fr] gap-10">
        {/* 左：总分 + 五维 */}
        <section>
          <div className="bg-card border border-line border-t-2 border-t-copper rounded-3xl p-8 mb-6">
            <ScoreRing score={d.overall_score} label="综合评分" />
            <p className="text-xs text-muted text-center mt-1">满分 100 · 按赛事权重折算</p>
          </div>
          <div className="bg-card border border-line rounded-3xl p-6">
            <h2 className="font-serif font-bold text-lg mb-5">五维评分</h2>
            <div className="flex justify-center mb-6">
              <RadarChart dims={d.dimensions} />
            </div>
            <ScoreBars dims={d.dimensions} />
          </div>
        </section>

        {/* 右：优势 / 弱点 */}
        <section className="space-y-8">
          <div>
            <h2 className="font-serif font-bold text-lg mb-4 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-pine rounded-full inline-block" aria-hidden />
              先说做得好的
            </h2>
            <ul className="space-y-3">
              {d.strengths.map((s, i) => (
                <li key={i} className="bg-card border border-line card-hover px-4 py-3 text-sm flex gap-3">
                  <span className="font-serif text-copper font-bold">0{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif font-bold text-lg mb-4 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-crimson rounded-full inline-block" aria-hidden />
              漏洞清单 —— 评委火力点
            </h2>
            <ul className="space-y-3">
              {d.weaknesses.map((w, i) => (
                <li key={i} className="bg-card border border-line card-hover px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-[11px] px-1.5 py-0.5 border shrink-0 mt-0.5 ${SEVERITY[w.severity]?.cls ?? SEVERITY.mid.cls}`}
                    >
                      {SEVERITY[w.severity]?.label ?? "中等"}
                    </span>
                    <p className="text-sm">{w.point}</p>
                  </div>
                  {w.expect_question && (
                    <p className="text-xs text-muted mt-2 pl-1 border-l-2 border-copper/50 pl-2">
                      评委最可能问：「{w.expect_question}」
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <GlassCard contentClassName="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="font-serif font-bold text-xl text-ink">漏洞看清了，进舱实战。</p>
              <p className="text-muted text-sm mt-1">
                评委将围绕弱点清单定向提问，60% 的题打在你还没补的洞上。
              </p>
            </div>
            <GradientButton href={`/practice/${session.session_id}`}>开始陪练 →</GradientButton>
          </GlassCard>
        </section>
      </div>
    </div>
  );
}
