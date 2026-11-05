-- Student Assistant — initial schema (Phase 2 of the Supabase migration plan)
--
-- Mirrors the shapes already defined in the app, field for field:
--   src/lib/scheduling/types.ts            -> courses, tasks, scheduled_blocks, availability_blocks
--   src/lib/scheduling/availabilityRules.ts -> availability_rules, fixed_commitments, unavailable_periods
--   src/state/app-state.tsx                -> recurring_study_goals
--   src/state/content-state.tsx            -> documents, profiles, notification_prefs
--
-- Every table carries a user_id tied to auth.users and a matching row-level
-- security policy — one account can never read or write another's rows.
-- user_id defaults to auth.uid(), so the client never has to pass it on
-- insert — it's filled in from the request's own JWT automatically.
-- IDs move from the app's own `task-${Date.now()}` strings to real Postgres
-- uuids (gen_random_uuid()); the client-side id generation goes away once
-- Phase 3 (the data-layer migration) wires these tables in.
--
-- documents.storage_path is nullable for now — it's populated once Phase 4
-- (Supabase Storage) replaces the local data: URI/file-copy approach.
--
-- Run this once, in order, against a fresh project (SQL Editor, or
-- `supabase db push` if you're using the CLI). Safe to re-run: every
-- statement is idempotent (IF NOT EXISTS / OR REPLACE).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color_tag text,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "courses_select_own" on public.courses;
create policy "courses_select_own" on public.courses for select using (auth.uid() = user_id);
drop policy if exists "courses_insert_own" on public.courses;
create policy "courses_insert_own" on public.courses for insert with check (auth.uid() = user_id);
drop policy if exists "courses_update_own" on public.courses;
create policy "courses_update_own" on public.courses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_delete_own" on public.courses;
create policy "courses_delete_own" on public.courses for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recurring_study_goals — created before `tasks` since tasks.recurring_goal_id
-- references it (a generated instance points back at the goal that made it).
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  task_type text not null check (task_type in ('exam_prep', 'graded_assignment', 'reading', 'other')),
  daily_minutes integer not null check (daily_minutes > 0),
  start_date date not null,
  end_date date not null,
  weekdays integer[] not null default '{}', -- 0 Sun .. 6 Sat
  -- Every date ever generated for this goal, kept even after the task for
  -- that date is deleted — see tasks.recurring_goal_id's doc comment below
  -- and RecurringStudyGoal.generatedDates in app-state.tsx.
  generated_dates date[] not null default '{}',
  constraint recurring_study_goals_date_range check (end_date >= start_date)
);

alter table public.recurring_study_goals enable row level security;

drop policy if exists "recurring_study_goals_select_own" on public.recurring_study_goals;
create policy "recurring_study_goals_select_own" on public.recurring_study_goals for select using (auth.uid() = user_id);
drop policy if exists "recurring_study_goals_insert_own" on public.recurring_study_goals;
create policy "recurring_study_goals_insert_own" on public.recurring_study_goals for insert with check (auth.uid() = user_id);
drop policy if exists "recurring_study_goals_update_own" on public.recurring_study_goals;
create policy "recurring_study_goals_update_own" on public.recurring_study_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recurring_study_goals_delete_own" on public.recurring_study_goals;
create policy "recurring_study_goals_delete_own" on public.recurring_study_goals for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  task_type text not null check (task_type in ('exam_prep', 'graded_assignment', 'reading', 'other')),
  due_date timestamptz not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  status text not null check (status in ('pending', 'scheduled', 'completed', 'missed')) default 'pending',
  -- Task.dependsOn — ids of tasks that must be done first. Kept as a flat
  -- array (no junction table) to match the app's existing in-memory shape.
  depends_on uuid[] not null default '{}',
  -- Set only for a task generated by a recurring_study_goal — lets the
  -- client find "my instances" without re-deriving dates, and is how
  -- cancelRecurringStudyGoal finds what to remove (see that table below).
  recurring_goal_id uuid references public.recurring_study_goals (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_course_id_idx on public.tasks (course_id);

-- ---------------------------------------------------------------------------
-- scheduled_blocks
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  start timestamptz not null,
  "end" timestamptz not null
);

alter table public.scheduled_blocks enable row level security;

drop policy if exists "scheduled_blocks_select_own" on public.scheduled_blocks;
create policy "scheduled_blocks_select_own" on public.scheduled_blocks for select using (auth.uid() = user_id);
drop policy if exists "scheduled_blocks_insert_own" on public.scheduled_blocks;
create policy "scheduled_blocks_insert_own" on public.scheduled_blocks for insert with check (auth.uid() = user_id);
drop policy if exists "scheduled_blocks_update_own" on public.scheduled_blocks;
create policy "scheduled_blocks_update_own" on public.scheduled_blocks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "scheduled_blocks_delete_own" on public.scheduled_blocks;
create policy "scheduled_blocks_delete_own" on public.scheduled_blocks for delete using (auth.uid() = user_id);

create index if not exists scheduled_blocks_user_id_idx on public.scheduled_blocks (user_id);
create index if not exists scheduled_blocks_task_id_idx on public.scheduled_blocks (task_id);

-- ---------------------------------------------------------------------------
-- availability_blocks — Category 4, one-time extra availability
-- ---------------------------------------------------------------------------
create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start timestamptz not null,
  "end" timestamptz not null,
  label text
);

