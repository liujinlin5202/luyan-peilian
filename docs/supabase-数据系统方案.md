# 赛前模拟舱 · Supabase 数据系统方案

> 目标：把现有「浏览器 localStorage 四张表」升级为「Supabase 云端数据系统」，支持账号体系、跨设备同步与教师端视图。
> 原则：RLS 行级安全为第一道防线；数据访问接口与现有 `lib/store.ts` 同构，页面改动最小；未登录保留本地模式，比赛演示不依赖网络。

## 一、现状与目标

| 维度 | 现状 | 目标 |
| --- | --- | --- |
| 存储 | 浏览器 localStorage 四张表 | Supabase Postgres 四张表 + profiles |
| 账号 | 无 | Supabase Auth（邮箱登录） |
| 多端 | 不支持（按浏览器隔离） | 登录即同步 |
| 安全 | 数据不出浏览器 | RLS 行级隔离；Service Key 不下发 |
| 教师端 | 无 | 共享团队 → 班级统计 / 漏洞热点 |
| 演示 | 依赖本机数据 | 保留本地模式 + 备份导入，断网可演示 |

**设计取舍**

1. **云优先（推荐）**：登录用户全部读写 Supabase；未登录继续走 localStorage。两套数据层同构，页面按登录态选择。
2. 不做实时协同（Realtime 后置）；BP 存文本字段，大文件可后置 Storage。
3. `diagnosis` / `review` / `dimension_scores` 用 **JSONB** 存储——结构由 `lib/types.ts` 定义、应用层校验，数据库不做强约束，便于版本演进。

## 二、总体架构

```
┌──────────── 浏览器 ────────────┐
│  页面（React 客户端组件）        │
│  lib/db.ts（异步仓储 Supabase）  │ ← 登录用户
│  lib/store.ts（本地仓储）        │ ← 未登录 / 演示模式
│  @supabase/supabase-js          │
└───────▲────────────▲───────────┘
        │ PostgREST  │ Auth
┌───────┴────────────┴───────────┐
│ Supabase（Postgres + RLS + Auth）│
│ teams / sessions / qa_records    │
│ weakness_items / profiles        │
└───────▲─────────────────────────┘
        │ 仅服务端（Next API Routes 持有 DEEPSEEK_API_KEY，不落数据）
┌───────┴─────────────────────────┐
│ DeepSeek API（AI 生成，不存储）   │
└─────────────────────────────────┘
```

- AI 三条路由（diagnose / judge / review）不变：只做模型调用，返回 JSON；数据库读写全部在客户端经 Supabase 完成（anon key + 用户 JWT + RLS）。
- Service Role Key 只在服务端，本方案默认不使用（仅迁移或管理脚本需要时）。

## 三、账号体系

- 登录方式：邮箱 + 密码（Supabase Auth）；后续可加魔法链接 / OAuth，表结构不变。
- 注册即建档：`auth.users` 触发器自动写 `profiles`（角色默认 `student`）。
- 未登录：继续使用 `lib/store.ts` 本地数据层，页面功能不受影响（断网兜底）。
- 页头：登录后显示邮箱与「退出」；未登录显示「登录」入口。

## 四、数据库设计（SQL，可直接在 Supabase SQL Editor 执行）

### 4.1 profiles（扩展 auth.users）

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'student' check (role in ('student','teacher')),
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 4.2 teams

```sql
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (owner, name)
);
```

### 4.3 sessions

```sql
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null references auth.users(id) on delete cascade,
  team_id          uuid not null references public.teams(id) on delete cascade,
  team_name        text not null,
  competition      text not null,
  bp_text          text not null,
  bp_summary       text not null default '',
  mode             text not null check (mode in ('normal','hell')),
  persona          text not null check (persona in ('tech','biz','investor')),
  overall_score    numeric,
  dimension_scores jsonb,
  diagnosis        jsonb,
  review           jsonb,
  status           text not null default 'diagnosed',
  total_rounds     int,
  created_at       timestamptz not null default now()
);
create index sessions_owner_idx on public.sessions (owner, created_at desc);
create index sessions_team_idx  on public.sessions (team_id, created_at);
```

### 4.4 qa_records

```sql
create table public.qa_records (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users(id) on delete cascade,
  session_id    uuid not null references public.sessions(id) on delete cascade,
  round         int not null,
  persona       text not null,
  question      text not null,
  answer        text not null default '',
  score         int check (score between 1 and 5),
  comment       text,
  weakness_flag boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (session_id, round)
);
create index qa_session_idx on public.qa_records (session_id, round);
```

### 4.5 weakness_items

```sql
create table public.weakness_items (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null references auth.users(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  description     text not null,
  severity        text not null check (severity in ('high','mid','low')),
  status          text not null default 'open'
                  check (status in ('open','confirmed','closed','invalid')),
  created_session uuid not null,
  closed_session  uuid,
  created_at      timestamptz not null default now()
);
create index weakness_team_idx on public.weakness_items (team_id, status);
```

