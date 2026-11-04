"use client";

import { useEffect, useState } from "react";
import { FoldText } from "@/components/fold-text";
import WebThreads from "@/components/WebThreads";
import { useDialog } from "@/lib/use-dialog";
import "./fold-text.css";

/* 操作指引弹层内容 */
const GUIDE_STEPS = [
  ["01", "诊断体检", "粘贴 BP，AI 诊断官按目标赛事的评分标准逐维度打分，指出漏洞与风险"],
  ["02", "模拟陪练", "进入评委席答辩：AI 评委逐题追问，可随时切换技术 / 商业 / 投资人视角"],
  ["03", "复盘归档", "生成复盘报告：评分雷达、漏洞档案与改进追踪，下一场对着练"],
];

const GUIDE_PARTS = [
  ["新建训练", "填团队名称、选目标赛事，粘贴 BP 全文（或上传 .docx/.txt/.md），开始诊断"],
  ["训练强度", "普通模式约 8-9 题建立信心；地狱模式追问到底，赛前排雷"],
  ["训练档案", "所有场次与成绩曲线集中管理，可删除单场测试数据，支持导出/导入备份"],
  ["漏洞追踪", "上一场未解决的漏洞会带进新一场追问，复盘时标记「已关闭」即闭环"],
];

/* 开屏视觉：WebThreads 曲线特效（见组件文件），替换原光束/编织体/hello 气球 */

