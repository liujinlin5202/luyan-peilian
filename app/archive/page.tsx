"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CountUp from "@/components/bits/CountUp";
import { Markdown, looksLikeMarkdown } from "@/components/markdown";
import { COMPETITIONS, PERSONAS } from "@/lib/knowledge";
import { useDataLayer, hasLocalData, alreadyMigrated, importLocalToCloud } from "@/lib/data-layer";
import { useDialog } from "@/lib/use-dialog";
import type { QARecord, Session, Team, WeaknessItem } from "@/lib/types";

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
  const [backupMsg, setBackupMsg] = useState("");

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
  const bpPanelRef = useDialog(!!bpSession);

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

  // ---- 备份 / 恢复（断网兜底：不用在评委面前开控制台贴脚本）----
  async function exportBackup() {
    if (!layer) return;
    try {
      const [ts, ss] = await Promise.all([layer.team.list(), layer.session.list()]);
      const qa: Record<string, QARecord[]> = {};
      for (const s of ss) qa[s.session_id] = await layer.qa.listBySession(s.session_id);
      const wk: Record<string, WeaknessItem[]> = {};
      for (const t of ts) wk[t.team_id] = await layer.weakness.listByTeam(t.team_id);
      const payload = {
        version: 1,
        kind: layer.kind,
        exported_at: new Date().toISOString(),
        teams: ts,
        sessions: ss,
        qa,
        weaknesses: wk,
      };
      const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `赛前模拟舱备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setBackupMsg("备份已下载（含 BP 全文与全部训练记录），请妥善保存。");
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : "导出失败，请重试");
    }
  }

  async function importBackup(file: File) {
    if (!layer) return;
    if (layer.kind !== "local") {
      setBackupMsg("导入仅支持本地模式（未登录状态）；云端数据请用「一键导入云端」。");
      return;
    }
    let data: {
      teams?: Team[];
      sessions?: Session[];
      qa?: Record<string, QARecord[]>;
      weaknesses?: Record<string, WeaknessItem[]>;
    };
    try {
      data = JSON.parse(await file.text());
    } catch {
      setBackupMsg("文件不是合法的备份 JSON。");
      return;
    }
    if (!data?.teams?.length && !data?.sessions?.length) {
      setBackupMsg("备份文件里没有可导入的数据。");
      return;
    }
    if (!confirm("导入会把这些团队/场次/问答/漏洞合并写回本机档案（同 ID 数据会覆盖）。继续？")) return;
    try {
      const teamMap: Record<string, string> = {};
      for (const t of data.teams ?? []) {
        const nt = await layer.team.ensure(t.name); // 按名去重，已有同名团队不会重复建
        teamMap[t.team_id] = nt.team_id;
      }
      for (const s of data.sessions ?? []) {
        await layer.session.create({ ...s, team_id: teamMap[s.team_id] ?? s.team_id });
      }
      for (const rows of Object.values(data.qa ?? {})) {
        for (const r of rows) await layer.qa.add(r);
      }
      for (const rows of Object.values(data.weaknesses ?? {})) {
        for (const w of rows) await layer.weakness.add({ ...w, team_id: teamMap[w.team_id] ?? w.team_id });
      }
      const [ts, ss] = await Promise.all([layer.team.list(), layer.session.list()]);
      setTeams(ts);
      setSessions(ss);
      setActiveTeam(ts[0]?.team_id ?? "");
      setBackupMsg("导入完成，档案已恢复。");
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : "导入失败，请重试");
    }
  }

  if (!ready) return null;

  const trend = teamSessions.filter((s) => s.overall_score != null);
  const reviewTrend = teamSessions.filter((s) => s.review);
  const latest = teamSessions[teamSessions.length - 1];

  return (
    <div className="mx-auto max-w-5xl px-5 pt-24 pb-10">
      <div className="border-b-2 border-pine pb-5 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted tracking-widest mb-1">训练档案 · P5</p>
          <h1 className="font-serif font-bold text-3xl">成长，要看得见才作数</h1>
        </div>
        <div className="flex items-center gap-3 no-print">
          <button
            onClick={exportBackup}
            disabled={!layer}
            className="text-sm border border-pine text-pine px-4 py-2 hover:bg-pine hover:text-paper transition-colors disabled:opacity-40"
          >
            导出备份
          </button>
          {layer?.kind === "local" && (
            <label className="text-sm border border-line text-muted px-4 py-2 hover:border-pine hover:text-pine transition-colors cursor-pointer">
              导入备份
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importBackup(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
      {backupMsg && <p className="text-xs text-muted mb-4">{backupMsg}</p>}

      {teams.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-serif text-2xl text-pine mb-3">档案还空着</p>
          <p className="text-muted text-sm mb-8">每一场训练都会在这里留下得分曲线和漏洞闭环记录。</p>
          <Link href="/" className="bg-pine text-paper px-6 py-3 font-bold rounded-xl hover:bg-pinedeep transition-colors">
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
              className="action-button action-button--small action-button--danger ml-auto"
            >
              删除当前团队全部数据
            </button>
          </div>

          {/* 三项指标 */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-line rounded-2xl p-6">
              <p className="text-xs text-muted tracking-widest mb-2">累计训练</p>
              <p className="font-serif font-bold text-4xl text-pine">
                <CountUp from={0} to={teamSessions.length} duration={1.2} easing="easeOut" trigger="view" replayOnHover className="count-up-text" />
                <span className="text-base text-muted font-sans font-normal"> 场</span>
              </p>
            </div>
            <div className="bg-card border border-line rounded-2xl p-6">
              <p className="text-xs text-muted tracking-widest mb-2">最新综合得分</p>
              <p className="font-serif font-bold text-4xl text-pine">
                {latest?.overall_score != null ? (
                  <CountUp to={latest.overall_score} from={0} mode="roll" duration={1.2} trigger="view" />
                ) : (
                  "--"
                )}
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
            <div className="bg-card border border-line rounded-2xl p-6">
              <p className="text-xs text-muted tracking-widest mb-2">漏洞闭环率</p>
              <p className="font-serif font-bold text-4xl text-pine">
                <CountUp from={0} to={Math.round(stats.rate * 100)} duration={1.2} easing="easeOut" trigger="view" replayOnHover className="count-up-text" />
                <span className="text-base text-muted font-sans font-normal"> %</span>
              </p>
              <p className="text-xs text-muted mt-1">
                {stats.closed}/{stats.total} 条已解决
              </p>
            </div>
          </div>

          {/* 得分趋势 */}
          {trend.length > 0 && (
            <section className="bg-card border border-line rounded-3xl p-6 mb-8">
              <h2 className="font-serif font-bold text-lg mb-1">综合得分曲线</h2>
              <p className="text-xs text-muted mb-5">口径：BP 诊断分（实线）与复盘答辩表现分（虚线）相互独立、各自看趋势</p>
              <TrendChart
                points={trend.map((s, i) => ({ x: i, y: s.overall_score!, label: new Date(s.created_at).toLocaleDateString("zh-CN") }))}
                points2={
                  reviewTrend.length > 1
                    ? reviewTrend.map((s, i) => ({
                        x: i,
                        y: s.review!.dimension_scores.reduce((acc, d) => acc + d.score, 0),
                        label: new Date(s.created_at).toLocaleDateString("zh-CN"),
                      }))
                    : undefined
                }
              />
            </section>
          )}

          {/* 漏洞追踪 */}
          {trackedWeaknesses.length > 0 && (
            <section className="bg-card border border-line rounded-3xl p-6 mb-8">
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
                  <div key={s.session_id} className="bg-card border border-line rounded-2xl card-hover px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {COMPETITIONS[s.competition]?.name} · {s.mode === "hell" ? "地狱" : "普通"}模式 · 首选{PERSONAS[s.persona].label}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(s.created_at).toLocaleString("zh-CN")} · {STATUS_LABEL[s.status] ?? s.status}
                      </p>
                    </div>
                    {s.overall_score != null && <span className="font-serif font-bold text-2xl text-pine"><CountUp to={s.overall_score} from={0} duration={0.9} trigger="view" /><span className="text-xs text-muted font-sans font-normal">分</span></span>}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <button
                        onClick={() => setBpSession(s)}
                        className="action-button action-button--small"
                      >
                        BP
                      </button>
                      <Link href={`/report/${s.session_id}`} className="action-button action-button--small">
                        诊断
                      </Link>
                      <Link href={`/practice/${s.session_id}`} className="action-button action-button--small">
                        陪练
                      </Link>
                      <Link href={`/review/${s.session_id}`} className="action-button action-button--small">
                        复盘
                      </Link>
                      <button
                        onClick={() => removeSession(s.session_id)}
                        className="action-button action-button--small action-button--danger"
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
            ref={bpPanelRef}
            tabIndex={-1}
            className="hero-rise relative w-full max-w-2xl max-h-[86dvh] overflow-y-auto bg-paper border border-ink shadow-2xl outline-none"
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
              <p className="text-xs text-muted tracking-widest">
                BP 原文 · {new Date(bpSession.created_at).toLocaleString("zh-CN")}
                {looksLikeMarkdown(bpSession.bp_text) && <span className="ml-2 text-copper">Markdown</span>}
              </p>
              <h2 className="font-serif font-bold text-xl mt-1 mb-4">
                {bpSession.team_name} · {COMPETITIONS[bpSession.competition]?.name}
              </h2>
              {looksLikeMarkdown(bpSession.bp_text) ? (
                <div className="border-t border-line pt-4">
                  <Markdown text={bpSession.bp_text} />
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words border-t border-line pt-4">{bpSession.bp_text}</p>
              )}
              <p className="text-xs text-muted mt-5">共 {bpSession.bp_text.length} 字 · 仅存于本机浏览器</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ points, points2 }: { points: { x: number; y: number; label: string }[]; points2?: { x: number; y: number; label: string }[] }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 200;
  const PAD = 36;
  const maxY = 100;
  const px = (i: number, n: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const py = (v: number) => H - PAD - (v / maxY) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i, points.length)},${py(p.y)}`).join(" ");
  const path2 = points2?.length ? points2.map((p, i) => `${i === 0 ? "M" : "L"}${px(i, points2.length)},${py(p.y)}`).join(" ") : "";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="综合得分趋势">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD} x2={W - PAD} y1={py(v)} y2={py(v)} stroke="#d8d5cd" strokeWidth="1" />
            <text x={PAD - 8} y={py(v) + 4} textAnchor="end" fontSize="10" fill="#6d6c66">
              {v}
            </text>
          </g>
        ))}
        {/* 序列二：复盘答辩表现分（虚线，错开 y 轴避免压住实线数值标签） */}
        {path2 && (
          <>
            <path d={path2} fill="none" stroke="#2b46ff" strokeWidth="2" strokeDasharray="6 5" opacity="0.85" />
            {points2!.map((p, i) => (
              <circle key={`r${i}`} cx={px(i, points2!.length)} cy={py(p.y)} r="3.5" fill="#2b46ff" stroke="#eceae5" strokeWidth="1.5" />
            ))}
          </>
        )}
        {/* 序列一：BP 诊断分（实线） */}
        <path d={path} fill="none" stroke="#1c1c1a" strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={px(i, points.length)} cy={py(p.y)} r="4.5" fill="#2b46ff" stroke="#eceae5" strokeWidth="2" />
            <text x={px(i, points.length)} y={py(p.y) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1c1c1a">
              {p.y}
            </text>
            <text x={px(i, points.length)} y={H - 10} textAnchor="middle" fontSize="10" fill="#6d6c66">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted mt-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 bg-[#1c1c1a]" aria-hidden />
          BP 诊断分
        </span>
        {path2 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-[#2b46ff]" aria-hidden />
            复盘答辩分
          </span>
        )}
      </div>
    </div>
  );
}