### 4.6 team_shares（教师共享，教师端扩展可后置启用）

```sql
create table public.team_shares (
  team_id    uuid not null references public.teams(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (team_id, teacher_id)
);
```

### 4.7 行级安全（RLS）

```sql
alter table public.profiles       enable row level security;
alter table public.teams          enable row level security;
alter table public.sessions       enable row level security;
alter table public.qa_records     enable row level security;
alter table public.weakness_items enable row level security;
alter table public.team_shares    enable row level security;

create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy teams_owner_all on public.teams
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy teams_teacher_read on public.teams
  for select using (
    exists (select 1 from public.team_shares s
            where s.team_id = id and s.teacher_id = auth.uid())
  );

create policy sessions_owner_all on public.sessions
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy sessions_teacher_read on public.sessions
  for select using (
    exists (select 1 from public.team_shares s
            where s.team_id = team_id and s.teacher_id = auth.uid())
  );

create policy qa_owner_all on public.qa_records
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy qa_teacher_read on public.qa_records
  for select using (
    exists (select 1 from public.team_shares s
            join public.sessions t on t.id = qa_records.session_id
            where s.team_id = t.team_id and s.teacher_id = auth.uid())
  );

create policy weakness_owner_all on public.weakness_items
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy weakness_teacher_read on public.weakness_items
  for select using (
    exists (select 1 from public.team_shares s
            where s.team_id = team_id and s.teacher_id = auth.uid())
  );

create policy shares_owner_all on public.team_shares
  for all using (
    exists (select 1 from public.teams t
            where t.id = team_id and t.owner = auth.uid())
  ) with check (
    exists (select 1 from public.teams t
            where t.id = team_id and t.owner = auth.uid())
  );
create policy shares_teacher_read on public.team_shares
  for select using (teacher_id = auth.uid());
```

## 五、与现有模型的字段映射

| localStorage | Supabase | 说明 |
| --- | --- | --- |
| `team_id`（string） | `teams.id`（uuid） | 迁移时重新生成 |
| `session_id`（string） | `sessions.id`（uuid） | 同上 |
| `record_id`（string） | `qa_records.id`（uuid） | 用 `(session_id, round)` 保证唯一 |
| `item_id`（string） | `weakness_items.id`（uuid） | 同上 |
| `diagnosis` / `review` / `dimension_scores` 对象 | jsonb 列 | 结构由 `lib/types.ts` 校验 |
| 状态/枚举字符串 | check 约束 | 与 `lib/types.ts` 枚举一致 |

## 六、数据访问层（`lib/db.ts`，与 `lib/store.ts` 同构）

```ts
// 仓储接口（异步化），页面代码从「同步读 localStorage」改为「await 仓储」
export const teamRepo = {
  list(): Promise<Team[]>;
  ensure(name: string): Promise<Team>;      // 同名复用
  remove(id: string): Promise<void>;        // FK 级联，无需手动清三表
};

export const sessionRepo = {
  list(): Promise<Session[]>;               // created_at desc
  get(id: string): Promise<Session | null>;
  create(s: SessionInsert): Promise<Session>;
  update(id: string, patch: Partial<Session>): Promise<void>;
  remove(id: string): Promise<void>;
};

export const qaRepo = {
  listBySession(sessionId: string): Promise<QARecord[]>;
  add(r: QARecordInsert): Promise<QARecord>;
  update(id: string, patch: Partial<QARecord>): Promise<void>;
};

export const weaknessRepo = {
  listByTeam(teamId: string): Promise<WeaknessItem[]>;
  add(w: WeaknessInsert): Promise<WeaknessItem>;
  update(id: string, patch: Partial<WeaknessItem>): Promise<void>;
  stats(teamId: string): Promise<{ total: number; closed: number; rate: number }>;
};
```

实现要点：

