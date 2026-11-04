// 五维评分条（雷达图的低代码替代呈现，技术方案 §6 P2 说明）

import type { DimensionScore } from "@/lib/types";

export function ScoreBars({ dims }: { dims: DimensionScore[] }) {
  return (
    <div className="space-y-4">
      {dims.map((d, i) => {
        const pct = Math.round((d.score / d.max) * 100);
        return (
          <div key={d.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-medium text-sm">{d.name}</span>
              <span className="font-serif text-lg">
                {d.score}
                <span className="text-muted text-xs"> / {d.max}</span>
              </span>
            </div>
            <div className="h-2 bg-line/60 rounded-full overflow-hidden">
              <div
                className={`bar-fill h-full rounded-full ${pct >= 70 ? "bg-pine" : pct >= 45 ? "bg-copper" : "bg-crimson"}`}
                style={{ width: `${pct}%`, animationDelay: `${i * 90}ms` }}
              />
            </div>
            {d.comment && <p className="text-xs text-muted mt-1.5">{d.comment}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function ScoreRing({ score, label }: { score: number; label?: string }) {
  // 大数字呈现综合分（0-100）
  return (
    <div className="text-center">
      <div className="font-serif font-bold text-6xl leading-none text-pine">
        {score}
        <span className="text-2xl text-muted font-sans font-normal">分</span>
      </div>
      {label && <div className="text-xs text-muted mt-2 tracking-widest">{label}</div>}
    </div>
  );
}

// 五维雷达图（技术方案 §6 优化项：比评分条更直观，适合路演截图）
export function RadarChart({ dims, size = 300 }: { dims: DimensionScore[]; size?: number }) {
  const n = dims.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 58;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const px = (i: number, r: number) => cx + Math.cos(angle(i)) * r;
  const py = (i: number, r: number) => cy + Math.sin(angle(i)) * r;

  const ringPath = (f: number) =>
    dims.map((_, i) => `${i ? "L" : "M"}${px(i, R * f).toFixed(1)},${py(i, R * f).toFixed(1)}`).join(" ") + " Z";
  const valPath = (f: (i: number) => number) =>
    dims.map((_, i) => `${i ? "L" : "M"}${px(i, R * f(i)).toFixed(1)},${py(i, R * f(i)).toFixed(1)}`).join(" ") + " Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label="五维评分雷达图">
      {/* 网格环 */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <path key={f} d={ringPath(f)} fill="none" stroke="#ddd6c4" strokeWidth="1" />
      ))}
      {/* 轴线 */}
      {dims.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={px(i, R)} y2={py(i, R)} stroke="#ddd6c4" strokeWidth="1" />
      ))}
      {/* 数值面 */}
      <path d={valPath((i) => Math.max(0.05, dims[i].score / dims[i].max))} fill="rgba(176,122,42,0.22)" stroke="#b07a2a" strokeWidth="2" />
      {/* 顶点 */}
      {dims.map((d, i) => {
        const x = px(i, R * Math.max(0.05, d.score / d.max));
        const y = py(i, R * Math.max(0.05, d.score / d.max));
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#b07a2a" stroke="#fffdf8" strokeWidth="1.5" />;
      })}
      {/* 维度名与得分 */}
      {dims.map((d, i) => {
        const lx = px(i, R + 26);
        const ly = py(i, R + 26);
        const anchor = Math.abs(Math.cos(angle(i))) < 0.3 ? "middle" : Math.cos(angle(i)) > 0 ? "start" : "end";
        return (
          <g key={`l${i}`}>
            <text x={lx} y={ly - 4} textAnchor={anchor} fontSize="12" fontWeight="600" fill="#211f19">
              {d.name}
            </text>
            <text x={lx} y={ly + 11} textAnchor={anchor} fontSize="11" fill="#6f6a5c">
              {d.score}/{d.max}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
