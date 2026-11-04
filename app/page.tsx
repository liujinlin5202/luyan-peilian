"use client";

import { useEffect, useState } from "react";
import { FoldText } from "@/components/fold-text";
import "./fold-text.css";

/* 操作指引弹层内容 */
const GUIDE_STEPS = [
  ["01", "诊断体检", "粘贴 BP，AI 诊断官按目标赛事的评分标准逐维度打分，指出漏洞与风险"],
  ["02", "模拟陪练", "进入评委席答辩：AI 评委逐题追问，可随时切换技术 / 商业 / 投资人视角"],
  ["03", "复盘归档", "生成复盘报告：评分雷达、漏洞档案与改进追踪，下一场对着练"],
];

const GUIDE_PARTS = [
  ["新建训练", "填团队名称、选目标赛事，粘贴 BP 全文（或上传 .txt/.md），开始诊断"],
  ["训练强度", "普通模式 8-12 题建立信心；地狱模式追问到底，赛前排雷"],
  ["训练档案", "所有场次与成绩曲线集中管理，可删除单场测试数据"],
  ["漏洞追踪", "上一场未解决的漏洞会带进新一场追问，复盘时标记「已关闭」即闭环"],
];

/* 开屏编织体 ·「绞带」：单族细线（左下 → 右上），早线深沉、晚线上拱，带身自我交叉出扭结眼；1 条蓝丝线穿带。逐笔画出后缓慢摆动 */
type WeavePath = { d: string; w: number; blue?: boolean };

function weaveLerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* 一族线：t ∈ [0,1]，端点/控制点分别沿各自的 [起点,终点] 区间滑动，形成近直纹的编织带面 */
function bandPath(
  t: number,
  p0: [number, number, number, number],
  c1: [number, number, number, number],
  c2: [number, number, number, number],
  p3: [number, number, number, number],
): string {
  const f = (r: [number, number, number, number]) =>
    `${weaveLerp(r[0], r[1], t).toFixed(1)} ${weaveLerp(r[2], r[3], t).toFixed(1)}`;
  return `M${f(p0)} C${f(c1)} ${f(c2)} ${f(p3)}`;
}

const WEAVE_PATHS: WeavePath[] = [];
// 单族 13 条：左下 → 右上；控制点高度与端点高度反向滑动 → 带身中段自我绞结；第 7 条为蓝丝线
for (let i = 0; i < 13; i++) {
  const t = i / 12;
  WEAVE_PATHS.push({
    d: bandPath(t, [54, 94, 142, 232], [136, 164, 202, 118], [264, 290, 214, 120], [364, 336, 64, 160]),
    w: i === 6 ? 2 : 1.05 + (i % 2) * 0.15,
    ...(i === 6 ? { blue: true } : {}),
  });
}

/* 开屏背景 · 光束：三族发光细束（紫罗兰/蓝/金）在左侧交叉穿行，两端渐隐 + 柔光晕；另有两道虚线为持续流动的脉冲 */
type Beam = { d: string; w: number; grad: "gV" | "gB" | "gG" | "gT"; flow?: boolean };

function beamPath(
  t: number,
  A: [number, number, number, number],
  C1: [number, number, number, number],
  C2: [number, number, number, number],
  B: [number, number, number, number],
): string {
  const f = (r: [number, number, number, number]) =>
    `${weaveLerp(r[0], r[1], t).toFixed(1)} ${weaveLerp(r[2], r[3], t).toFixed(1)}`;
  return `M${f(A)} C${f(C1)} ${f(C2)} ${f(B)}`;
}