- `createClient` 用 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`；RLS 兜底，前端永远不碰 Service Key。
- `stats` 可改为一次 SQL 聚合（`count` + 过滤 status）或直接在客户端计算，量小无所谓。
- 删除依赖外键 `on delete cascade`，不再需要手动清三张关联表。

## 七、页面改造点清单

| 页面/文件 | 改动 |
| --- | --- |
| `app/layout.tsx` | 接入 Auth 状态；页头显示登录态与用户菜单 |
| `lib/session-context.tsx`（新增） | `useAuth()`：当前用户、登录/登出 |
| `app/auth/page.tsx`（新增） | 登录/注册页（邮箱 + 密码） |
| `app/new/page.tsx` | `teamTable.create` → `teamRepo.ensure`；session 创建改异步；等待态文案不变 |
| `app/report/[id]/page.tsx` | 读取改 `sessionRepo.get`；加载态 |
| `app/practice/[id]/page.tsx` | 问答写入/评分回写改异步；`asked` 历史从仓储取 |
| `app/review/[id]/page.tsx` | 复盘保存、漏洞确认、上场闭环改异步；prev 对比分查询改 SQL |
| `app/archive/page.tsx` | 团队/场次/漏洞列表与统计改异步；删除去 confirm 改自绘确认（可选） |
| `components/site-nav.tsx` | 加「登录/我的」入口（可选） |
| `lib/store.ts` | 保留，作为未登录本地模式与迁移数据源 |

**接口层不变**：`/api/diagnose|judge|review` 仍由服务端调模型，前端拿到结果后写 Supabase。

## 八、迁移方案（localStorage → Supabase）

1. 用户首次登录后，检测 `localStorage` 四张表非空，弹「导入本地训练数据」引导。
2. 导入顺序：teams → sessions（重建 uuid，保留 created_at/status/报告 JSON）→ qa_records（按 session 映射）→ weakness_items（重建 team/session 引用）。
3. 幂等：同一本地 session 只导入一次（导入时在 localStorage 记录 `migrated_to` 映射）。
4. 导入完成后保留本地数据不清除（回退保险），UI 提示「已上云」。
5. 未导入就删除浏览器数据的风险：引导用户先跑 `demo/备份-导出.js`。

## 九、教师端（第二阶段）

- 学生在团队详情页生成「邀请码 / 链接」→ 写入 `team_shares`。
- 教师端视图：被共享团队列表、每队得分曲线、漏洞热点聚合（按 description 去重统计出现次数）、闭环率排行。
- 全部查询经 RLS 只读；写操作仍归学生本人。
- 可选 Realtime：陪练进行中教师端实时看逐题评分（后置）。

## 十、安全与合规

- **RLS 强制**：所有业务表不开匿名读；教师读权限仅经 `team_shares`。
- **Key 分层**：`NEXT_PUBLIC_SUPABASE_*` 可公开；`SUPABASE_SERVICE_ROLE_KEY` 与 `DEEPSEEK_API_KEY` 只在服务端，绝不进前端代码/仓库。
- **隐私口径必须同步修改**：报名表与页脚现写「数据仅存于本机浏览器」——上云后改为「训练数据存储于 Supabase 云数据库（账号隔离），可随时导出与删除；BP 文本会发送至模型 API 用于生成，不做留存」。这是对参赛材料的实质性口径变化，需同步更新作品简介与演示讲解词。
- **删除权**：提供「删除账号数据」入口（按 owner 级联删除）。
- **备份**：免费层无自动备份，定期 `pg_dump` 或 Supabase Dashboard 手动备份；付费层含每日备份。

## 十一、成本估算

| 资源 | 免费层 | 本项目占用 | 结论 |
| --- | --- | --- | --- |
| 数据库 | 500 MB | 每场训练约几 KB～几十 KB（BP 文本为主） | 校内试点足够 |
| Auth 月活 | 50,000 | 个位数～百级 | 足够 |
| 带宽/存储 | 各 5 GB / 1 GB | 低 | 足够 |
| 升级档 | Pro $25/月 | 需要自动备份/更高配额时再升 | 后置 |

## 十二、实施步骤（建议节奏）

| 阶段 | 内容 | 工作量 |
| --- | --- | --- |
| P0 建库 | 创建 Supabase 项目 → 执行第四节 SQL → 开邮箱注册 → 配环境变量 | 0.5 天 |
| P1 数据层 | `npm i @supabase/supabase-js`；写 `lib/db.ts` 五个仓储 + `useAuth`；登录页 | 1–1.5 天 |
| P2 页面接入 | 按第七节清单改造 6 个页面 + 登录态分流（未登录走本地） | 1–2 天 |
| P3 迁移与兜底 | 本地数据导入引导；演示模式与备份脚本回归验证 | 0.5 天 |
| P4 教师端 | team_shares 邀请流程 + 教师视图 | 1–2 天（可后置） |

**环境变量**（`.env.local` / 部署平台）：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...（可公开）
SUPABASE_SERVICE_ROLE_KEY=eyJ...（仅服务端，默认不用）
DEEPSEEK_API_KEY=sk-...（沿用）
```

## 十三、风险与回退

| 风险 | 缓解 |
| --- | --- |
| 现场断网 | 未登录/离线自动落回本地模式；预生成数据 + 备份 JSON 兜底 |
| RLS 配错导致越权 | 上线前用两个测试账号互查；Supabase 日志审计 |
| 迁移重复/丢数据 | 导入幂等（`migrated_to` 映射）；导入前强制本地备份 |
| 隐私口径与参赛材料冲突 | 见第十节：文案与材料同步更新 |
| 免费层配额 | 监控用量；BP 文本截断存储；超限再升级 |

## 十四、交付物清单（实施后）

- `docs/supabase-数据系统方案.md`（本文件）
- `supabase/migrations/0001_init.sql`（第四节 SQL 落盘）
- `lib/supabase.ts`、`lib/db.ts`、`lib/session-context.tsx`
- `app/auth/page.tsx` 登录页 + 页头用户菜单
- 六个页面接入异步仓储 + 本地数据导入引导
