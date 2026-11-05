"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Stepper, { Step } from "@/components/bits/Stepper";
import { ThinkingStatus } from "@/components/thinking-status";
import mammoth from "mammoth";
import { demoTokenHeaders } from "@/lib/demo-token";
import { COMPETITIONS } from "@/lib/knowledge";
import { useDataLayer } from "@/lib/data-layer";
import type { CompetitionId, DiagnosisReport, JudgeMode, Persona } from "@/lib/types";

const fieldCls =
  "w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-copper transition-colors";

export default function NewSessionPage() {
  const router = useRouter();
  const { layer } = useDataLayer();
  const [teamName, setTeamName] = useState("");
  const [competition, setCompetition] = useState<CompetitionId>("opc");
  const [bpText, setBpText] = useState("");
  const [mode, setMode] = useState<JudgeMode>("normal");
  const [persona, setPersona] = useState<Persona>("tech");
  const [busy, setBusy] = useState(false);
  const [diagnosisFinished, setDiagnosisFinished] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const bpFileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // localStorage 单键约 5MB，BP 只需核心章节：超限直接拦下并说明
    if (f.size > 200 * 1024) {
      setError("文件超过 200KB：诊断只需核心章节，请精简后再上传");
      return;
    }
    try {
      if (/\.(txt|md)$/i.test(f.name)) {
        setBpText(await f.text());
      } else if (/\.docx$/i.test(f.name)) {
        // 真实用户的 BP 几乎都是 Word：mammoth 纯前端抽取文本，不经过服务器
        const { value } = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
        setBpText(value);
      } else {
        setError("文件解析支持 .docx / .txt / .md，PDF 请复制文本粘贴");
        return;
      }
      setError("");
    } catch {
      setError("文件解析失败，请确认是有效的 .docx/.txt/.md，或直接复制文本粘贴");
    }
  }

  function validateStep(step: number): string {
    if (step === 1 && !teamName.trim()) return "请填写团队名称";
    if (step === 3 && bpText.trim().length < 50) return "BP 内容太短，至少 50 字（可只贴核心章节）";
    return "";
  }

  async function submit() {
    setError("");
    if (!teamName.trim()) return setError("请填写团队名称");
    if (bpText.trim().length < 50) return setError("BP 内容太短，至少 50 字（可只贴核心章节）");

    setBusy(true);
    setDiagnosisFinished(false);
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
      // 保留完成态一拍，让三条勾选与 ThoughtLine 的收起过渡可见。
      setDiagnosisFinished(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
      router.push(`/report/${saved.session_id}`);
    } catch (err) {
      const quota =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" || (err as { code?: number }).code === 22);
      setError(
        quota
          ? "浏览器本地存储空间不足：请在训练档案删除旧场次，或精简 BP 后重试"
          : err instanceof Error
            ? err.message
            : "诊断失败，请重试"
      );
      setBusy(false);
    }
  }

  const errorBanner = error && (
    <p className="text-crimson text-sm border border-crimson/30 bg-crimson/5 px-3 py-2">{error}</p>
  );

  return (
    <section className="mx-auto max-w-2xl px-5 pt-24 pb-14">
      <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">
        ← 返回首页
      </Link>
      <h1 className="font-serif font-bold text-3xl mt-5 mb-6">新建一场训练</h1>

      <div className="bg-card border border-line rounded-3xl p-6 lg:p-8">
        <Stepper
          initialStep={1}
          linear
          disableStepIndicators={busy}
          width="100%"
          radius={24}
          theme="light"
          frame={false}
          onStepChange={(step) => {
            setCurrentStep(step);
            setError("");
          }}
          backButtonText="上一步"
          nextButtonText="下一步"
          completeButtonText={busy ? "诊断中…" : "开始诊断，进入训练"}
          backButtonProps={{ disabled: busy }}
          nextButtonProps={{
            disabled: busy,
            className: currentStep === 4 ? "stepper__button--cta" : "",
            onClick: (event) => {
              if (currentStep === 4) {
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
          <Step title="团队名称">
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">团队名称</span>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="如：星舟团队"
                  className={fieldCls}
                />
              </label>
              {errorBanner}
            </div>
          </Step>

          <Step title="目标赛事">
            <div className="space-y-5">
              <div>
                <span className="text-sm font-medium block mb-2">目标赛事</span>
                <div className="space-y-2.5">
                  {Object.values(COMPETITIONS).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCompetition(c.id)}
                      className={`w-full text-left border px-4 py-3 rounded-xl transition-colors ${
                        competition === c.id
                          ? "border-pine bg-pine text-paper"
                          : "border-line bg-paper hover:border-copper/60"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{c.name}</span>
                      <span
                        className={`text-xs mt-1 leading-relaxed line-clamp-2 ${
                          competition === c.id ? "text-paper/70" : "text-muted"
                        }`}
                      >
                        {c.focus}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {errorBanner}
            </div>
          </Step>

          <Step title="商业计划书">
            <div className="space-y-5">
              <div>
                <label htmlFor="bp-content" className="text-sm font-medium block mb-1.5">
                  商业计划书 <span className="text-muted font-normal">（粘贴全文，或上传 .docx/.txt/.md）</span>
                </label>
                <textarea
                  id="bp-content"
                  value={bpText}
                  onChange={(e) => setBpText(e.target.value)}
                  rows={9}
                  placeholder="粘贴 BP 核心内容：项目概述、痛点与方案、市场与商业模式、团队分工、进展与风险……&#10;内容越完整，诊断越准。"
                  className="w-full border border-line bg-paper px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-copper transition-colors resize-y"
                />
                <div className="text-xs text-muted mt-2 flex flex-wrap items-center justify-between gap-3">
                  <span>当前 {bpText.length} 字</span>
                  <button type="button" className="action-button action-button--small" onClick={() => bpFileRef.current?.click()}>
                    上传文件
                  </button>
                  <input ref={bpFileRef} type="file" accept=".txt,.md,.docx" onChange={onFile} className="hidden" aria-label="上传 BP 文件" />
                </div>
              </div>
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
          <ThinkingStatus
            className="mt-5"
            working={busy && !diagnosisFinished}
            label="正在阅读 BP…"
            doneLabel="BP 诊断已完成 · 用时"
            steps={[
              "阅读项目内容与目标赛事",
              "对照评分标准进行诊断",
              "整理漏洞与追问建议",
            ]}
            estimatedDuration={4.5}
            holdLastStep
            note="通常需 15–40 秒，请稍候。"
          />
        )}

        <p className="text-xs text-muted text-center mt-5">
          BP 仅保存在你的浏览器本地；诊断与陪练时会临时调用 AI 服务生成结果，服务器不做存储、不复用你的内容；可随时在训练档案删除。
        </p>
      </div>
    </section>
  );
}
