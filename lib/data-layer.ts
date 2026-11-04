"use client";

/* 统一数据层 —— 登录用户走 Supabase（lib/db 云实现），未登录走 localStorage（lib/store 本地实现）。
   页面只依赖 DataLayer 接口，通过 useDataLayer() 按登录态自动选择。 */

import { useMemo } from "react";
import { qaTable, sessionTable, teamTable, uid, weaknessTable } from "./store";
import { useAuth } from "./auth-context";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { QARecord, Session, Team, WeaknessItem } from "./types";

type SessionInput = Omit<Session, "session_id"> & { session_id?: string };
type QAInput = Omit<QARecord, "record_id"> & { record_id?: string };
type WeaknessInput = Omit<WeaknessItem, "item_id"> & { item_id?: string };

export interface DataLayer {
  kind: "local" | "cloud";
  team: {
    list(): Promise<Team[]>;
    ensure(name: string): Promise<Team>;
    remove(team_id: string): Promise<void>;
  };
  session: {
    list(): Promise<Session[]>;
    get(id: string): Promise<Session | null>;
    create(input: SessionInput): Promise<Session>;
    update(id: string, patch: Partial<Session>): Promise<void>;
    remove(id: string): Promise<void>;
    /** 同团队、早于本场、已有复盘的最近一场（对比分用） */
    prevReviewed(teamId: string, excludeSessionId: string): Promise<Session | null>;
  };
  qa: {
    listBySession(sessionId: string): Promise<QARecord[]>;
    add(input: QAInput): Promise<QARecord>;
    update(recordId: string, patch: Partial<QARecord>): Promise<void>;
  };
  weakness: {
    listByTeam(teamId: string): Promise<WeaknessItem[]>;
    add(input: WeaknessInput): Promise<WeaknessItem>;
    update(itemId: string, patch: Partial<WeaknessItem>): Promise<void>;
    stats(teamId: string): Promise<{ total: number; closed: number; rate: number }>;
  };
}

/* ---------------- 本地实现（包装 lib/store.ts） ---------------- */

export function createLocalLayer(): DataLayer {
  return {
    kind: "local",
    team: {
      list: async () => teamTable.list(),
      ensure: async (name) => teamTable.create(name),
      remove: async (team_id) => teamTable.remove(team_id),
    },
    session: {
      list: async () => sessionTable.list(),
      get: async (id) => sessionTable.get(id) ?? null,
      create: async (input) => {
        const s: Session = { ...input, session_id: input.session_id ?? uid("s") };
        sessionTable.create(s);
        return s;
      },
      update: async (id, patch) => sessionTable.update(id, patch),
      remove: async (id) => sessionTable.remove(id),
      prevReviewed: async (teamId, excludeSessionId) => {
        const prev = sessionTable
          .list()
          .filter((x) => x.team_id === teamId && x.session_id !== excludeSessionId && x.review)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return prev ?? null;
      },
    },
    qa: {
      listBySession: async (sid) => qaTable.listBySession(sid),
      add: async (input) => {
        const r: QARecord = {
          ...input,
          record_id: input.record_id ?? uid("qa"),
        };
        qaTable.add(r);
        return r;
      },
      update: async (record_id, patch) => qaTable.update(record_id, patch),
    },
    weakness: {
      listByTeam: async (teamId) => weaknessTable.listByTeam(teamId),
      add: async (input) => {
        const w: WeaknessItem = {
          ...input,
          item_id: input.item_id ?? uid("wk"),
        };
        weaknessTable.add(w);
        return w;
      },
      update: async (item_id, patch) => weaknessTable.update(item_id, patch),
      stats: async (teamId) => weaknessTable.stats(teamId),
    },
  };
}

/* ---------------- 云端实现（Supabase，RLS 兜底） ---------------- */

