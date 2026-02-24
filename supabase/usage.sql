-- Usage tracking for parental insights (daily aggregates)
-- Safe to re-run.

create extension if not exists "pgcrypto";

create or replace function public.touch_usage_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_at_ms = (extract(epoch from new.updated_at) * 1000)::bigint;
  return new;
end;
$$ language plpgsql;

create table if not exists public.student_usage_daily (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  time_spent_ms bigint not null default 0,
  courses_viewed integer not null default 0,
  lessons_viewed integer not null default 0,
  documents_opened integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, day)
);

create index if not exists student_usage_user_day_idx on public.student_usage_daily (user_id, day desc);

drop trigger if exists student_usage_touch_updated_at on public.student_usage_daily;
create trigger student_usage_touch_updated_at
before update on public.student_usage_daily
for each row execute function public.touch_usage_updated_at();

alter table public.student_usage_daily enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'student_usage_select') then
    create policy student_usage_select on public.student_usage_daily
      for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'student_usage_insert') then
    create policy student_usage_insert on public.student_usage_daily
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'student_usage_update') then
    create policy student_usage_update on public.student_usage_daily
      for update using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
