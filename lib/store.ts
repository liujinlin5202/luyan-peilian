// localStorage 数据层 —— 实现技术方案 §5 的四张数据表（teams / sessions / qa_records / weakness_items）

import type { QARecord, Session, Team, WeaknessItem } from "./types";

const KEYS = {
  teams: "lp_teams",
  sessions: "lp_sessions",
  qa_records: "lp_qa_records",
  weakness_items: "lp_weakness_items",
} as const;

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]) {
  // BP 全文入库可能触发 QuotaExceededError：捕获后返回 false，调用方数据不丢内存态，页面不崩
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
    return true;
  } catch {
    console.warn(`[store] 写入失败（可能是存储配额已满）: ${key}`);
    return false;
  }
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---- teams ----
export const teamTable = {
  list: () => read<Team>(KEYS.teams),
  create: (name: string): Team => {
    const teams = read<Team>(KEYS.teams);
    const existing = teams.find((t) => t.name === name);
    if (existing) return existing;
    const team: Team = { team_id: uid("team"), name, created_at: new Date().toISOString() };
    write(KEYS.teams, [...teams, team]);
    return team;
  },
  remove: (team_id: string) => {
    // 合规：档案删除能力（技术方案 §10），级联清理三张关联表
    write(KEYS.teams, read<Team>(KEYS.teams).filter((t) => t.team_id !== team_id));
    const sids = new Set(read<Session>(KEYS.sessions).filter((s) => s.team_id === team_id).map((s) => s.session_id));
    write(KEYS.sessions, read<Session>(KEYS.sessions).filter((s) => s.team_id !== team_id));
    write(KEYS.qa_records, read<QARecord>(KEYS.qa_records).filter((r) => !sids.has(r.session_id)));
    write(KEYS.weakness_items, read<WeaknessItem>(KEYS.weakness_items).filter((w) => w.team_id !== team_id));
  },
};

// ---- sessions ----
export const sessionTable = {
  list: () => read<Session>(KEYS.sessions).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  get: (id: string) => read<Session>(KEYS.sessions).find((s) => s.session_id === id),
  create: (s: Session) => write(KEYS.sessions, [...read<Session>(KEYS.sessions), s]),
  update: (id: string, patch: Partial<Session>) => {
    write(
      KEYS.sessions,
      read<Session>(KEYS.sessions).map((s) => (s.session_id === id ? { ...s, ...patch } : s))
    );
  },
  remove: (id: string) => {
    // 级联清理：该场会话 + 问答记录 + 该场确认产出的漏洞项
    write(KEYS.sessions, read<Session>(KEYS.sessions).filter((s) => s.session_id !== id));
    write(KEYS.qa_records, read<QARecord>(KEYS.qa_records).filter((r) => r.session_id !== id));
    write(KEYS.weakness_items, read<WeaknessItem>(KEYS.weakness_items).filter((w) => w.session_id !== id));
  },
};

// ---- qa_records ----
export const qaTable = {
  listBySession: (session_id: string) =>
    read<QARecord>(KEYS.qa_records)
      .filter((r) => r.session_id === session_id)
      .sort((a, b) => a.round - b.round),
  add: (r: QARecord) => write(KEYS.qa_records, [...read<QARecord>(KEYS.qa_records), r]),
  update: (record_id: string, patch: Partial<QARecord>) => {
    write(
      KEYS.qa_records,
      read<QARecord>(KEYS.qa_records).map((r) => (r.record_id === record_id ? { ...r, ...patch } : r))
    );
  },
};

// ---- weakness_items ----
export const weaknessTable = {
  listByTeam: (team_id: string) => read<WeaknessItem>(KEYS.weakness_items).filter((w) => w.team_id === team_id),
  add: (w: WeaknessItem) => write(KEYS.weakness_items, [...read<WeaknessItem>(KEYS.weakness_items), w]),
  update: (item_id: string, patch: Partial<WeaknessItem>) => {
    write(
      KEYS.weakness_items,
      read<WeaknessItem>(KEYS.weakness_items).map((w) => (w.item_id === item_id ? { ...w, ...patch } : w))
    );
  },
  stats: (team_id: string) => {
    const items = read<WeaknessItem>(KEYS.weakness_items).filter((w) => w.team_id === team_id);
    const tracked = items.filter((w) => w.status !== "invalid");
    const closed = tracked.filter((w) => w.status === "closed").length;
    return { total: tracked.length, closed, rate: tracked.length ? closed / tracked.length : 0 };
  },
};
