"use client";

import { useEffect, useState } from "react";
import ThoughtLine, { type ThoughtLineProps } from "@/components/bits/ThoughtLine";

const EMPTY_STEPS: string[] = [];

type ThinkingStatusProps = Pick<ThoughtLineProps, "working" | "label" | "doneLabel" | "steps" | "className"> & {
  note?: string;
  estimatedDuration?: number;
  holdLastStep?: boolean;
};

export function ThinkingStatus({ working, label, doneLabel, steps = EMPTY_STEPS, note, estimatedDuration = 4.5, holdLastStep = false, className = "" }: ThinkingStatusProps) {
  const running = Boolean(working);
  const planKey = JSON.stringify(steps);
  const [progress, setProgress] = useState({ running, planKey, completed: 0 });

  // 新请求或重试从第一条重新播放；父组件更新标签不会重置进度。
  if (progress.running !== running || progress.planKey !== planKey) {
    setProgress({ running, planKey, completed: 0 });
  }

  useEffect(() => {
    const count = (JSON.parse(planKey) as string[]).length;
    if (!running || count === 0) return;
    // 这是演示进度：将预估时长平均分给各条，实际请求决定最终收起。
    const interval = (Math.max(0.3, estimatedDuration) * 1000) / count;
    const timers = Array.from({ length: holdLastStep ? count - 1 : count }, (_, index) => window.setTimeout(() => {
      setProgress((state) => state.running && state.planKey === planKey
        ? { ...state, completed: index + 1 }
        : state);
    }, interval * (index + 1)));
    return () => timers.forEach(window.clearTimeout);
  }, [running, planKey, estimatedDuration, holdLastStep]);

  const completed = running ? Math.min(progress.completed, steps.length) : steps.length;
  const visibleSteps = running ? steps.slice(0, Math.min(completed + 1, steps.length)) : steps;
  const waitingForResult = running && steps.length > 0 && completed === steps.length;

  return (
    <div className={`min-w-0 rounded-2xl border border-line bg-paper/60 px-4 py-3 ${className}`.trim()} aria-busy={working}>
      <ThoughtLine
        working={working}
        label={waitingForResult ? "正在等待结果…" : label}
        doneLabel={doneLabel ?? "处理完成 · 用时"}
        steps={visibleSteps}
        completedSteps={completed}
        glyph="sparkle"
        color="var(--color-ink)"
        glyphColor="var(--color-muted)"
        fontSize={16}
        breathPeriod={1.6}
        breathDepth={0.45}
        settleDuration={350}
        settleBlur={2}
        collapsible
        collapseOnSettle
        showTimer
      />
      {working && note && <p className="text-xs text-muted mt-2 leading-relaxed truncate" title={note}>{note}</p>}
    </div>
  );
}
