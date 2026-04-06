-- ============================================================
-- Kill-Switch: Unified Supabase Schema
-- Version: 1.0.0
-- Description: Complete database layer for decision logging,
--              user authentication profiles, analytics, and
--              feedback tracking.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 2. ENUMS
-- ────────────────────────────────────────────────────────────
create type public.verdict_type   as enum ('Proceed', 'Pause', 'Kill');
create type public.input_type     as enum ('decision', 'claim', 'deal');
create type public.app_role       as enum ('admin', 'user');

-- ────────────────────────────────────────────────────────────
-- 3. PROFILES (auto-created on auth.users insert)
--    Stores display info; roles are in a separate table.
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 4. USER ROLES (separate table — prevents privilege escalation)
-- ────────────────────────────────────────────────────────────
create table public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security-definer helper (avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role app_role)
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

create policy "Users can read own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can manage all roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ────────────────────────────────────────────────────────────
-- 5. DECISIONS (core table — every kill-switch run)
-- ────────────────────────────────────────────────────────────
create table public.decisions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  -- Input
  raw_input       text not null,
  input_type      input_type not null,
  -- Verdict (5-line output from LLM)
  verdict         verdict_type not null,
  confidence      smallint not null check (confidence between 0 and 100),
  biggest_risk    text not null,
  what_breaks     text not null,
  action_lock     text not null,
  -- Performance
  latency_ms      integer not null default 0,
  model_version   text,                          -- e.g. "gemini-2.0-flash"
  -- Feedback
  feedback_text   text,
  feedback_at     timestamptz,
  -- Metadata
  session_id      uuid,                          -- client-generated per browser session
  ip_hash         text,                          -- SHA-256 of IP for analytics, not PII
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- Indexes for analytics queries
create index idx_decisions_user      on public.decisions (user_id, created_at desc);
create index idx_decisions_verdict   on public.decisions (verdict, created_at desc);
create index idx_decisions_session   on public.decisions (session_id);
create index idx_decisions_created   on public.decisions (created_at desc);

alter table public.decisions enable row level security;

-- Authenticated users see only their own decisions
create policy "Users can read own decisions"
  on public.decisions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own decisions"
  on public.decisions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own decisions (feedback only)"
  on public.decisions for update
  to authenticated
  using (auth.uid() = user_id);

-- Anonymous users can insert (unlinked, for try-before-signup)
create policy "Anon can insert decisions"
  on public.decisions for insert
  to anon
  with check (user_id is null);

-- Admins can read all decisions (for metrics dashboard)
create policy "Admins can read all decisions"
  on public.decisions for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ────────────────────────────────────────────────────────────
-- 6. DECISION ANALYTICS (materialized view for fast dashboards)
-- ────────────────────────────────────────────────────────────
-- Daily aggregates by verdict type
create materialized view public.decision_stats_daily as
select
  date_trunc('day', created_at)::date as day,
  verdict,
  count(*)                             as total,
  round(avg(confidence), 1)            as avg_confidence,
  round(avg(latency_ms), 0)            as avg_latency_ms,
  count(feedback_text) filter (where feedback_text is not null) as feedback_count
from public.decisions
group by 1, 2
order by 1 desc, 2;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
create unique index idx_stats_daily_pk on public.decision_stats_daily (day, verdict);

-- ────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Return rate: % of users who ran > 1 decision
create or replace function public.get_return_rate()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    round(
      100.0 * count(*) filter (where cnt > 1) / nullif(count(*), 0),
      1
    ), 0
  )
  from (
    select user_id, count(*) as cnt
    from public.decisions
    where user_id is not null
    group by user_id
  ) sub
$$;

-- Activation rate: % of decisions that received feedback
create or replace function public.get_activation_rate()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    round(
      100.0 * count(*) filter (where feedback_text is not null)
            / nullif(count(*), 0),
      1
    ), 0
  )
  from public.decisions
$$;

-- Structure compliance: % of verdicts with all 5 fields populated
create or replace function public.get_structure_compliance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    round(
      100.0 * count(*) filter (
        where biggest_risk is not null
          and what_breaks is not null
          and action_lock is not null
          and verdict is not null
          and confidence is not null
      ) / nullif(count(*), 0),
      1
    ), 0
  )
  from public.decisions
$$;

-- ────────────────────────────────────────────────────────────
-- 8. UPDATED_AT TRIGGER (generic)
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
