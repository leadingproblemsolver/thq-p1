-- ============================================================================
-- Decision Kill-Switch — Unified Supabase Schema (single source of truth)
-- ============================================================================
-- Aligns with product.md spec:
--   - 1 free decision per anon session, then auth gate
--   - Strict 5-line verdict contract (verdict, biggest_risk, what_breaks,
--     do_this_now, confidence)
--   - Full event logging for KPI computation
--   - SQL-driven KPIs (no app-side aggregation)
--   - User profiles + roles (security best-practice; roles in separate table)
--
-- Deploy order: enums → tables → indexes → RLS → functions → views.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verdict_type as enum ('Proceed', 'Pause', 'Kill');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.input_type as enum ('decision', 'claim', 'deal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outcome_result as enum ('success', 'failure', 'mixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_type as enum (
    'decision_submitted',
    'verdict_generated',
    'auth_required',
    'user_logged_in',
    'user_acted',
    'outcome_logged',
    'feedback_submitted'
  );
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 profiles (1:1 with auth.users; minimal user-facing data)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 user_roles (NEVER store roles on profiles — privilege escalation risk)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- 3.3 sessions (anon-first; linked to user on signup)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  anon_session_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  utm_source text,
  free_decision_used boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_anon on public.sessions(anon_session_id);

-- 3.4 decisions (strict 5-line verdict storage)
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  input_text text not null check (char_length(input_text) between 1 and 4000),
  input_type public.input_type not null default 'decision',
  -- 5-line contract (lines 2-5; line 1 = verdict)
  verdict public.verdict_type not null,
  biggest_risk text not null check (char_length(biggest_risk) between 8 and 240),
  what_breaks text not null check (char_length(what_breaks) between 8 and 240),
  do_this_now text not null check (char_length(do_this_now) between 8 and 240),
  confidence int not null check (confidence between 0 and 100),
  -- meta
  latency_ms int,
  model_version text,
  structure_compliant boolean not null default true,  -- false if quality filter regenerated
  created_at timestamptz not null default now()
);

create index if not exists idx_decisions_session on public.decisions(session_id);
create index if not exists idx_decisions_user on public.decisions(user_id);
create index if not exists idx_decisions_created on public.decisions(created_at desc);

-- 3.5 outcomes (1-click success/failure/mixed)
create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  result public.outcome_result not null,
  note text,
  created_at timestamptz not null default now(),
  unique (decision_id)
);

create index if not exists idx_outcomes_decision on public.outcomes(decision_id);

-- 3.6 events (mandatory tracking layer for KPI engine)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type public.event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_type_created on public.events(event_type, created_at desc);
create index if not exists idx_events_session on public.events(session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SECURITY DEFINER ROLE FUNCTION (avoids recursive RLS)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.user_roles  enable row level security;
alter table public.sessions    enable row level security;
alter table public.decisions   enable row level security;
alter table public.outcomes    enable row level security;
alter table public.events      enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = id);

drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists decisions_own on public.decisions;
create policy decisions_own on public.decisions
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists outcomes_own on public.outcomes;
create policy outcomes_own on public.outcomes
  for all to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id);

drop policy if exists events_admin_read on public.events;
create policy events_admin_read on public.events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: link anon session to authenticated user
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.link_anon_session(
  _anon_session_id text,
  _user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _session_id uuid;
begin
  update public.sessions
     set user_id = _user_id, last_seen_at = now()
   where anon_session_id = _anon_session_id
   returning id into _session_id;

  update public.decisions set user_id = _user_id where session_id = _session_id and user_id is null;
  update public.outcomes  set user_id = _user_id where session_id = _session_id and user_id is null;
  update public.events    set user_id = _user_id where session_id = _session_id and user_id is null;

  return _session_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. KPI VIEWS (per product.md §9 + spec §"KPI ENGINE")
-- ─────────────────────────────────────────────────────────────────────────────

-- 8.1 daily_metrics
create or replace view public.daily_metrics as
select
  date_trunc('day', d.created_at)::date as day,
  count(*)                              as decisions_today,
  count(distinct d.session_id)          as unique_sessions_today,
  round(
    100.0 * count(distinct d.session_id) / nullif(count(distinct s.id), 0)
  , 2) as activation_rate
from public.decisions d
left join public.sessions s on s.id = d.session_id
group by 1
order by 1 desc;

-- 8.2 conversion_metrics (free → authed)
create or replace view public.conversion_metrics as
with totals as (
  select
    count(*) filter (where free_decision_used)                          as free_used,
    count(*) filter (where free_decision_used and user_id is not null) as converted
  from public.sessions
)
select
  free_used,
  converted,
  round(100.0 * converted / nullif(free_used, 0), 2) as free_to_auth_conversion_rate
from totals;

-- 8.3 retention_metrics (24h + 72h return)
create or replace view public.retention_metrics as
with first_seen as (
  select session_id, min(created_at) as t0
  from public.decisions group by session_id
),
returns as (
  select fs.session_id,
         max(case when d.created_at between fs.t0 + interval '1 hour'  and fs.t0 + interval '24 hours' then 1 else 0 end) as r24,
         max(case when d.created_at between fs.t0 + interval '24 hours' and fs.t0 + interval '72 hours' then 1 else 0 end) as r72
  from first_seen fs
  join public.decisions d on d.session_id = fs.session_id
  group by fs.session_id
)
select
  count(*)                                         as cohort,
  round(100.0 * sum(r24) / nullif(count(*), 0), 2) as return_rate_24h,
  round(100.0 * sum(r72) / nullif(count(*), 0), 2) as return_rate_72h
from returns;

-- 8.4 performance_metrics
create or replace view public.performance_metrics as
select
  round(avg(d.latency_ms) / 1000.0, 2)                                 as avg_time_to_clarity_seconds,
  round(100.0 * count(o.id) / nullif(count(d.id), 0), 2)               as outcome_logging_rate,
  round(100.0 *
    count(*) filter (where o.result = 'success' and d.verdict = 'Proceed')
    / nullif(count(*) filter (where d.verdict = 'Proceed'), 0)
  , 2)                                                                  as prediction_accuracy,
  round(100.0 * sum(case when d.structure_compliant then 1 else 0 end) / nullif(count(*), 0), 2)
                                                                         as structure_compliance_rate
from public.decisions d
left join public.outcomes o on o.decision_id = d.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_activation_rate()
returns numeric language sql stable security definer set search_path = public as $$
  select activation_rate from public.daily_metrics order by day desc limit 1;
$$;

create or replace function public.get_return_rate(_window text default '24h')
returns numeric language sql stable security definer set search_path = public as $$
  select case when _window = '72h' then return_rate_72h else return_rate_24h end
  from public.retention_metrics;
$$;

create or replace function public.get_structure_compliance()
returns numeric language sql stable security definer set search_path = public as $$
  select structure_compliance_rate from public.performance_metrics;
$$;

-- END
