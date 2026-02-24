-- Messaging schema for iSkul (threads + messages + RLS)
-- Safe to re-run; uses IF NOT EXISTS where possible.

create extension if not exists "pgcrypto";

-- Helper: keep updated_at / updated_at_ms in sync on UPDATE
create or replace function public.touch_updated_at_ms()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_at_ms = (extract(epoch from new.updated_at) * 1000)::bigint;
  return new;
end;
$$ language plpgsql;

/* -------------------------------------------------------------------------- */
/* Threads                                                                    */
/* -------------------------------------------------------------------------- */
create table if not exists public.chat_threads (
  id text primary key default gen_random_uuid()::text,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  teacher_name text,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text,
  participants uuid[] not null,
  course_id text references public.courses(id) on delete set null,
  course_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  last_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  last_from_id uuid references auth.users(id) on delete set null,
  last_text text,
  last_read_at_ms jsonb not null default '{}'::jsonb
);

create index if not exists chat_threads_participants_idx on public.chat_threads using gin (participants);
create index if not exists chat_threads_last_at_ms_idx on public.chat_threads (last_at_ms desc);

drop trigger if exists chat_threads_touch_updated_at on public.chat_threads;
create trigger chat_threads_touch_updated_at
before update on public.chat_threads
for each row execute function public.touch_updated_at_ms();

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */
create table if not exists public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references public.chat_threads(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade,
  text text,
  attachments jsonb,
  created_at timestamptz not null default now(),
  at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  edited_at_ms bigint
);

create index if not exists chat_messages_thread_id_idx on public.chat_messages (thread_id, at_ms);
create index if not exists chat_messages_from_id_idx on public.chat_messages (from_id, at_ms desc);

/* -------------------------------------------------------------------------- */
/* Row Level Security                                                         */
/* -------------------------------------------------------------------------- */
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Threads policies
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'chat_threads_select') then
    create policy chat_threads_select on public.chat_threads
      for select using (auth.uid() = any(participants));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_threads_insert') then
    create policy chat_threads_insert on public.chat_threads
      for insert with check (
        auth.uid() = any(participants)
        and (auth.uid() = teacher_id or auth.uid() = student_id)
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_threads_update') then
    create policy chat_threads_update on public.chat_threads
      for update using (auth.uid() = any(participants))
      with check (auth.uid() = any(participants));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_threads_delete') then
    create policy chat_threads_delete on public.chat_threads
      for delete using (auth.uid() = any(participants));
  end if;
end $$;

-- Messages policies
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'chat_messages_select') then
    create policy chat_messages_select on public.chat_messages
      for select using (
        exists (
          select 1 from public.chat_threads t
          where t.id = thread_id and auth.uid() = any(t.participants)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_messages_insert') then
    create policy chat_messages_insert on public.chat_messages
      for insert with check (
        from_id = auth.uid()
        and exists (
          select 1 from public.chat_threads t
          where t.id = thread_id and auth.uid() = any(t.participants)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_messages_update') then
    create policy chat_messages_update on public.chat_messages
      for update using (from_id = auth.uid())
      with check (from_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_messages_delete') then
    create policy chat_messages_delete on public.chat_messages
      for delete using (from_id = auth.uid());
  end if;
end $$;
