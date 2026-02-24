-- Supabase schema for iSkul (SDK 54 app)
-- Tables + RLS policies for core entities.

create extension if not exists "pgcrypto";

-- Helper: keep updated_at / updated_at_ms in sync on UPDATE
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.touch_updated_at_ms()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_at_ms = (extract(epoch from new.updated_at) * 1000)::bigint;
  return new;
end;
$$ language plpgsql;

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text,
  name text,
  avatar_url text,
  bio text,
  email text,
  phone text,
  school text,
  grade text,
  subjects text[],
  expo_push_tokens text[],
  last_seen_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at_ms();

-- Courses
create table if not exists public.courses (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  level text not null,
  subject text not null,
  cover_url text,
  published boolean not null default false,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists courses_owner_id_idx on public.courses (owner_id);
create index if not exists courses_published_idx on public.courses (published);
create index if not exists courses_updated_at_ms_idx on public.courses (updated_at_ms desc);

create trigger courses_touch_updated_at
before update on public.courses
for each row execute function public.touch_updated_at_ms();

-- Chapters (per course)
create table if not exists public.chapters (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  order_index integer not null default 1,
  video_url text,
  video_by_lang jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists chapters_course_id_idx on public.chapters (course_id);
create index if not exists chapters_order_idx on public.chapters (course_id, order_index);

create trigger chapters_touch_updated_at
before update on public.chapters
for each row execute function public.touch_updated_at_ms();

-- Live sessions
create table if not exists public.lives (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  start_at_ms bigint not null,
  streaming_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists lives_owner_id_idx on public.lives (owner_id);
create index if not exists lives_start_at_ms_idx on public.lives (start_at_ms);

create trigger lives_touch_updated_at
before update on public.lives
for each row execute function public.touch_updated_at_ms();

-- Library books
create table if not exists public.books (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subject text,
  level text,
  price numeric(10,2) not null default 0,
  cover_url text,
  file_url text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists books_owner_id_idx on public.books (owner_id);
create index if not exists books_published_idx on public.books (published);
create index if not exists books_updated_at_ms_idx on public.books (updated_at_ms desc);

create trigger books_touch_updated_at
before update on public.books
for each row execute function public.touch_updated_at_ms();

-- Purchases
create table if not exists public.purchases (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, book_id)
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);

-- Lesson progress
create table if not exists public.lesson_progress (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  chapter_id text not null references public.chapters(id) on delete cascade,
  watched_sec integer not null default 0,
  duration_sec integer,
  updated_at timestamptz not null default now(),
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, course_id, chapter_id)
);

create index if not exists lesson_progress_user_id_idx on public.lesson_progress (user_id);
create index if not exists lesson_progress_updated_at_ms_idx on public.lesson_progress (updated_at_ms desc);

create trigger lesson_progress_touch_updated_at
before update on public.lesson_progress
for each row execute function public.touch_updated_at_ms();

-- Lesson notes
create table if not exists public.lesson_notes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  chapter_id text not null references public.chapters(id) on delete cascade,
  t_sec integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists lesson_notes_lookup_idx on public.lesson_notes (user_id, course_id, chapter_id, created_at_ms);

-- Chat threads (1:1)
create table if not exists public.chat_threads (
  id text primary key default gen_random_uuid()::text,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  teacher_name text,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text,
  participants uuid[] not null,
  course_id text references public.courses(id) on delete set null,
  course_title text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  last_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  last_from_id uuid references auth.users(id) on delete set null,
  last_text text,
  last_read_at_ms jsonb not null default '{}'::jsonb
);

create index if not exists chat_threads_participants_idx on public.chat_threads using gin (participants);
create index if not exists chat_threads_last_at_ms_idx on public.chat_threads (last_at_ms desc);

-- Chat messages
create table if not exists public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references public.chat_threads(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade,
  text text,
  attachments jsonb,
  at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists chat_messages_thread_id_idx on public.chat_messages (thread_id, at_ms);

-- RLS
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lives enable row level security;
alter table public.books enable row level security;
alter table public.purchases enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_notes enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on public.profiles
  for delete using (auth.uid() = id);

-- Courses
create policy courses_select on public.courses
  for select using ((published = true and auth.uid() is not null) or owner_id = auth.uid());
create policy courses_insert on public.courses
  for insert with check (owner_id = auth.uid());
create policy courses_update on public.courses
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy courses_delete on public.courses
  for delete using (owner_id = auth.uid());

-- Chapters
create policy chapters_select on public.chapters
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = course_id
        and ((c.published = true and auth.uid() is not null) or c.owner_id = auth.uid())
    )
  );
create policy chapters_insert on public.chapters
  for insert with check (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.owner_id = auth.uid()
    )
  );
create policy chapters_update on public.chapters
  for update using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.owner_id = auth.uid()
    )
  );
create policy chapters_delete on public.chapters
  for delete using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.owner_id = auth.uid()
    )
  );

-- Lives
create policy lives_select on public.lives
  for select using (auth.uid() is not null);
create policy lives_insert on public.lives
  for insert with check (owner_id = auth.uid());
create policy lives_update on public.lives
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lives_delete on public.lives
  for delete using (owner_id = auth.uid());

