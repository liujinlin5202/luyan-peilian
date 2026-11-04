-- 赛前模拟舱 · Supabase 初始化（0001_init.sql）
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行
-- 说明：owner 列默认 auth.uid()，客户端插入无需显式指定；所有表强制 RLS。

-- ============ 0. profiles（扩展 auth.users） ============
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

-- ============ 1. teams ============
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (owner, name)
);

-- ============ 2. sessions ============
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

-- ============ 3. qa_records ============
create table public.qa_records (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

-- ============ 4. weakness_items ============
create table public.weakness_items (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

-- ============ 5. team_shares（教师共享，教师端扩展） ============
create table public.team_shares (
  team_id    uuid not null references public.teams(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (team_id, teacher_id)
);

-- ============ 6. RLS ============
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