type SessionRow = {
  id: string;
  team_id: string;
  team_name: string;
  competition: Session["competition"];
  bp_text: string;
  bp_summary: string;
  mode: Session["mode"];
  persona: Session["persona"];
  overall_score: number | null;
  dimension_scores: Session["dimension_scores"] | null;
  diagnosis: Session["diagnosis"] | null;
  review: Session["review"] | null;
  status: Session["status"];
  total_rounds: number | null;
  created_at: string;
};

function rowToSession(r: SessionRow): Session {
  return {
    session_id: r.id,
    team_id: r.team_id,
    team_name: r.team_name,
    competition: r.competition,
    bp_text: r.bp_text,
    bp_summary: r.bp_summary,
    mode: r.mode,
    persona: r.persona,
    overall_score: r.overall_score ?? undefined,
    dimension_scores: r.dimension_scores ?? undefined,
    diagnosis: r.diagnosis ?? undefined,
    review: r.review ?? undefined,
    status: r.status,
    total_rounds: r.total_rounds ?? undefined,
    created_at: r.created_at,
  };
}

function sessionPayload(input: Partial<SessionInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.team_id !== undefined) p.team_id = input.team_id;
  if (input.team_name !== undefined) p.team_name = input.team_name;
  if (input.competition !== undefined) p.competition = input.competition;
  if (input.bp_text !== undefined) p.bp_text = input.bp_text;
  if (input.bp_summary !== undefined) p.bp_summary = input.bp_summary;
  if (input.mode !== undefined) p.mode = input.mode;
  if (input.persona !== undefined) p.persona = input.persona;
  if (input.overall_score !== undefined) p.overall_score = input.overall_score;
  if (input.dimension_scores !== undefined) p.dimension_scores = input.dimension_scores;
  if (input.diagnosis !== undefined) p.diagnosis = input.diagnosis;
  if (input.review !== undefined) p.review = input.review;
  if (input.status !== undefined) p.status = input.status;
  if (input.total_rounds !== undefined) p.total_rounds = input.total_rounds;
  if (input.created_at !== undefined) p.created_at = input.created_at;
  return p;
}

