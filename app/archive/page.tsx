"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COMPETITIONS, PERSONAS } from "@/lib/knowledge";
import { useDataLayer, hasLocalData, alreadyMigrated, importLocalToCloud } from "@/lib/data-layer";
import type { Session, Team, WeaknessItem } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  diagnosed: "已诊断",
  practicing: "陪练中",
  practiced: "待复盘",
  reviewed: "已复盘",
};

const W_SEVERITY: Record<string, { label: string; cls: string }> = {
  high: { label: "高危", cls: "border-crimson/40 text-crimson bg-crimson/5" },
  mid: { label: "中等", cls: "border-copper/50 text-copper bg-copper/10" },
  low: { label: "轻微", cls: "border-line text-muted" },
};

export default function ArchivePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTeam, setActiveTeam] = useState<string>("");
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>([]);
  const [ready, setReady] = useState(false);
  const [bpSession, setBpSession] = useState<Session | null>(null);
  const { layer } = useDataLayer();
  const [stats, setStats] = useState({ total: 0, closed: 0, rate: 0 });
  const [importState, setImportState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");

  const showImport = layer?.kind === "cloud" && hasLocalData() && !alreadyMigrated();

  async function runImport() {
    if (!layer) return;
    setImportState("busy");
    try {
      const r = await importLocalToCloud(layer);
      setImportMsg(`已导入 ${r.teams} 个团队、${r.sessions} 场训练、${r.qa} 条问答、${r.weaknesses} 条漏洞。`);
      setImportState("done");
      const [ts, ss] = await Promise.all([layer.team.list(), layer.session.list()]);
      setTeams(ts);
      setSessions(ss);
      setActiveTeam(ts[0]?.team_id ?? "");
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "导入失败，请重试");
      setImportState("error");
    }
  }

  useEffect(() => {
    if (!layer) return;
    let alive = true;
    (async () => {
      const [ts, ss] = await Promise.all([layer.team.list(), layer.session.list()]);
      if (!alive) return;
      setTeams(ts);
      setSessions(ss);
      setActiveTeam(ts[0]?.team_id ?? "");
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [layer]);

  useEffect(() => {
    if (!bpSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBpSession(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bpSession]);

  useEffect(() => {
    if (!layer || !activeTeam) return;
    let alive = true;
    layer.weakness.listByTeam(activeTeam).then((ws) => {
      if (alive) setWeaknesses(ws);
    });
    return () => {
      alive = false;
    };
  }, [layer, activeTeam, sessions]);

  useEffect(() => {
    if (!layer || !activeTeam) return;
    let alive = true;
    layer.weakness.stats(activeTeam).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [layer, activeTeam, weaknesses]);

  const teamSessions = useMemo(
    () => sessions.filter((s) => s.team_id === activeTeam).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [sessions, activeTeam]
  );
  const trackedWeaknesses = weaknesses.filter((w) => w.status !== "invalid");

  function closeWeakness(item_id: string) {
    if (!layer || !activeTeam) return;
    layer.weakness.update(item_id, { status: "closed" });
    layer.weakness.listByTeam(activeTeam).then(setWeaknesses);
  }

  function removeSession(session_id: string) {
    if (!layer) return;
    const s = sessions.find((x) => x.session_id === session_id);
    if (!s) return;
    if (!confirm(`删除 ${new Date(s.created_at).toLocaleString("zh-CN")} 这一场训练？该场的问答记录与确认过的漏洞会一并删除，不可恢复。`)) return;
    layer.session.remove(session_id).then(async () => setSessions(await layer.session.list()));
  }

  function removeTeam(team_id: string) {
    if (!layer) return;
    const t = teams.find((x) => x.team_id === team_id);
    if (!t) return;
    if (!confirm(`删除「${t.name}」的全部训练档案？此操作不可恢复。`)) return;
    layer.team.remove(team_id).then(async () => {
      const [ts, ss] = await Promise.all([layer.team.list(), layer.session.list()]);
      setTeams(ts);
      setSessions(ss);
      setActiveTeam(ts[0]?.team_id ?? "");
    });
  }

  if (!ready) return null;

  const trend = teamSessions.filter((s) => s.overall_score != null);
  const latest = teamSessions[teamSessions.length - 1];

  return (
    <div className="mx-auto max-w-5xl px-5 pt-24 pb-10">
      <div className="border-b-2 border-pine pb-5 mb-8">
        <p className="text-xs text-muted tracking-widest mb-1">训练档案 · P5</p>
        <h1 className="font-serif font-bold text-3xl">成长，要看得见才作数</h1>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-serif text-2xl text-pine mb-3">档案还空着</p>
          <p className="text-muted text-sm mb-8">每一场训练都会在这里留下得分曲线和漏洞闭环记录。</p>
          <Link href="/" className="bg-pine text-paper px-6 py-3 font-bold hover:bg-pinedeep transition-colors">
            新建第一场训练
          </Link>
        </div>
      ) : (
        <>
          {showImport && importState !== "done" && (
            <div className="border border-copper/40 bg-copper/10 px-4 py-3 mb-6 flex flex-wrap items-center gap-3">
              <span className="text-sm">检测到本机还有训练数据，可导入云端档案。</span>
              <button
                onClick={runImport}
                disabled={importState === "busy"}
                className="text-xs border border-pine text-pine px-3 py-1.5 hover:bg-pine hover:text-paper transition-colors disabled:opacity-50"
              >
                {importState === "busy" ? "导入中…" : "一键导入云端"}
              </button>
              {importState === "error" && <span className="text-xs text-crimson">{importMsg}</span>}
            </div>
          )}
          {importState === "done" && (
            <div className="border border-pine/40 bg-pine/5 px-4 py-3 mb-6 text-sm text-pine">{importMsg}</div>
          )}
          {/* 团队切换 */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            {teams.map((t) => (
              <button
                key={t.team_id}
                onClick={() => setActiveTeam(t.team_id)}
                className={`text-sm px-4 py-2 border transition-colors ${
                  activeTeam === t.team_id ? "border-pine bg-pine text-paper font-bold" : "border-line bg-card hover:border-pine/50"
                }`}
              >
                {t.name}
              </button>
            ))}
            <button
              onClick={() => removeTeam(activeTeam)}
              className="ml-auto text-xs text-muted underline underline-offset-2 hover:text-crimson transition-colors"
            >
              删除当前团队全部数据
            </button>
          </div>

          {/* 三项指标 */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-line p-6">
              <p className="text-xs text-muted tracking-widest mb-2">累计训练</p>
              <p className="font-serif font-bold text-4xl text-pine">
                {teamSessions.length}
                <span className="text-base text-muted font-sans font-normal"> 场</span>
              </p>
            </div>
            <div className="bg-card border border-line p-6">
              <p className="text-xs text-muted tracking-widest mb-2">最新综合得分</p>
              <p className="font-serif font-bold text-4xl text-pine">
                {latest?.overall_score ?? "--"}
                {trend.length > 1 && (
                  <span
                    className={`text-base font-sans font-normal ml-2 ${
                      (latest?.overall_score ?? 0) >= (trend[trend.length - 2].overall_score ?? 0) ? "text-pine" : "text-crimson"
                    }`}
                  >
                    {(latest?.overall_score ?? 0) >= (trend[trend.length - 2].overall_score ?? 0) ? "↑" : "↓"}
                    {Math.abs((latest?.overall_score ?? 0) - (trend[trend.length - 2].overall_score ?? 0))}
                  </span>
                )}
              </p>
            </div>
            <div className="bg-card border border-line p-6">
              <p className="text-xs text-muted tracking-widest mb-2">漏洞闭环率</p>
              <p className="font-serif font-bold text-4xl text-pine">
                {Math.round(stats.rate * 100)}
                <span className="text-base text-muted font-sans font-normal"> %</span>
              </p>
              <p className="text-xs text-muted mt-1">
                {stats.closed}/{stats.total} 条已解决
              </p>
            </div>
          </div>

          {/* 得分趋势 */}
          {trend.length > 0 && (
            <section className="bg-card border border-line p-6 mb-8">
              <h2 className="font-serif font-bold text-lg mb-1">综合得分曲线</h2>
              <p className="text-xs text-muted mb-5">口径：各场 BP 诊断分（与复盘的答辩表现分相互独立）</p>
              <TrendChart points={trend.map((s, i) => ({ x: i, y: s.overall_score!, label: new Date(s.created_at).toLocaleDateString("zh-CN") }))} />
            </section>
          )}

          {/* 漏洞追踪 */}
          {trackedWeaknesses.length > 0 && (
            <section className="bg-card border border-line p-6 mb-8">
              <div className="flex items-baseline justify-between gap-4 mb-5">
                <h2 className="font-serif font-bold text-lg">漏洞追踪</h2>
                <span className="text-xs text-muted">复盘里确认成立的漏洞在这里逐条闭环，标记「已解决」计入闭环率</span>
              </div>
              <ul className="space-y-2.5">
                {trackedWeaknesses.map((w) => {
                  const sev = W_SEVERITY[w.severity] ?? W_SEVERITY.mid;
                  return (
                    <li key={w.item_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-line bg-paper px-4 py-3">
                      <span className={`text-[11px] px-1.5 py-0.5 border shrink-0 ${sev.cls}`}>{sev.label}</span>
                      <span className={`text-sm flex-1 min-w-0 ${w.status === "closed" ? "text-muted line-through" : ""}`}>{w.description}</span>
                      {w.status === "closed" ? (
                        <span className="text-xs font-bold text-pine shrink-0">已解决 ✓</span>
                      ) : (
                        <button
                          onClick={() => closeWeakness(w.item_id)}
                          className="text-xs border border-line px-2.5 py-1 hover:border-pine hover:text-pine transition-colors shrink-0"
                        >
                          标记已解决
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* 场次列表 */}
          <section>
            <h2 className="font-serif font-bold text-lg mb-4">全部场次</h2>
            <div className="space-y-3">
              {teamSessions
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.session_id} className="bg-card border border-line card-hover px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {COMPETITIONS[s.competition]?.name} · {s.mode === "hell" ? "地狱" : "普通"}模式 · 首选{PERSONAS[s.persona].label}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(s.created_at).toLocaleString("zh-CN")} · {STATUS_LABEL[s.status] ?? s.status}
                      </p>
                    </div>
                    {s.overall_score != null && <span className="font-serif font-bold text-2xl text-pine">{s.overall_score}<span className="text-xs text-muted font-sans font-normal">分</span></span>}
                    <div className="flex gap-3 text-sm">
                      <button
                        onClick={() => setBpSession(s)}
                        className="text-pine underline underline-offset-4 hover:text-copper"
                      >
                        BP
                      </button>
                      <Link href={`/report/${s.session_id}`} className="text-pine underline underline-offset-4 hover:text-copper">
                        诊断
                      </Link>
                      <Link href={`/practice/${s.session_id}`} className="text-pine underline underline-offset-4 hover:text-copper">
                        陪练
                      </Link>
                      <Link href={`/review/${s.session_id}`} className="text-pine underline underline-offset-4 hover:text-copper">
                        复盘
                      </Link>
                      <button
                        onClick={() => removeSession(s.session_id)}
                        className="text-muted underline underline-offset-4 hover:text-crimson transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {/* BP 原文弹层 */}
      {bpSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="查看 BP">
          <div className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setBpSession(null)} aria-hidden="true" />
          <div
            className="hero-rise relative w-full max-w-2xl max-h-[86dvh] overflow-y-auto bg-paper border border-ink shadow-2xl"
            style={{ "--d": "0s" } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => setBpSession(null)}
              aria-label="关闭"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="p-6 sm:p-8">
              <p className="text-xs text-muted tracking-widest">BP 原文 · {new Date(bpSession.created_at).toLocaleString("zh-CN")}</p>
              <h2 className="font-serif font-bold text-xl mt-1 mb-4">
                {bpSession.team_name} · {COMPETITIONS[bpSession.competition]?.name}
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words border-t border-line pt-4">{bpSession.bp_text}</p>
              <p className="text-xs text-muted mt-5">共 {bpSession.bp_text.length} 字 · 仅存于本机浏览器</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: { x: number; y: number; label: string }[] }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 200;
  const PAD = 36;
  const maxY = 100;
  const px = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1);
  const py = (v: number) => H - PAD - (v / maxY) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(p.y)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="综合得分趋势">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PAD} x2={W - PAD} y1={py(v)} y2={py(v)} stroke="#d8d5cd" strokeWidth="1" />
          <text x={PAD - 8} y={py(v) + 4} textAnchor="end" fontSize="10" fill="#6d6c66">
            {v}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#1c1c1a" strokeWidth="2.5" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(p.y)} r="4.5" fill="#2b46ff" stroke="#eceae5" strokeWidth="2" />
          <text x={px(i)} y={py(p.y) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1c1c1a">
            {p.y}
          </text>
          <text x={px(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#6d6c66">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