alter table public.availability_blocks enable row level security;

drop policy if exists "availability_blocks_select_own" on public.availability_blocks;
create policy "availability_blocks_select_own" on public.availability_blocks for select using (auth.uid() = user_id);
drop policy if exists "availability_blocks_insert_own" on public.availability_blocks;
create policy "availability_blocks_insert_own" on public.availability_blocks for insert with check (auth.uid() = user_id);
drop policy if exists "availability_blocks_update_own" on public.availability_blocks;
create policy "availability_blocks_update_own" on public.availability_blocks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "availability_blocks_delete_own" on public.availability_blocks;
create policy "availability_blocks_delete_own" on public.availability_blocks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- availability_rules — Category 1, weekly recurring
-- ---------------------------------------------------------------------------
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6), -- 0 Sun .. 6 Sat, matches Date.getDay()
  start_time text not null, -- "HH:mm"
  end_time text not null,
  label text
);

alter table public.availability_rules enable row level security;

drop policy if exists "availability_rules_select_own" on public.availability_rules;
create policy "availability_rules_select_own" on public.availability_rules for select using (auth.uid() = user_id);
drop policy if exists "availability_rules_insert_own" on public.availability_rules;
create policy "availability_rules_insert_own" on public.availability_rules for insert with check (auth.uid() = user_id);
drop policy if exists "availability_rules_update_own" on public.availability_rules;
create policy "availability_rules_update_own" on public.availability_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "availability_rules_delete_own" on public.availability_rules;
create policy "availability_rules_delete_own" on public.availability_rules for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- fixed_commitments — Category 2, discriminated union (recurring | one-time)
-- ---------------------------------------------------------------------------
create table if not exists public.fixed_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('recurring', 'one-time')),
  weekday integer check (weekday between 0 and 6), -- set when kind = 'recurring'
  date date,                                       -- set when kind = 'one-time'
  start_time text not null,
  end_time text not null,
  label text,
  constraint fixed_commitments_kind_fields check (
    (kind = 'recurring' and weekday is not null and date is null) or
    (kind = 'one-time' and date is not null and weekday is null)
  )
);

alter table public.fixed_commitments enable row level security;

drop policy if exists "fixed_commitments_select_own" on public.fixed_commitments;
create policy "fixed_commitments_select_own" on public.fixed_commitments for select using (auth.uid() = user_id);
drop policy if exists "fixed_commitments_insert_own" on public.fixed_commitments;
create policy "fixed_commitments_insert_own" on public.fixed_commitments for insert with check (auth.uid() = user_id);
drop policy if exists "fixed_commitments_update_own" on public.fixed_commitments;
create policy "fixed_commitments_update_own" on public.fixed_commitments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "fixed_commitments_delete_own" on public.fixed_commitments;
create policy "fixed_commitments_delete_own" on public.fixed_commitments for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- unavailable_periods — Category 3
-- ---------------------------------------------------------------------------
create table if not exists public.unavailable_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start timestamptz not null,
  "end" timestamptz not null,
  label text
);

alter table public.unavailable_periods enable row level security;

drop policy if exists "unavailable_periods_select_own" on public.unavailable_periods;
create policy "unavailable_periods_select_own" on public.unavailable_periods for select using (auth.uid() = user_id);
drop policy if exists "unavailable_periods_insert_own" on public.unavailable_periods;
create policy "unavailable_periods_insert_own" on public.unavailable_periods for insert with check (auth.uid() = user_id);
drop policy if exists "unavailable_periods_update_own" on public.unavailable_periods;
create policy "unavailable_periods_update_own" on public.unavailable_periods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "unavailable_periods_delete_own" on public.unavailable_periods;
create policy "unavailable_periods_delete_own" on public.unavailable_periods for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  -- Populated once Phase 4 wires in Supabase Storage. Null until then.
  storage_path text
);

alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = user_id);
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents for delete using (auth.uid() = user_id);

create index if not exists documents_course_id_idx on public.documents (course_id);

-- ---------------------------------------------------------------------------
-- profiles — one row per user, created automatically on sign-up (see trigger below)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  school text,
  major text,
  academic_year text check (academic_year in ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate')),
  bio text,
  -- 'system' | 'light' | 'dark' — device-appearance override. Synced here
  -- (rather than left purely local) so it follows the account across devices.
  theme_preference text not null default 'system' check (theme_preference in ('system', 'light', 'dark'))
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No insert/delete policy: rows are created by the trigger below and
-- removed automatically via the auth.users cascade — the client never
-- creates or deletes its own profile row directly.

-- ---------------------------------------------------------------------------
-- notification_prefs — one row per user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  deadline_reminders boolean not null default true,
  daily_plan_summary boolean not null default false
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs_select_own" on public.notification_prefs;
create policy "notification_prefs_select_own" on public.notification_prefs for select using (auth.uid() = user_id);
drop policy if exists "notification_prefs_update_own" on public.notification_prefs;
create policy "notification_prefs_update_own" on public.notification_prefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-create profiles + notification_prefs the moment someone signs up —
-- the client never has to remember to do this as a separate step after
-- magic-link auth completes.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email) values (new.id, coalesce(new.email, ''));
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
