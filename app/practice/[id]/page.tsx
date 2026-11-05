"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MockBanner } from "@/components/ui";
import { GlassCard } from "@/components/glass-card";
import Magnet from "@/components/bits/Magnet";
import { GradientButton } from "@/components/gradient-button";
import VoicePill from "@/components/bits/VoicePill";
import { demoTokenHeaders } from "@/lib/demo-token";
import { COMPETITIONS, MODES, PERSONAS } from "@/lib/knowledge";
import { useDataLayer } from "@/lib/data-layer";
import type { JudgeHistoryItem, JudgeTurn, Persona, QARecord, Session } from "@/lib/types";

interface Bubble {
  kind: "judge" | "user" | "system";
  text: string;
  score?: number;
  comment?: string;
  target?: string;
}

// 待回答的问题：出题时的评委与依据要随题固定（切人设后提交归属不串位）
interface PendingQuestion {
  text: string;
  persona: Persona;
  target?: string;
}

const ROUND_LIMIT = { normal: 9, hell: 10 } as const;
// 与服务端 SDK 45 秒超时 + 1 次重试对齐：前端 50 秒封顶，绝不无限等待
const JUDGE_TIMEOUT = 50_000;
// 限时作答：模拟真实答辩节奏（倒计时归零只提示，不清空输入）
const ANSWER_LIMIT_SEC = { normal: 90, hell: 60 } as const;

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { layer } = useDataLayer();

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [records, setRecords] = useState<QARecord[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("评委正在出题");
  const [ended, setEnded] = useState(false);
  const [mock, setMock] = useState(false);
  const [mockReason, setMockReason] = useState<"nokey" | "degraded">("nokey");
  const [startFailed, setStartFailed] = useState(false);
  const [askModal, setAskModal] = useState(false);
  const [askText, setAskText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  // 语音输入：浏览器 Web Speech API 转写，识别结果实时写入作答框
  const recRef = useRef<{ stop: () => void } | null>(null);
  const voiceBaseRef = useRef("");
  const voiceFinalRef = useRef("");

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* 忽略卸载时的停止失败 */
      }
      recRef.current = null;
    };
  }, []);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  // 限时作答倒计时：出新题启动，答完/结束/超时停止；超时只提示不清空。
  // 题目切换时在渲染期同步调整状态（React 官方 prop→state 调整模式，避免 effect 内同步 setState）
  const mode = session?.mode;
  const [timerFor, setTimerFor] = useState<PendingQuestion | null>(null);
  if (timerFor !== pendingQuestion) {
    setTimerFor(pendingQuestion);
    setSecondsLeft(pendingQuestion && !ended ? ANSWER_LIMIT_SEC[mode ?? "normal"] : null);
  }
  const timerRunning = secondsLeft != null && !ended && pendingQuestion != null;
  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => setSecondsLeft((s) => (s == null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  function pushSystem(text: string) {
    setBubbles((bs) => [...bs, { kind: "system", text }]);
  }

  function toAsked(rs: QARecord[]): JudgeHistoryItem[] {
    return rs.map((r) => ({
      round: r.round,
      persona: r.persona,
      question: r.question,
      answer: r.answer,
      score: r.score,
      comment: r.comment,
    }));
  }

  // 历史未闭合漏洞（跨场定向追问）：上一场没补上的洞，本场评委优先追问
  async function pastWeaknesses(s: Session): Promise<string[]> {
    if (!layer) return [];
    const all = await layer.weakness.listByTeam(s.team_id);
    return all
      .filter((w) => (w.status === "open" || w.status === "confirmed") && w.created_at < s.created_at)
      .map((w) => w.description);
  }

  // 首题 / 中断续场（刷新后不再强制结束场次）
  async function startFlow(s: Session, existed: QARecord[]) {
    if (!layer) return;
    const limit = ROUND_LIMIT[s.mode];
    const last = existed[existed.length - 1];
    setBusy(true);
    try {
      if (last && last.answer && last.score == null) {
        // 最后一答已提交但评分丢失（判分请求被刷新打断）：补评分并由评委续问
        setBusyLabel("评委正在补点评并准备下一题");
        await callJudge(s, "answer", toAsked(existed), { user_answer: last.answer, pending_question: last.question });
      } else if (existed.length === 0) {
        setBusyLabel("评委正在出题");
        await callJudge(s, "start", []);
      } else if (existed.length < limit) {
        // 中断续场：评委接管，从下一题继续（未达题数上限不强制结束）
        setBusyLabel("评委正在恢复出题");
        await callJudge(s, "switch", toAsked(existed), { resume: true, persona: s.persona });
      } else {
        setEnded(true);
      }
      if (existed.length > 0) await layer.session.update(s.session_id, { status: "practicing" });
    } catch {
      setStartFailed(true);
      pushSystem("评委暂时掉线，点击「重新出题」再试一次。");
    } finally {
      setBusy(false);
    }
  }

  function retryStart() {
    if (!session) return;
    setStartFailed(false);
    startFlow(session, records);
  }

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
        // 恢复中断的场次：重放记录，再续场（不再强制结束）
        const bs: Bubble[] = [];
        for (const r of existed) {
          bs.push({ kind: "judge", text: r.question });
          bs.push({ kind: "user", text: r.answer });
          if (r.comment) bs.push({ kind: "judge", text: "", score: r.score, comment: r.comment });
        }
        setBubbles(bs);
        setPendingQuestion(null);
        if (!startedRef.current) {
          startedRef.current = true;
          startFlow(s, existed);
        }
      } else {
        // 首题（startedRef 防重：React StrictMode 下 effect 会执行两次，只允许发一次请求）
        if (!startedRef.current) {
          startedRef.current = true;
          startFlow(s, existed);
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
    extra?: { user_answer?: string; pending_question?: string; persona?: Persona; resume?: boolean }
  ) {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...demoTokenHeaders },
      signal: AbortSignal.timeout(JUDGE_TIMEOUT),
      body: JSON.stringify({
        competition: s.competition,
        bp_summary: s.bp_summary,
        diagnosis: s.diagnosis,
        mode: s.mode,
        persona: extra?.persona ?? s.persona,
        phase,
        asked,
        user_answer: extra?.user_answer,
        pending_question: extra?.pending_question,
        past_weaknesses: await pastWeaknesses(s),
      }),
    });
    if (!res.ok) throw new Error("评委服务暂时不可用，请重试");
    const turn = (await res.json()) as JudgeTurn;
    if (turn.mock) {
      setMock(true);
      setMockReason(turn.mock_reason ?? "degraded");
    }
    if (!turn.question || !turn.question.trim()) throw new Error("评委没有返回有效题目");

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
        next.push({
          kind: "system",
          text: extra?.resume ? "中场恢复，评委继续提问。" : `评委席换人，现在是${PERSONAS[extra?.persona ?? s.persona].label}。`,
        });
      }
      next.push({ kind: "judge", text: turn.question, target: turn.target });
      return next;
    });

    if (turn.action === "end") {
      setEnded(true);
      setPendingQuestion(null);
    } else {
      setPendingQuestion({ text: turn.question, persona: extra?.persona ?? s.persona, target: turn.target });
    }
    scrollDown();
  }

  // ---- 语音输入（Web Speech API）----
  function startVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: typeof w.SpeechRecognition;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      pushSystem("当前浏览器不支持语音识别，请用 Chrome / Edge 或手动输入。");
      return;
    }
    try {
      recRef.current?.stop();
    } catch {
      /* 忽略重复停止 */
    }
    voiceBaseRef.current = input;
    voiceFinalRef.current = "";
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) voiceFinalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(voiceBaseRef.current + voiceFinalRef.current + interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        pushSystem("麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。");
      }
    };
    rec.onend = () => {
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      pushSystem("语音识别启动失败，请稍后重试或手动输入。");
    }
  }

  function stopVoice(reason: string) {
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* 忽略停止失败 */
    }
    if (reason === "cancel") {
      setInput(voiceBaseRef.current);
      voiceFinalRef.current = "";
      pushSystem("已取消本次语音输入。");
    } else {
      setInput(voiceBaseRef.current + voiceFinalRef.current);
    }
  }

  async function send() {
    if (!session || !layer || !input.trim() || !pendingQuestion || busy || ended) return;
    try {
      recRef.current?.stop();
    } catch {
      /* 忽略 */
    }
    recRef.current = null;
    const answer = input.trim();
    const askedQuestion = pendingQuestion;
    setInput("");
    setBusy(true);

    // 重发场景：上一条回答已入库但未拿到评分（网络失败恢复），更新原记录而非新增，避免题数虚增
    const failed = records.find((r) => r.score == null && !r.comment && r.question === askedQuestion.text);
    let record: QARecord;
    let newRecords: QARecord[];
    if (failed) {
      record = { ...failed, answer };
      newRecords = records.map((r) => (r.record_id === failed.record_id ? record : r));
      await layer.qa.update(failed.record_id, { answer });
      setRecords(newRecords);
      setBubbles((bs) => [...bs, { kind: "user", text: answer }]);
    } else {
      const round = records.length + 1;
      record = await layer.qa.add({
        session_id: session.session_id,
        round,
        persona: askedQuestion.persona,
        question: askedQuestion.text,
        answer,
        created_at: new Date().toISOString(),
      });
      newRecords = [...records, record];
      setRecords(newRecords);
      setBubbles((bs) => [...bs, { kind: "user", text: answer }]);
    }
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

    setBusyLabel("评委正在点评并准备下一题");
    try {
      await callJudge(session, "answer", asked, { user_answer: answer, pending_question: record.question });
      if (!failed) await layer.session.update(session.session_id, { status: "practicing" });
    } catch {
      // 失败恢复：本题恢复可发送，原回答保留可修改后重发
      setPendingQuestion(askedQuestion);
      pushSystem("网络异常，评委没有收到这条回答。可直接重新发送（已入库的回答会更新而不是重复计题）。");
    } finally {
      setBusy(false);
    }
  }

  async function switchPersona(p: Persona) {
    if (!session || !layer || busy || ended) return;
    setBusy(true);
    setBusyLabel("评委正在接棒出题");
    await layer.session.update(session.session_id, { persona: p });
    setSession({ ...session, persona: p });
    try {
      await callJudge(session, "switch", toAsked(records), { persona: p });
    } catch {
      pushSystem("评委席切换失败，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    if (!session || !layer || busy) return;
    const next = session.mode === "normal" ? "hell" : "normal";
    layer.session.update(session.session_id, { mode: next });
    setSession({ ...session, mode: next });
    pushSystem(`训练强度切换为${MODES[next].label}。`);
  }

  // 评委现场出题：演示收尾互动 / 评委临时加问的入口
  function submitJudgeQuestion() {
    const q = askText.trim();
    if (!q || !session || busy || ended) return;
    setAskModal(false);
    setAskText("");
    pushSystem("评委席现场加入了一道新问题。");
    setPendingQuestion({ text: q, persona: session.persona });
    scrollDown();
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
        <Link href="/" className="action-button">
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
      {mock && <MockBanner reason={mockReason} />}

      {/* 评委席状态栏 · 玻璃质感 */}
      <GlassCard className="mb-6" contentClassName="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] text-muted tracking-widest">{comp.name} · 评委席</p>
            <p className="font-serif font-bold text-lg truncate text-ink">
              {session.team_name} · 第 {Math.min(records.length + (pendingQuestion ? 1 : 0), limit)}/{limit} 题
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {(Object.keys(PERSONAS) as Persona[]).map((p) => (
              <Magnet key={p} padding={55} magnetStrength={8} maxOffset={6} scale={1.03}>
                <button
                  onClick={() => switchPersona(p)}
                  disabled={busy || ended}
                  className={`text-xs px-4 py-2 rounded-full border transition-colors disabled:opacity-40 ${
                    session.persona === p
                      ? "border-ink/20 bg-shell text-ink font-bold"
                      : "border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {PERSONAS[p].label}
                </button>
              </Magnet>
            ))}
            <Magnet padding={55} magnetStrength={8} maxOffset={6} scale={1.03}>
              <button
                onClick={switchMode}
                disabled={busy || ended}
                className={`text-xs px-4 py-2 rounded-full border transition-colors disabled:opacity-40 ${
                  session.mode === "hell"
                    ? "border-crimson/60 bg-crimson/10 text-crimson font-bold"
                    : "border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink"
                }`}
              >
                {MODES[session.mode].label}
              </button>
            </Magnet>
          </div>
      </GlassCard>

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
      <div className="bg-card border border-line rounded-3xl p-5 sm:p-7 min-h-[50vh] max-h-[62vh] overflow-y-auto space-y-5">
        {bubbles.map((b, i) =>
          b.kind === "system" ? (
            <p key={i} className="text-center text-xs text-muted py-1">
              — {b.text} —
            </p>
          ) : b.kind === "user" ? (
            <div key={i} className="fade-up flex justify-end">
              <div className="max-w-[80%] bg-pine text-paper px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap">
                {b.text}
              </div>
            </div>
          ) : (
            <div key={i} className="fade-up flex gap-3">
              <div className="w-8 h-8 bg-pine text-paper font-serif text-xs rounded-lg flex items-center justify-center shrink-0 mt-0.5" aria-hidden>
                评
              </div>
              <div className="max-w-[85%]">
                {b.target && (
                  <p className="text-[10px] text-copper tracking-wide mb-1.5">🎯 打向：{b.target}</p>
                )}
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
            <div className="w-8 h-8 bg-pine text-paper font-serif text-xs rounded-lg flex items-center justify-center shrink-0" aria-hidden>
              评
            </div>
            <div className="bg-paper border border-line px-4 py-3 text-sm flex items-center gap-1">
              {busyLabel}
              <span className="thinking-dot">·</span>
              <span className="thinking-dot">·</span>
              <span className="thinking-dot">·</span>
            </div>
          </div>
        )}
        {startFailed && !busy && (
          <div className="flex justify-center">
            <button
              onClick={retryStart}
              className="text-sm border border-crimson text-crimson px-5 py-2 hover:bg-crimson hover:text-paper transition-colors"
            >
              重新出题
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      {ended ? (
        <GlassCard className="mt-5" contentClassName="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="font-serif font-bold text-lg text-ink">
            本场 {records.length} 题答完。评委退场，复盘官进场。
          </p>
          <GradientButton onClick={finish}>生成复盘报告 →</GradientButton>
        </GlassCard>
      ) : (
        <div className="mt-5">
          {secondsLeft != null && (
            <div className="mb-2">
              <div className="h-1 bg-line/60 overflow-hidden" aria-hidden>
                <div
                  className={`h-full ease-linear ${
                    secondsLeft === 0 ? "bg-crimson" : secondsLeft <= 15 ? "bg-crimson/80" : secondsLeft <= 40 ? "bg-copper" : "bg-pine"
                  }`}
                  style={{ width: `${(secondsLeft / ANSWER_LIMIT_SEC[mode ?? "normal"]) * 100}%`, transition: "width 1s linear" }}
                />
              </div>
              <p className="text-[11px] text-muted mt-1" role="timer" aria-label={`剩余作答时间 ${secondsLeft} 秒`}>
                {secondsLeft > 0 ? (
                  <>
                    限时作答 <strong className={secondsLeft <= 15 ? "text-crimson" : ""}>{secondsLeft}s</strong>
                    （模拟现场节奏，超时不清空你的回答）
                  </>
                ) : (
                  <span className="text-crimson font-bold">已超时——正式答辩此刻评委会打断你了。写完再发也可以。</span>
                )}
              </p>
            </div>
          )}
          <div className="flex gap-3">
          <div className="flex-1 min-w-0 flex flex-col border border-line bg-card focus-within:border-pine transition-colors">
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
              placeholder={pendingQuestion ? "像正式答辩一样作答：Enter 发送，Shift+Enter 换行；也可以点下方麦克风语音作答。" : "等待评委出题…"}
              className="w-full bg-transparent px-4 py-3 text-sm leading-relaxed outline-none resize-none disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-2">
              <span className="text-[10px] text-muted tabular-nums shrink-0">{input.length} 字</span>
              <div className="flex items-center min-w-0">
                <VoicePill
                  size={30}
                  background="#161613"
                  accentColor="#eceae5"
                  iconColor="#6d6c66"
                  showTime
                  waveform
                  slideToCancel
                  cancelDistance={64}
                  attack={40}
                  release={240}
                  sensitivity={1}
                  floor={0.1}
                  openDuration={200}
                  pressScale={0.95}
                  mode="auto"
                  holdAfter={300}
                  reactive="simulated"
                  disabled={busy || !pendingQuestion}
                  ariaLabel="语音输入"
                  onStart={() => startVoice()}
                  onStop={({ reason }) => stopVoice(reason)}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={send}
              disabled={busy || !input.trim() || !pendingQuestion}
              className="bg-pine text-paper font-bold px-6 py-3 rounded-xl flex-1 hover:bg-pinedeep transition-colors disabled:opacity-40"
            >
              回答
            </button>
            <button
              onClick={() => setAskModal(true)}
              disabled={busy || ended}
              className="action-button w-full"
            >
              评委现场出题
            </button>
            <button
              onClick={finish}
              disabled={busy || records.length === 0}
              className="action-button w-full"
            >
              练够了，去复盘
            </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-3 text-center">
        评委只提问与点评，不会替你回答；质疑针对方案本身。当前评委：{persona.label}
      </p>

      {/* 评委现场出题弹层 */}
      {askModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center px-5"
          onClick={() => setAskModal(false)}
        >
          <div
            className="bg-paper border border-line rounded-3xl w-full max-w-lg p-6"
            role="dialog"
            aria-modal="true"
            aria-label="评委现场出题"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-serif font-bold text-lg mb-1">评委现场出题</p>
            <p className="text-xs text-muted mb-4">
              演示互动或真实评委临时加问时，把问题录入这里：它会作为当前评委的提问进入本场记录并正常计分。
            </p>
            <textarea
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAskModal(false);
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submitJudgeQuestion();
                }
              }}
              rows={3}
              autoFocus
              placeholder="输入评委的问题，如：你们的获客成本是多少？"
              className="w-full border border-line bg-paper px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-copper transition-colors resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setAskModal(false)}
                className="text-sm border border-line text-muted px-4 py-2 hover:border-ink hover:text-ink transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitJudgeQuestion}
                disabled={!askText.trim()}
                className="bg-pine text-paper font-bold px-5 py-2 rounded-xl hover:bg-pinedeep transition-colors disabled:opacity-40"
              >
                交给评委提问
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
