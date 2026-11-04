"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MockBanner } from "@/components/ui";
import { COMPETITIONS, MODES, PERSONAS } from "@/lib/knowledge";
import { useDataLayer } from "@/lib/data-layer";
import type { JudgeHistoryItem, JudgeTurn, Persona, QARecord, Session } from "@/lib/types";

interface Bubble {
  kind: "judge" | "user" | "system";
  text: string;
  score?: number;
  comment?: string;
}

const ROUND_LIMIT = { normal: 9, hell: 10 } as const;

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { layer } = useDataLayer();

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [records, setRecords] = useState<QARecord[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [mock, setMock] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    if (!layer) return;
    let alive = true;
    (async () => {
      const s = await layer.session.get(id);
      if (!alive) return;
      setSession(s);
      setReady(true);
      if (!s) return;
      const existed = await layer.qa.listBySession(id);
      if (!alive) return;
      setRecords(existed);
      if (existed.length) {
        // 恢复中断的场次：重放记录
        const bs: Bubble[] = [];
        for (const r of existed) {
          bs.push({ kind: "judge", text: r.question });
          bs.push({ kind: "user", text: r.answer });
          if (r.comment) bs.push({ kind: "judge", text: "", score: r.score, comment: r.comment });
        }
        setBubbles(bs);
        setPendingQuestion(null);
        setEnded(true);
      } else {
        // 首题（startedRef 防重：React StrictMode 下 effect 会执行两次，只允许发一次请求）
        if (!startedRef.current) {
          startedRef.current = true;
          setBusy(true);
          callJudge(s, "start", []).finally(() => setBusy(false));
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, layer]);

  async function callJudge(
    s: Session,
    phase: "start" | "answer" | "switch",
    asked: JudgeHistoryItem[],
    extra?: { user_answer?: string; pending_question?: string; persona?: Persona }
  ) {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competition: s.competition,
        bp_summary: s.bp_summary,
        bp_text: s.bp_text.slice(0, 6000),
        diagnosis: s.diagnosis,
        mode: s.mode,
        persona: extra?.persona ?? s.persona,
        phase,
        asked,
        user_answer: extra?.user_answer,
        pending_question: extra?.pending_question,
      }),
    });
    const turn = (await res.json()) as JudgeTurn;
    if (turn.mock) setMock(true);

    if (phase === "answer" && turn.score != null) {
      const last = asked[asked.length - 1];
      if (!layer) return;
      // 从数据层现读：闭包里的 records 不含刚插入的本题记录（陈旧值会导致逐题得分丢失）
      const rec = (await layer.qa.listBySession(s.session_id)).find((r) => r.round === last?.round);
      if (rec) {
        await layer.qa.update(rec.record_id, {
          score: turn.score,
          comment: turn.comment,
          weakness_flag: turn.score <= 2,
        });
        setRecords((rs) =>
          rs.map((r) => (r.record_id === rec.record_id ? { ...r, score: turn.score!, comment: turn.comment, weakness_flag: turn.score! <= 2 } : r))
        );
      }
    }

    setBubbles((bs) => {
      const next = [...bs];
      if (phase === "answer" && turn.comment) {
        next.push({ kind: "judge", text: "", score: turn.score ?? undefined, comment: turn.comment });
      }
      if (phase === "switch") {
        next.push({ kind: "system", text: `评委席换人，现在是${PERSONAS[extra?.persona ?? s.persona].label}。` });
      }
      next.push({ kind: "judge", text: turn.question });
      return next;
    });

    if (turn.action === "end") {
      setEnded(true);
      setPendingQuestion(null);
    } else {
      setPendingQuestion(turn.question);
    }
    scrollDown();
  }

  async function send() {
    if (!session || !layer || !input.trim() || !pendingQuestion || busy || ended) return;
    const answer = input.trim();
    setInput("");
    setBusy(true);

    const round = records.length + 1;
    const record: QARecord = await layer.qa.add({
      session_id: session.session_id,
      round,
      persona: session.persona,
      question: pendingQuestion,
      answer,
      created_at: new Date().toISOString(),
    });
    const newRecords = [...records, record];
    setRecords(newRecords);
    setBubbles((bs) => [...bs, { kind: "user", text: answer }]);
    setPendingQuestion(null);
    scrollDown();

    const asked: JudgeHistoryItem[] = newRecords.map((r) => ({
      round: r.round,
      persona: r.persona,
      question: r.question,
      answer: r.answer,
      score: r.score,
      comment: r.comment,
    }));

    try {
      await callJudge(session, "answer", asked, { user_answer: answer, pending_question: record.question });
      if (round === 1) await layer.session.update(session.session_id, { status: "practicing" });
    } finally {
      setBusy(false);
    }
  }

  async function switchPersona(p: Persona) {
    if (!session || !layer || busy || ended) return;
    setBusy(true);
    await layer.session.update(session.session_id, { persona: p });
    setSession({ ...session, persona: p });
    const asked: JudgeHistoryItem[] = records.map((r) => ({
      round: r.round,
      persona: r.persona,
      question: r.question,
      answer: r.answer,
      score: r.score,
      comment: r.comment,
    }));
    try {
      await callJudge(session, "switch", asked, { persona: p });
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    if (!session || !layer || busy) return;
    const next = session.mode === "normal" ? "hell" : "normal";
    layer.session.update(session.session_id, { mode: next });
    setSession({ ...session, mode: next });
    setBubbles((bs) => [...bs, { kind: "system", text: `训练强度切换为${MODES[next].label}。` }]);
  }

  function finish() {
    if (!layer) return;
    layer.session.update(id, { status: "practiced", total_rounds: records.length });
    router.push(`/review/${id}`);
  }

  if (!ready) return null;
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="font-serif text-2xl mb-3">训练场次不存在</p>
        <Link href="/" className="text-pine underline underline-offset-4">
          新建一场训练
        </Link>
      </div>
    );
  }

  const limit = ROUND_LIMIT[session.mode];
  const persona = PERSONAS[session.persona];
  const comp = COMPETITIONS[session.competition] ?? COMPETITIONS.opc;

  return (
    <div className="mx-auto max-w-4xl px-5 pt-24 pb-8">
      {mock && <MockBanner />}

      {/* 评委席状态栏 */}
      <div className="bg-pine text-paper p-4 sm:p-5 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] text-paper/50 tracking-widest">{comp.name} · 评委席</p>
          <p className="font-serif font-bold text-lg truncate">
            {session.team_name} · 第 {Math.min(records.length + (pendingQuestion ? 1 : 0), limit)}/{limit} 题
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {(Object.keys(PERSONAS) as Persona[]).map((p) => (
            <button
              key={p}
              onClick={() => switchPersona(p)}
              disabled={busy || ended}
              className={`text-xs px-2.5 py-1.5 border transition-colors disabled:opacity-40 ${
                session.persona === p
                  ? "border-copperbright bg-copperbright text-ink font-bold"
                  : "border-paper/30 text-paper/80 hover:border-copperbright hover:text-copperbright"
              }`}
            >
              {PERSONAS[p].label}
            </button>
          ))}
          <button
            onClick={switchMode}
            disabled={busy || ended}
            className={`text-xs px-2.5 py-1.5 border transition-colors disabled:opacity-40 ${
              session.mode === "hell"
                ? "border-crimson bg-crimson/25 text-paper font-bold"
                : "border-paper/30 text-paper/80 hover:border-copperbright"
            }`}
          >
            {MODES[session.mode].label}
          </button>
        </div>
      </div>

      {/* 逐题得分面板 */}
      {records.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-card border border-line px-4 py-2.5">
          <span className="text-[11px] text-muted tracking-widest mr-1">逐题</span>
          {records.map((r) => (
            <span
              key={r.record_id}
              title={`Q${r.round}：${r.score ?? "未评分"}/5 — ${r.question.slice(0, 30)}…`}
              className={`text-xs font-bold px-1.5 py-0.5 border transition-colors ${
                (r.score ?? 0) >= 4
                  ? "border-pine text-pine"
                  : (r.score ?? 0) >= 3
                    ? "border-copper text-copper"
                    : "border-crimson text-crimson"
              }`}
            >
              Q{r.round}
              {r.score != null && `·${r.score}`}
            </span>
          ))}
          {records.some((r) => r.score != null) && (
            <span className="ml-auto text-xs text-muted">
              均分{" "}
              <strong className="font-serif text-base text-pine">
                {(
                  records.filter((r) => r.score != null).reduce((s, r) => s + (r.score ?? 0), 0) /
                  records.filter((r) => r.score != null).length
                ).toFixed(1)}
              </strong>
              /5
            </span>
          )}
        </div>
      )}

      {/* 对话区 */}
      <div className="bg-card border border-line p-5 sm:p-7 min-h-[50vh] max-h-[62vh] overflow-y-auto space-y-5">
        {bubbles.map((b, i) =>
          b.kind === "system" ? (
            <p key={i} className="text-center text-xs text-muted py-1">
              — {b.text} —
            </p>
          ) : b.kind === "user" ? (
            <div key={i} className="fade-up flex justify-end">
              <div className="max-w-[80%] bg-pine text-paper px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                {b.text}
              </div>
            </div>
          ) : (
            <div key={i} className="fade-up flex gap-3">
              <div className="w-8 h-8 bg-pine text-paper font-serif text-xs flex items-center justify-center shrink-0 mt-0.5" aria-hidden>
                评
              </div>
              <div className="max-w-[85%]">
                {b.comment && (
                  <p className="text-xs text-muted mb-1.5">
                    {b.score != null && (
                      <span
                        className={`inline-block font-bold mr-2 px-1.5 py-0.5 border ${
                          b.score >= 4
                            ? "border-pine text-pine"
                            : b.score >= 3
                              ? "border-copper text-copper"
                              : "border-crimson text-crimson"
                        }`}
                      >
                        {b.score}/5
                      </span>
                    )}
                    {b.comment}
                  </p>
                )}
                {b.text && (
                  <div className="bg-paper border border-line px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {b.text}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {busy && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-pine text-paper font-serif text-xs flex items-center justify-center shrink-0" aria-hidden>
              评
            </div>
            <div className="bg-paper border border-line px-4 py-3 text-sm flex items-center gap-1">
              评委在记录你的回答
              <span className="thinking-dot">·</span>
              <span className="thinking-dot">·</span>
              <span className="thinking-dot">·</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      {ended ? (
        <div className="mt-5 bg-pine text-paper p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-serif font-bold text-lg">
            本场 {records.length} 题答完。评委退场，复盘官进场。
          </p>
          <button onClick={finish} className="bg-copperbright text-ink font-bold px-6 py-3 hover:brightness-110 transition">
            生成复盘报告 →
          </button>
        </div>
      ) : (
        <div className="mt-5 flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            disabled={busy || !pendingQuestion}
            placeholder={pendingQuestion ? "想象评委就在对面，拿出正式答辩的态度，才能帮你更好地完善方案哦。" : "等待评委出题…"}
            className="flex-1 min-w-0 border border-line bg-card px-4 py-3 text-sm leading-relaxed outline-none focus:border-pine transition-colors resize-none disabled:opacity-60"
          />
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={send}
              disabled={busy || !input.trim() || !pendingQuestion}
              className="bg-pine text-paper font-bold px-6 py-3 flex-1 hover:bg-pinedeep transition-colors disabled:opacity-40"
            >
              回答
            </button>
            <button
              onClick={finish}
              disabled={busy || records.length === 0}
              className="text-xs text-muted underline underline-offset-2 hover:text-crimson transition-colors disabled:opacity-40"
            >
              练够了，去复盘
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-3 text-center">
        评委只提问与点评，不会替你回答；质疑针对方案本身。当前评委：{persona.label}
      </p>
    </div>
  );
}