const BEAMS: Beam[] = [];
// T 族 · 青：顶部五连束（与 A 族同构，位于其上方）
for (let i = 0; i < 5; i++) {
  const t = i / 4;
  BEAMS.push({
    d: beamPath(t, [-30, -10, 40, 150], [230, 280, 30, 110], [380, 430, 150, 230], [610, 630, 230, 340]),
    w: 1.3 + (i % 3) * 0.5,
    grad: "gT",
  });
}
// A 族 · 紫罗兰：左上 → 右下五连束（扇形展开）
for (let i = 0; i < 5; i++) {
  const t = i / 4;
  BEAMS.push({
    d: beamPath(t, [-30, -10, 140, 240], [230, 280, 130, 220], [380, 430, 310, 390], [610, 630, 370, 510]),
    w: 1.3 + (i % 3) * 0.5,
    grad: "gV",
  });
}
// B 族 · 蓝：左上 → 右下四连束（与 A 族同向平行，位于其下方）
for (let i = 0; i < 4; i++) {
  const t = i / 3;
  BEAMS.push({
    d: beamPath(t, [-30, -10, 260, 370], [230, 290, 270, 360], [390, 440, 400, 480], [610, 630, 500, 630]),
    w: i === 1 ? 2.2 : 1.2 + i * 0.25,
    grad: "gB",
  });
}
// C 族 · 金：近水平三连细束
for (let i = 0; i < 3; i++) {
  const t = i / 2;
  BEAMS.push({
    d: beamPath(t, [-30, -10, 420, 475], [250, 300, 410, 455], [430, 480, 490, 530], [610, 630, 540, 585]),
    w: 0.9 + i * 0.35,
    grad: "gG",
  });
}
// 流光脉冲：沿两条路径持续流动的虚线
BEAMS.push({
  d: beamPath(0.4, [-30, -10, 220, 310], [230, 290, 200, 280], [390, 440, 370, 450], [610, 630, 440, 570]),
  w: 1.1,
  grad: "gV",
  flow: true,
});
BEAMS.push({
  d: beamPath(0.55, [-30, -10, 310, 420], [230, 290, 300, 390], [390, 440, 430, 510], [610, 630, 530, 650]),
  w: 1,
  grad: "gB",
  flow: true,
});