export function createCloudLayer(): DataLayer {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 未配置");

  const cloud: DataLayer = {
    kind: "cloud",
    team: {
      list: async () => {
        const { data, error } = await supabase.from("teams").select("*").order("created_at");
        if (error) throw new Error(error.message);
        return (data ?? []).map((t) => ({ team_id: t.id, name: t.name, created_at: t.created_at }) as Team);
      },
      ensure: async (name) => {
        const existing = await cloud.team.list();
        const found = existing.find((t) => t.name === name);
        if (found) return found;
        const { data, error } = await supabase.from("teams").insert({ name }).select().single();
        if (error) throw new Error(error.message);
        return { team_id: data.id, name: data.name, created_at: data.created_at } as Team;
      },
      remove: async (team_id) => {
        const { error } = await supabase.from("teams").delete().eq("id", team_id);
        if (error) throw new Error(error.message);
      },
    },
    session: {
      list: async () => {
        const { data, error } = await supabase.from("sessions").select("*").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return (data ?? []).map(rowToSession);
      },
      get: async (id) => {
        const { data, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? rowToSession(data as SessionRow) : null;
      },
      create: async (input) => {
        const { data, error } = await supabase.from("sessions").insert(sessionPayload(input)).select().single();
        if (error) throw new Error(error.message);
        return rowToSession(data as SessionRow);
      },
      update: async (id, patch) => {
        const { error } = await supabase.from("sessions").update(sessionPayload(patch)).eq("id", id);
        if (error) throw new Error(error.message);
      },
      remove: async (id) => {
        const { error } = await supabase.from("sessions").delete().eq("id", id);
        if (error) throw new Error(error.message);
      },
      prevReviewed: async (teamId, excludeSessionId) => {
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .eq("team_id", teamId)
          .neq("id", excludeSessionId)
          .not("review", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw new Error(error.message);
        const row = (data ?? [])[0] as SessionRow | undefined;
        return row ? rowToSession(row) : null;
      },
    },

    qa: {
      listBySession: async (sid) => {
        const { data, error } = await supabase.from("qa_records").select("*").eq("session_id", sid).order("round");
        if (error) throw new Error(error.message);
        return (data ?? []).map((r) => ({
          record_id: r.id as string,
          session_id: r.session_id as string,
          round: r.round as number,
          persona: r.persona as QARecord["persona"],
          question: r.question as string,
          answer: (r.answer as string) ?? "",
          score: (r.score as number | null) ?? undefined,
          comment: (r.comment as string | null) ?? undefined,
          weakness_flag: (r.weakness_flag as boolean | null) ?? undefined,
          created_at: r.created_at as string,
        }));
      },
      add: async (input) => {
        const { data, error } = await supabase
          .from("qa_records")
          .insert({
            session_id: input.session_id,
            round: input.round,
            persona: input.persona,
            question: input.question,
            answer: input.answer,
            score: input.score ?? null,
            comment: input.comment ?? null,
            weakness_flag: input.weakness_flag ?? false,
            created_at: input.created_at,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return {
          record_id: data.id as string,
          session_id: data.session_id as string,
          round: data.round as number,
          persona: data.persona as QARecord["persona"],
          question: data.question as string,
          answer: (data.answer as string) ?? "",
          score: (data.score as number | null) ?? undefined,
          comment: (data.comment as string | null) ?? undefined,
          weakness_flag: (data.weakness_flag as boolean | null) ?? undefined,
          created_at: data.created_at as string,
        };
      },
      update: async (recordId, patch) => {
        const p: Record<string, unknown> = {};
        if (patch.score !== undefined) p.score = patch.score;
        if (patch.comment !== undefined) p.comment = patch.comment;
        if (patch.weakness_flag !== undefined) p.weakness_flag = patch.weakness_flag;
        const { error } = await supabase.from("qa_records").update(p).eq("id", recordId);
        if (error) throw new Error(error.message);
      },
    },

    weakness: {
      listByTeam: async (teamId) => {
        const { data, error } = await supabase
          .from("weakness_items")
          .select("*")
          .eq("team_id", teamId)
          .order("created_at");
        if (error) throw new Error(error.message);
        return (data ?? []).map((r) => ({
          item_id: r.id as string,
          team_id: r.team_id as string,
          session_id: r.session_id as string,
          description: r.description as string,
          severity: r.severity as WeaknessItem["severity"],
          status: r.status as WeaknessItem["status"],
          created_session: r.created_session as string,
          closed_session: (r.closed_session as string | null) ?? undefined,
          created_at: r.created_at as string,
        }));
      },
      add: async (input) => {
        const { data, error } = await supabase
          .from("weakness_items")
          .insert({
            team_id: input.team_id,
            session_id: input.session_id,
            description: input.description,
            severity: input.severity,
            status: input.status,
            created_session: input.created_session,
            closed_session: input.closed_session ?? null,
            created_at: input.created_at,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return {
          item_id: data.id as string,
          team_id: data.team_id as string,
          session_id: data.session_id as string,
          description: data.description as string,
          severity: data.severity as WeaknessItem["severity"],
          status: data.status as WeaknessItem["status"],
          created_session: data.created_session as string,
          closed_session: (data.closed_session as string | null) ?? undefined,
          created_at: data.created_at as string,
        };
      },
      update: async (itemId, patch) => {
        const p: Record<string, unknown> = {};
        if (patch.status !== undefined) p.status = patch.status;
        if (patch.closed_session !== undefined) p.closed_session = patch.closed_session;
        const { error } = await supabase.from("weakness_items").update(p).eq("id", itemId);
        if (error) throw new Error(error.message);
      },
      stats: async (teamId) => {
        const items = await cloud.weakness.listByTeam(teamId);
        const tracked = items.filter((w) => w.status !== "invalid");
        const closed = tracked.filter((w) => w.status === "closed").length;
        return { total: tracked.length, closed, rate: tracked.length ? closed / tracked.length : 0 };
      },
    },
  };
  return cloud;
}

/* ---------------- 登录态选择器 ---------------- */

export function useDataLayer(): { layer: DataLayer | null; ready: boolean; isCloud: boolean } {
  const { user, loading, isConfigured } = useAuth();
  return useMemo(() => {
    if (loading) return { layer: null, ready: false, isCloud: false };
    if (isConfigured && user) return { layer: createCloudLayer(), ready: true, isCloud: true };
    return { layer: createLocalLayer(), ready: true, isCloud: false };
  }, [user, loading, isConfigured]);
}

/* ---------------- 本地数据一次性导入云端（幂等） ---------------- */

const MIGRATED_KEY = "lp_migrated_to";

export function hasLocalData(): boolean {
  if (typeof window === "undefined") return false;
  return (localStorage.getItem("lp_sessions") ?? "[]") !== "[]";
}

export function alreadyMigrated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(MIGRATED_KEY));
}

export async function importLocalToCloud(cloud: DataLayer): Promise<{
  teams: number;
  sessions: number;
  qa: number;
  weaknesses: number;
}> {
  const local = createLocalLayer();
  const teams = await local.team.list();
  const sessions = await local.session.list();
  const sessionMap = new Map<string, string>(); // 旧 session_id -> 新 id
  const teamMap = new Map<string, string>(); // 旧 team_id -> 新 id
  let qaCount = 0;
  let wkCount = 0;

  for (const t of teams) {
    const nt = await cloud.team.ensure(t.name);
    teamMap.set(t.team_id, nt.team_id);
  }

  // 按创建时间正序导入，保证 round 与 created_at 顺序
  const ordered = [...sessions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const s of ordered) {
    const newTeamId = teamMap.get(s.team_id) ?? (await cloud.team.ensure(s.team_name)).team_id;
    const ns = await cloud.session.create({
      team_id: newTeamId,
      team_name: s.team_name,
      competition: s.competition,
      bp_text: s.bp_text,
      bp_summary: s.bp_summary,
      mode: s.mode,
      persona: s.persona,
      overall_score: s.overall_score,
      dimension_scores: s.dimension_scores,
      diagnosis: s.diagnosis,
      review: s.review,
      status: s.status,
      total_rounds: s.total_rounds,
      created_at: s.created_at,
    });
    sessionMap.set(s.session_id, ns.session_id);

    const records = await local.qa.listBySession(s.session_id);
    for (const r of records) {
      await cloud.qa.add({
        session_id: ns.session_id,
        round: r.round,
        persona: r.persona,
        question: r.question,
        answer: r.answer,
        score: r.score,
        comment: r.comment,
        weakness_flag: r.weakness_flag,
        created_at: r.created_at,
      });
      qaCount += 1;
    }
  }

  for (const t of teams) {
    const items = await local.weakness.listByTeam(t.team_id);
    const newTeamId = teamMap.get(t.team_id);
    if (!newTeamId) continue;
    for (const w of items) {
      const newSessionId = sessionMap.get(w.session_id);
      if (!newSessionId) continue; // 该漏洞所属场次未迁移则跳过
      await cloud.weakness.add({
        team_id: newTeamId,
        session_id: newSessionId,
        description: w.description,
        severity: w.severity,
        status: w.status,
        created_session: sessionMap.get(w.created_session) ?? newSessionId,
        closed_session: w.closed_session ? sessionMap.get(w.closed_session) : undefined,
        created_at: w.created_at,
      });
      wkCount += 1;
    }
  }

  localStorage.setItem(MIGRATED_KEY, JSON.stringify({ at: new Date().toISOString(), sessions: sessionMap.size }));
  return { teams: teamMap.size, sessions: sessionMap.size, qa: qaCount, weaknesses: wkCount };
}