-- Books
create policy books_select on public.books
  for select using ((published = true and auth.uid() is not null) or owner_id = auth.uid());
create policy books_insert on public.books
  for insert with check (owner_id = auth.uid());
create policy books_update on public.books
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy books_delete on public.books
  for delete using (owner_id = auth.uid());

-- Purchases
create policy purchases_select on public.purchases
  for select using (user_id = auth.uid());
create policy purchases_insert on public.purchases
  for insert with check (user_id = auth.uid());
create policy purchases_delete on public.purchases
  for delete using (user_id = auth.uid());

-- Lesson progress
create policy lesson_progress_select on public.lesson_progress
  for select using (user_id = auth.uid());
create policy lesson_progress_insert on public.lesson_progress
  for insert with check (user_id = auth.uid());
create policy lesson_progress_update on public.lesson_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lesson_progress_delete on public.lesson_progress
  for delete using (user_id = auth.uid());

-- Lesson notes
create policy lesson_notes_select on public.lesson_notes
  for select using (user_id = auth.uid());
create policy lesson_notes_insert on public.lesson_notes
  for insert with check (user_id = auth.uid());
create policy lesson_notes_update on public.lesson_notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lesson_notes_delete on public.lesson_notes
  for delete using (user_id = auth.uid());

-- Chat threads
create policy chat_threads_select on public.chat_threads
  for select using (auth.uid() = any(participants));
create policy chat_threads_insert on public.chat_threads
  for insert with check (
    auth.uid() = any(participants)
    and (auth.uid() = teacher_id or auth.uid() = student_id)
  );
create policy chat_threads_update on public.chat_threads
  for update using (auth.uid() = any(participants))
  with check (auth.uid() = any(participants));
create policy chat_threads_delete on public.chat_threads
  for delete using (auth.uid() = any(participants));

-- Chat messages
create policy chat_messages_select on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and auth.uid() = any(t.participants)
    )
  );
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and auth.uid() = any(t.participants)
    )
  );
create policy chat_messages_delete on public.chat_messages
  for delete using (from_id = auth.uid());

-- Storage (bucket + policies)
insert into storage.buckets (id, name, public)
values ('iskul', 'iskul', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy storage_public_read on storage.objects
  for select using (bucket_id = 'iskul');
create policy storage_auth_insert on storage.objects
  for insert with check (auth.uid() is not null and bucket_id = 'iskul');
create policy storage_auth_update on storage.objects
  for update using (auth.uid() = owner and bucket_id = 'iskul')
  with check (auth.uid() = owner and bucket_id = 'iskul');
create policy storage_auth_delete on storage.objects
  for delete using (auth.uid() = owner and bucket_id = 'iskul');

-- Quizzes
create table if not exists public.quizzes (
  id text primary key default gen_random_uuid()::text,
  course_id text references public.courses(id) on delete cascade,
  chapter_id text references public.chapters(id) on delete cascade,
  level text,
  subject text,
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (course_id, chapter_id),
  constraint quizzes_scope_shape_chk check (
    (course_id is not null and chapter_id is not null)
    or
    (course_id is null and chapter_id is null)
  ),
  constraint quizzes_standalone_classification_chk check (
    course_id is not null
    or
    (coalesce(trim(level), '') <> '' and coalesce(trim(subject), '') <> '')
  )
);

create index if not exists quizzes_course_id_idx on public.quizzes (course_id);
create index if not exists quizzes_chapter_id_idx on public.quizzes (chapter_id);
create index if not exists quizzes_level_idx on public.quizzes (level);
create index if not exists quizzes_subject_idx on public.quizzes (subject);

create trigger quizzes_touch_updated_at
before update on public.quizzes
for each row execute function public.touch_updated_at_ms();

create table if not exists public.quiz_attempts (
  id text primary key default gen_random_uuid()::text,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  max_score integer not null default 0,
  created_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (quiz_id, user_id)
);

create index if not exists quiz_attempts_quiz_id_idx on public.quiz_attempts (quiz_id);
create index if not exists quiz_attempts_user_id_idx on public.quiz_attempts (user_id);

alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;

create policy quizzes_select on public.quizzes
  for select using (
    (published = true or owner_id = auth.uid())
    and (
      (
        course_id is not null
        and exists (
          select 1 from public.courses c
          where c.id = course_id
            and ((c.published = true and auth.uid() is not null) or c.owner_id = auth.uid())
        )
      )
      or
      (course_id is null and auth.uid() is not null)
    )
  );
create policy quizzes_insert on public.quizzes
  for insert with check (
    owner_id = auth.uid()
    and (
      (
        course_id is not null
        and chapter_id is not null
        and exists (select 1 from public.courses c where c.id = course_id and c.owner_id = auth.uid())
      )
      or
      (course_id is null and chapter_id is null)
    )
  );
create policy quizzes_update on public.quizzes
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy quizzes_delete on public.quizzes
  for delete using (owner_id = auth.uid());

create policy quiz_attempts_select on public.quiz_attempts
  for select using (user_id = auth.uid());
create policy quiz_attempts_insert on public.quiz_attempts
  for insert with check (user_id = auth.uid());
create policy quiz_attempts_update on public.quiz_attempts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy quiz_attempts_delete on public.quiz_attempts
  for delete using (user_id = auth.uid());
