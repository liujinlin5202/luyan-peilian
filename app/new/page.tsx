"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Stepper, { Step } from "@/components/Stepper";
import { demoTokenHeaders } from "@/lib/demo-token";
import { COMPETITIONS } from "@/lib/knowledge";
import { useDataLayer } from "@/lib/data-layer";
import type { CompetitionId, DiagnosisReport, JudgeMode, Persona } from "@/lib/types";

const fieldCls =
  "w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-copper transition-colors";

// 诊断等待期间的阶段轮播：演示时间线上最大单点冷场窗口的兜底
const DIAGNOSE_PHASES = [
  "正在解析 BP 结构……",
  "正在对照赛事评分标准……",
  "正在逐维度测算得分……",
  "正在整理漏洞与追问清单……",
];

export default function NewSessionPage() {
  const router = useRouter();
  const { layer } = useDataLayer();
  const [teamName, setTeamName] = useState("");
  const [competition, setCompetition] = useState<CompetitionId>("opc");
  const [bpText, setBpText] = useState("");
  const [mode, setMode] = useState<JudgeMode>("normal");
  const [persona, setPersona] = useState<Persona>("tech");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (/\.(txt|md)$/i.test(f.name)) {
      setBpText(await f.text());
    } else {
      setError("文件解析暂支持 .txt / .md，Word/PDF 请复制文本粘贴");
    }
  }

  function validateStep(step: number): string {
    if (step === 1 && !teamName.trim()) return "请填写团队名称";
    if (step === 2 && bpText.trim().length < 50) return "BP 内容太短，至少 50 字（可只贴核心章节）";
    return "";
  }

  async function submit() {
    setError("");
    if (!teamName.trim()) return setError("请填写团队名称");
    if (bpText.trim().length < 50) return setError("BP 内容太短，至少 50 字（可只贴核心章节）");

    setBusy(true);
    try {
      if (!layer) throw new Error("数据层初始化中，请重试");
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...demoTokenHeaders },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ bp_text: bpText, competition }),
      });
      const data = (await res.json()) as { error?: string } & DiagnosisReport;
      if (!res.ok || data.error) throw new Error(data.error || "诊断失败，请重试");

      const team = await layer.team.ensure(teamName.trim());
      const saved = await layer.session.create({
        team_id: team.team_id,
        team_name: team.name,
        competition,
        bp_text: bpText,
        bp_summary: bpText.slice(0, 200),
        mode,
        persona,
        diagnosis: data,
        overall_score: data.overall_score,
        dimension_scores: data.dimensions,
        status: "diagnosed",
        created_at: new Date().toISOString(),
      });
      router.push(`/report/${saved.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "诊断失败，请重试");
      setBusy(false);
    }
  }

  const errorBanner = error && (
    <p className="text-crimson text-sm border border-crimson/30 bg-crimson/5 px-3 py-2">{error}</p>
  );

  return (
    <section className="mx-auto max-w-2xl px-5 pt-24 pb-14">
      <a href="/" className="text-sm text-muted hover:text-ink transition-colors">
        ← 返回首页
      </a>
      <h1 className="font-serif font-bold text-3xl mt-5 mb-1">新建一场训练</h1>
      <p className="text-muted text-sm mb-6">填写项目信息，诊断官将按目标赛事的评分标准逐维度体检。</p>

      <div className="bg-card border border-line p-6 lg:p-8">
        <Stepper
          initialStep={1}
          linear
          disableStepIndicators={busy}
          width="100%"
          radius={8}
          theme="light"
          frame={false}
          onStepChange={(step) => {
            setCurrentStep(step);
            setError("");
          }}
          backButtonText="上一步"
          nextButtonText="下一步"
          completeButtonText={busy ? "诊断官正在逐维度阅读你的 BP…" : "开始诊断，进入训练"}
          backButtonProps={{ disabled: busy }}
          nextButtonProps={{
            disabled: busy,
            className: currentStep === 3 ? "stepper__button--cta" : "",
            onClick: (event) => {
              if (currentStep === 3) {
                event.preventDefault();
                submit();
              } else {
                const message = validateStep(currentStep);
                if (message) {
                  setError(message);
                  event.preventDefault();
                }
              }
            },
          }}
          style={
            {
              "--stepper-ink": "var(--color-ink)",
              "--stepper-muted": "var(--color-muted)",
              "--stepper-faint": "rgba(22, 22, 19, 0.18)",
              "--stepper-solid": "var(--color-pine)",
              "--stepper-solid-ink": "var(--color-paper)",
              "--stepper-well": "rgba(22, 22, 19, 0.05)",
              "--stepper-track": "rgba(22, 22, 19, 0.1)",
            } as React.CSSProperties
          }
        >
          <Step title="项目信息">
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-sm font-medium block mb-1.5">团队名称</span>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="如：星舟团队"
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium block mb-1.5">目标赛事</span>
                  <select
                    value={competition}
                    onChange={(e) => setCompetition(e.target.value as CompetitionId)}
                    className={fieldCls}
                  >
                    {Object.values(COMPETITIONS).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {errorBanner}
            </div>
          </Step>

          <Step title="商业计划书">
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">
                  商业计划书 <span className="text-muted font-normal">（粘贴全文，或上传 .txt/.md）</span>
                </span>
                <textarea
                  value={bpText}
                  onChange={(e) => setBpText(e.target.value)}
                  rows={9}
                  placeholder="粘贴 BP 核心内容：项目概述、痛点与方案、市场与商业模式、团队分工、进展与风险……&#10;内容越完整，诊断越准。"
                  className="w-full border border-line bg-paper px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-copper transition-colors resize-y"
                />
                <span className="text-xs text-muted mt-1 block">
                  当前 {bpText.length} 字
                  <label className="ml-3 underline cursor-pointer hover:text-copper">
                    上传文件
                    <input type="file" accept=".txt,.md" onChange={onFile} className="hidden" />
                  </label>
                </span>
              </label>
              {errorBanner}
            </div>
          </Step>

          <Step title="训练设置">
            <div className="space-y-5">
              <div>
                <span className="text-sm font-medium block mb-2">训练强度</span>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["normal", "普通模式", "约 8-9 题 · 追问一层 · 建立信心"],
                      ["hell", "地狱模式", "追问到底 · 压力测试 · 提前排雷"],
                    ] as const
                  ).map(([v, label, desc]) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setMode(v)}
                      className={`text-left border px-4 py-3 transition-colors ${
                        mode === v ? "border-pine bg-pine text-paper" : "border-line bg-paper hover:border-copper/60"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {v === "hell" && "† "}
                        {label}
                      </span>
                      <span className={`block text-xs mt-0.5 ${mode === v ? "text-paper/70" : "text-muted"}`}>
                        {desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium block mb-2">首选评委（陪练中可随时切换）</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["tech", "技术评委", "死磕可行性与数据"],
                      ["biz", "商业评委", "市场、模式与竞争"],
                      ["investor", "投资人评委", "回报、壁垒与团队信用"],
                    ] as const
                  ).map(([v, label, desc]) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setPersona(v)}
                      title={desc}
                      className={`border px-3.5 py-2 text-sm transition-colors ${
                        persona === v
                          ? "border-copper bg-copper/10 text-ink font-medium"
                          : "border-line bg-paper hover:border-copper/60"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {errorBanner}
            </div>
          </Step>
        </Stepper>

        {busy && (
          <div className="mt-5 border border-copper/30 bg-copper/5 px-4 py-3 text-sm" role="status" aria-live="polite">
            <span className="text-copper font-semibold">{DIAGNOSE_PHASES[Math.floor(elapsed / 4) % DIAGNOSE_PHASES.length]}</span>
            <span className="text-muted text-xs ml-3">已等待 {elapsed} 秒 · 正常需要 15-40 秒，请勿关闭页面</span>
          </div>
        )}

        <p className="text-xs text-muted text-center mt-5">
          BP 仅保存在你的浏览器本地；诊断与陪练时会临时调用 AI 服务生成结果，服务器不做存储、不复用你的内容；可随时在训练档案删除。
        </p>
      </div>
    </section>
  );
}
