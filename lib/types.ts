// 数据模型 —— 对应《技术实现方案》§5 四张数据表 + 附录 C 诊断报告 Schema

export type CompetitionId = "opc" | "chuangxin" | "tiaozhanbei" | "sanchuang" | "lanqiao" | "kecheng";

export type JudgeMode = "normal" | "hell";

export type Persona = "tech" | "biz" | "investor";

export type SessionStatus =
  | "diagnosing"
  | "diagnosed"
  | "practicing"
  | "practiced"
  | "reviewed";

export type WeaknessStatus = "open" | "confirmed" | "closed" | "invalid";

export interface Team {
  team_id: string;
  name: string;
  created_at: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  max: number;
  comment: string;
}

export interface DiagnosisWeakness {
  point: string;
  severity: "high" | "mid" | "low";
  expect_question: string;
}

export interface DiagnosisReport {
  overall_score: number;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: DiagnosisWeakness[];
  mock?: boolean;
}

export interface Session {
  session_id: string;
  team_id: string;
  team_name: string;
  competition: CompetitionId;
  bp_text: string;
  bp_summary: string;
  mode: JudgeMode;
  persona: Persona;
  overall_score?: number;
  dimension_scores?: DimensionScore[];
  diagnosis?: DiagnosisReport;
  review?: ReviewReport;
  status: SessionStatus;
  total_rounds?: number;
  created_at: string;
}

export interface QARecord {
  record_id: string;
  session_id: string;
  round: number;
  persona: Persona;
  question: string;
  answer: string;
  score?: number; // 1-5
  comment?: string;
  weakness_flag?: boolean;
  created_at: string;
}

export interface WeaknessItem {
  item_id: string;
  team_id: string;
  session_id: string;
  description: string;
  severity: "high" | "mid" | "low";
  status: WeaknessStatus;
  created_session: string;
  closed_session?: string;
  created_at: string;
}

// ---- 评委 Agent 单轮输出 ----
export interface JudgeTurn {
  score: number | null; // 对用户上一条回答的评分（开场为 null）
  comment: string; // ≤40 字评语
  action: "followup" | "next" | "end";
  question: string; // 追问 / 下一题 / 结束语
  target?: string; // 出题依据（「漏洞#N」/「弱点N」/「高频题库·维度名」/「自由」），UI 可见化 60% 定向打弱点
  mock?: boolean;
  mock_reason?: "nokey" | "degraded"; // nokey=未配置 Key；degraded=AI 调用失败降级
}

// ---- 复盘 Agent 输出 ----
export interface PastWeaknessVerdict {
  description: string; // 对应历史漏洞描述，原样回传
  status: "recurred" | "improved" | "untouched"; // 本场复发 / 已改善 / 未涉及
}

export interface ReviewReport {
  overall_comment: string;
  dimension_scores: DimensionScore[];
  per_question: { round: number; comment: string; reference?: string }[];
  weaknesses: { description: string; severity: "high" | "mid" | "low"; source_round: number }[];
  past_weakness_verdicts?: PastWeaknessVerdict[];
  next_suggestion: string;
  mock?: boolean;
}

export interface JudgeHistoryItem {
  round: number;
  persona: Persona;
  question: string;
  answer: string;
  score?: number;
  comment?: string;
}