export default function HomePage() {
  const [guideOpen, setGuideOpen] = useState(false);
  const guidePanelRef = useDialog(guideOpen);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGuideOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guideOpen]);

  return (
    <div>
      {/* ===== 开屏：巨型字 × 绞带编织体 × 双胶囊入口 ===== */}
      <section className="relative overflow-hidden">
        {/* 最底层：WebThreads 曲线特效（暖金→雪青→雾蓝柔和三色渐变 + depth 扭转立体感；鼠标可拨动，点击空白处起浪） */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <WebThreads
            colors={["#c29d5f", "#a08cc9", "#8a9fd4"]}
            coreColor="#6d6c66"
            lightMode
            threadCount={13}
            taper={0.55}
            spread={0.16}
            position={0.45}
            speed={0.16}
            depth={0.65}
            opacity={0.85}
            shimmer
            mouseStrength={0.6}
          />
        </div>
        {/* 背景柔光晕：衬在文字之后，避免大面积纸面过于平坦 */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[#f3d8c3] opacity-40 blur-3xl" />
          <div className="absolute -right-16 top-1/4 h-[22rem] w-[22rem] rounded-full bg-[#ccd8ff] opacity-40 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/3 h-[20rem] w-[20rem] rounded-full bg-[#eadfc6] opacity-50 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-5 relative flex flex-col min-h-dvh">
          {/* 两行巨型字：居中偏上，落在丝线绞结点上方的留白区（无小字说明） */}
          <div className="relative mt-[22dvh] md:mt-[24dvh] text-center">
              <div className="tracking-tight leading-[1.08] text-[13vw] sm:text-7xl lg:text-[86px] xl:text-[92px]">
                <span className="block font-serif italic text-[0.82em]">
                  <FoldText
                    text="在这里，"
                    splitBy="char"
                    hinge="top"
                    foldStyle="paper"
                    trigger="mount"
                    foldAngle={92}
                    duration={0.65}
                    stagger={0.045}
                    staggerFrom="start"
                    ease="power3.out"
                    loopDelay={1.4}
                    hoverRefold
                    refoldRadius={140}
                    refoldAngle={45}
                    perspective={700}
                    creaseShading={0.55}
                    fontSize="inherit"
                    fontWeight={700}
                    style={{ color: "transparent", WebkitTextStroke: "1.5px #161613" } as React.CSSProperties}
                  />
                </span>
                <span className="block font-serif italic">
                  <FoldText
                    text="预演你的胜利。"
                    splitBy="char"
                    hinge="top"
                    foldStyle="paper"
                    trigger="mount"
                    foldAngle={92}
                    duration={0.65}
                    stagger={0.045}
                    staggerFrom="start"
                    ease="power3.out"
                    loopDelay={1.4}
                    hoverRefold
                    refoldRadius={140}
                    refoldAngle={45}
                    perspective={700}
                    creaseShading={0.55}
                    fontSize="inherit"
                    fontWeight={700}
                    style={{ color: "transparent", WebkitTextStroke: "1.5px #161613" } as React.CSSProperties}
                  />
                </span>
              </div>
          </div>

          {/* 中下：双胶囊按钮 */}
          <div className="mt-[27dvh] md:mt-[25dvh] flex flex-wrap gap-x-10 gap-y-6 items-end justify-center relative">
            <div className="hero-rise flex flex-col items-center gap-3" style={{ "--d": "0.8s" } as React.CSSProperties}>
              <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col items-center gap-2.5">
              <a
                href="/new"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span className="relative z-10 transition-colors duration-500 group-hover:text-ink">
                  开始新训练
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 18 18"
                  fill="none"
                  className="relative z-10 transition-all duration-300 group-hover:translate-x-1 group-hover:text-ink"
                  aria-hidden="true"
                >
                  <path d="M5 5l8 8M13 6.5V13H6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span
                  className="absolute inset-0 z-0 origin-left scale-0 rounded-full bg-paper transition-transform duration-500 ease-out group-hover:scale-100"
                  aria-hidden="true"
                />
              </a>
                {/* 胶囊舱外 · 黑球队列，中间红球小幅上跳 */}
                <div className="flex items-center gap-2.5" aria-hidden="true">
                  {Array.from({ length: 7 }).map((_, i) =>
                    i === 3 ? (
                      <span key={i} className="dot-jump block h-3 w-3 rounded-full bg-[#e05252]" />
                    ) : (
                      <span key={i} className="block h-2.5 w-2.5 rounded-full bg-ink/80" />
                    ),
                  )}
                </div>
              </div>
              <a
                href="/archive"
                className="group relative inline-flex items-center overflow-hidden rounded-full border-[1.5px] border-ink px-6 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 hover:text-paper"
              >
                <span className="relative z-10 transition-colors duration-500 group-hover:text-paper">进入训练档案</span>
                <span
                  className="absolute inset-0 z-0 origin-left scale-0 rounded-full bg-ink transition-transform duration-500 ease-out group-hover:scale-100"
                  aria-hidden="true"
                />
              </a>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="rounded-full border-[1.5px] border-ink/45 px-6 py-3 text-sm font-bold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-ink"
              >
                操作指引
              </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 操作指引弹层 ===== */}
      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="操作指引">
          <div className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setGuideOpen(false)} aria-hidden="true" />
          <div
            ref={guidePanelRef}
            tabIndex={-1}
            className="hero-rise relative w-full max-w-2xl max-h-[86dvh] overflow-y-auto bg-paper border border-ink shadow-2xl outline-none"
            style={{ "--d": "0s" } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              aria-label="关闭指引"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="p-6 sm:p-9">
              <p className="font-serif font-bold text-copperbright text-sm tracking-widest">操作指引</p>
              <h2 className="font-serif font-bold text-2xl mt-1">三步，从 BP 到上台。</h2>
              <p className="text-muted text-sm mt-1.5">先让 AI 把你的 BP 问倒，你才不会在现场被问倒。</p>

              <div className="mt-6 space-y-4">
                {GUIDE_STEPS.map(([n, t, d]) => (
                  <div key={n} className="flex gap-4 border-t border-ink/25 pt-4">
                    <span className="font-serif font-bold text-copperbright text-lg leading-snug">{n}</span>
                    <p className="text-sm leading-relaxed">
                      <strong className="text-ink">{t}</strong>
                      <span className="text-muted"> — {d}</span>
                    </p>
                  </div>
                ))}
              </div>

              <h3 className="font-serif font-bold text-lg mt-8">各个部分在做什么</h3>
              <div className="mt-3 space-y-3">
                {GUIDE_PARTS.map(([t, d]) => (
                  <p key={t} className="text-sm leading-relaxed border-l-2 border-copper/60 pl-3">
                    <strong className="text-ink">{t}</strong>
                    <span className="text-muted">：{d}</span>
                  </p>
                ))}
              </div>

              <p className="text-xs text-muted mt-8 border-t border-line pt-4">
                提示：BP 与训练记录保存在你的浏览器本地（登录后存云端档案），诊断与陪练时仅临时调用 AI 服务生成结果，服务器不做存储、不复用你的内容；同一队伍名称请跨场次保持一致，漏洞追踪才能接得上。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