export default function HomePage() {
  const [guideOpen, setGuideOpen] = useState(false);

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
        {/* 最底层：交叉光束（左），所有文字与图形压于其上 */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[64vw] max-w-[700px] opacity-75 md:opacity-100" aria-hidden="true">
          <svg
            className="hero-rise h-full w-full"
            viewBox="0 0 900 900"
            fill="none"
            preserveAspectRatio="xMinYMid slice"
            style={{ "--d": "0.1s" } as React.CSSProperties}
          >
            <defs>
              <linearGradient id="gV" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8f6cf0" stopOpacity="0" />
                <stop offset="0.22" stopColor="#8f6cf0" />
                <stop offset="0.55" stopColor="#6d4fd8" />
                <stop offset="0.85" stopColor="#b78cff" stopOpacity="0.05" />
                <stop offset="1" stopColor="#b78cff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gB" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#2b46ff" stopOpacity="0" />
                <stop offset="0.3" stopColor="#2b46ff" />
                <stop offset="0.6" stopColor="#6f8cff" />
                <stop offset="0.85" stopColor="#6f8cff" stopOpacity="0.05" />
                <stop offset="1" stopColor="#6f8cff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#c9a24b" stopOpacity="0" />
                <stop offset="0.3" stopColor="#c9a24b" />
                <stop offset="0.85" stopColor="#e0c37a" stopOpacity="0.05" />
                <stop offset="1" stopColor="#e0c37a" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gT" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#2c9d8e" stopOpacity="0" />
                <stop offset="0.25" stopColor="#2c9d8e" />
                <stop offset="0.6" stopColor="#5fc9b8" />
                <stop offset="0.85" stopColor="#8fdccd" stopOpacity="0.05" />
                <stop offset="1" stopColor="#8fdccd" stopOpacity="0" />
              </linearGradient>
              <filter id="beamGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {BEAMS.map((b, i) =>
              b.flow ? (
                <path
                  key={i}
                  d={b.d}
                  stroke={`url(#${b.grad})`}
                  strokeWidth={b.w}
                  strokeLinecap="round"
                  className="beam-flow"
                  opacity={0.9}
                />
              ) : (
                <g key={i}>
                  <path
                    d={b.d}
                    stroke={`url(#${b.grad})`}
                    strokeWidth={b.w * 3.4}
                    filter="url(#beamGlow)"
                    opacity={0.3}
                    strokeLinecap="round"
                    className="beam-draw"
                    style={{ "--i": i } as React.CSSProperties}
                  />
                  <path
                    d={b.d}
                    stroke={`url(#${b.grad})`}
                    strokeWidth={b.w}
                    opacity={0.85}
                    strokeLinecap="round"
                    className="beam-draw"
                    style={{ "--i": i } as React.CSSProperties}
                  />
                </g>
              ),
            )}
          </svg>
        </div>
        {/* 背景丰富层：柔光晕 × hello 气球（透明渐变，衬在文字与编织体之后） */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[#f3d8c3] opacity-40 blur-3xl" />
          <div className="absolute -right-16 top-1/4 h-[22rem] w-[22rem] rounded-full bg-[#ccd8ff] opacity-40 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/3 h-[20rem] w-[20rem] rounded-full bg-[#eadfc6] opacity-50 blur-3xl" />
          <div
            className="hero-rise absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 md:left-[52%] md:top-[40%]"
            style={{ "--d": "0.45s" } as React.CSSProperties}
          >
            <svg viewBox="0 0 640 320" className="hello-float w-[min(92vw,760px)] md:w-[min(82vw,880px)] opacity-65" fill="none">
              <defs>
                <linearGradient id="helloGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4c4c44" stopOpacity="0.5" />
                  <stop offset="24%" stopColor="#2c2c26" stopOpacity="0.4" />
                  <stop offset="36%" stopColor="#1a1a16" stopOpacity="0.36" />
                  <stop offset="64%" stopColor="#0e0e0c" stopOpacity="0.42" />
                  <stop offset="86%" stopColor="#080807" stopOpacity="0.48" />
                  <stop offset="100%" stopColor="#45443b" stopOpacity="0.42" />
                </linearGradient>
                <filter id="helloPuff" x="-20%" y="-20%" width="140%" height="150%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
                  <feSpecularLighting
                    in="blur"
                    surfaceScale="7"
                    specularConstant="1.15"
                    specularExponent="24"
                    lightingColor="#ffffff"
                    result="spec"
                  >
                    <fePointLight x="210" y="30" z="200" />
                  </feSpecularLighting>
                  <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
                  <feMerge>
                    <feMergeNode in="SourceGraphic" />
                    <feMergeNode in="specIn" />
                  </feMerge>
                </filter>
              </defs>
              {/* 底层：白色圆角胖描边（气球的白色包边）；上层：渐变圆角笔画 */}
              <text
                x="320"
                y="235"
                textAnchor="middle"
                fontSize="200"
                letterSpacing="0"
                fill="none"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth="9"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ fontFamily: 'var(--font-script),"Snell Roundhand","Brush Script MT",cursive' }}
              >
                hello
              </text>
              <text
                x="320"
                y="235"
                textAnchor="middle"
                fontSize="200"
                letterSpacing="0"
                fill="url(#helloGrad)"
                stroke="url(#helloGrad)"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
                filter="url(#helloPuff)"
                style={{ fontFamily: 'var(--font-script),"Snell Roundhand","Brush Script MT",cursive' }}
              >
                hello
              </text>
              <ellipse cx="180" cy="112" rx="30" ry="12" fill="#ffffff" opacity="0.65" transform="rotate(-24 180 112)" />
              <ellipse cx="455" cy="150" rx="14" ry="7" fill="#ffffff" opacity="0.5" transform="rotate(16 455 150)" />
            </svg>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 relative flex flex-col min-h-dvh">
          {/* 两行巨型字（左） + 编织体（右），互不重叠 */}
          <div className="relative mt-auto pt-16 -mb-6">
            <div className="md:flex md:items-center md:justify-between md:gap-2">
              <div className="tracking-tight leading-[1.08] text-[13vw] sm:text-7xl lg:text-[86px] xl:text-[92px] md:translate-y-16">
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
              <div
                className="hero-rise relative z-10 pointer-events-none flex justify-center mt-4 md:mt-0 md:flex-1 md:flex md:justify-end md:items-center md:-mr-32 md:-translate-y-28 lg:-translate-y-36 xl:-translate-y-44"
                style={{ "--d": "0.4s" } as React.CSSProperties}
              >
                <svg
                  className="weave weave-float -scale-y-100 rotate-[48deg] scale-x-125 w-[min(70vw,480px)] sm:w-[min(60vw,520px)] md:w-[min(38vw,440px)] lg:w-[min(36vw,460px)] xl:w-[min(35vw,480px)] md:max-w-full h-auto"
                  viewBox="40 52 340 192"
                  fill="none"
                  aria-hidden="true"
                >
                  {WEAVE_PATHS.map((p, i) => (
                    <path
                      key={i}
                      d={p.d}
                      stroke={p.blue ? "#2b46ff" : "#1c1c1a"}
                      strokeWidth={p.w}
                      strokeLinecap="round"
                      style={{ "--i": i } as React.CSSProperties}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* 底部：引文 + 双胶囊按钮（品牌行居中于按钮上方） */}
          <div className="pb-10 flex flex-wrap gap-x-10 gap-y-6 items-end justify-end relative">
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
            className="hero-rise relative w-full max-w-2xl max-h-[86dvh] overflow-y-auto bg-paper border border-ink shadow-2xl"
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
