-- Migration: hardened teacher signup + admin console backend
-- Safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Profiles hardening
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles
set role = lower(trim(coalesce(role, '')))
where role is null
   or role <> lower(trim(coalesce(role, '')));

update public.profiles
set role = 'student'
where coalesce(role, '') = ''
   or role not in ('student', 'teacher');

alter table public.profiles
  alter column role set default 'student',
  alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_chk check (role in ('student', 'teacher'));
  end if;
end $$;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_admin_idx on public.profiles (is_admin) where is_admin = true;

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_admin = true
  );
$$;

create or replace function public.is_teacher(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and (p.role = 'teacher' or p.is_admin = true)
  );
$$;

create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (
       coalesce(new.role, 'student') is distinct from coalesce(old.role, 'student')
       or coalesce(new.is_admin, false) is distinct from coalesce(old.is_admin, false)
     )
     and not public.is_admin(auth.uid()) then
    raise exception 'forbidden_role_change';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_fields on public.profiles;
create trigger profiles_guard_privileged_fields
before update on public.profiles
for each row execute function public.guard_profile_privileged_fields();

-- ---------------------------------------------------------------------------
-- Authoring policies hardened to teacher/admin only
-- ---------------------------------------------------------------------------

drop policy if exists courses_insert on public.courses;
drop policy if exists courses_update on public.courses;
drop policy if exists courses_delete on public.courses;

create policy courses_insert on public.courses
  for insert with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy courses_update on public.courses
  for update using (owner_id = auth.uid() and public.is_teacher(auth.uid()))
  with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy courses_delete on public.courses
  for delete using (owner_id = auth.uid() and public.is_teacher(auth.uid()));

drop policy if exists chapters_insert on public.chapters;
drop policy if exists chapters_update on public.chapters;
drop policy if exists chapters_delete on public.chapters;

create policy chapters_insert on public.chapters
  for insert with check (
    public.is_teacher(auth.uid())
    and exists (
      select 1
      from public.courses c
      where c.id = course_id
        and c.owner_id = auth.uid()
    )
  );
create policy chapters_update on public.chapters
  for update using (
    public.is_teacher(auth.uid())
    and exists (
      select 1
      from public.courses c
      where c.id = course_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    public.is_teacher(auth.uid())
    and exists (
      select 1
      from public.courses c
      where c.id = course_id
        and c.owner_id = auth.uid()
    )
  );
create policy chapters_delete on public.chapters
  for delete using (
    public.is_teacher(auth.uid())
    and exists (
      select 1
      from public.courses c
      where c.id = course_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists lives_insert on public.lives;
drop policy if exists lives_update on public.lives;
drop policy if exists lives_delete on public.lives;

create policy lives_insert on public.lives
  for insert with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy lives_update on public.lives
  for update using (owner_id = auth.uid() and public.is_teacher(auth.uid()))
  with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy lives_delete on public.lives
  for delete using (owner_id = auth.uid() and public.is_teacher(auth.uid()));

drop policy if exists books_insert on public.books;
drop policy if exists books_update on public.books;
drop policy if exists books_delete on public.books;

create policy books_insert on public.books
  for insert with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy books_update on public.books
  for update using (owner_id = auth.uid() and public.is_teacher(auth.uid()))
  with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy books_delete on public.books
  for delete using (owner_id = auth.uid() and public.is_teacher(auth.uid()));

drop policy if exists quizzes_insert on public.quizzes;
drop policy if exists quizzes_update on public.quizzes;
drop policy if exists quizzes_delete on public.quizzes;

create policy quizzes_insert on public.quizzes
  for insert with check (
    owner_id = auth.uid()
    and public.is_teacher(auth.uid())
    and (
      (
        course_id is not null
        and chapter_id is not null
        and exists (
          select 1
          from public.courses c
          where c.id = course_id
            and c.owner_id = auth.uid()
        )
      )
      or
      (course_id is null and chapter_id is null)
    )
  );
create policy quizzes_update on public.quizzes
  for update using (owner_id = auth.uid() and public.is_teacher(auth.uid()))
  with check (owner_id = auth.uid() and public.is_teacher(auth.uid()));
create policy quizzes_delete on public.quizzes
  for delete using (owner_id = auth.uid() and public.is_teacher(auth.uid()));

-- ---------------------------------------------------------------------------
-- Admin settings + audit tables
-- ---------------------------------------------------------------------------

create table if not exists public.admin_settings (
  id integer primary key default 1 check (id = 1),
  teacher_portal_open boolean not null default true,
  teacher_portal_message text,
  updated_at timestamptz not null default now(),
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

insert into public.admin_settings (id, teacher_portal_open, teacher_portal_message)
values (1, true, null)
on conflict (id) do nothing;

drop trigger if exists admin_settings_touch_updated_at on public.admin_settings;
create trigger admin_settings_touch_updated_at
before update on public.admin_settings
for each row execute function public.touch_updated_at_ms();

alter table public.admin_settings enable row level security;

create table if not exists public.teacher_portal_audit (
  id text primary key default gen_random_uuid()::text,
  email text not null,
  full_name text,
  school text,
  subjects text[],
  source text,
  created_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists teacher_portal_audit_created_at_idx on public.teacher_portal_audit (created_at desc);
create index if not exists teacher_portal_audit_email_idx on public.teacher_portal_audit (lower(email));

alter table public.teacher_portal_audit enable row level security;

-- ---------------------------------------------------------------------------
-- Admin RPC functions
-- ---------------------------------------------------------------------------

create or replace function public.ensure_admin()
returns void
language plpgsql
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin_only';
  end if;
end;
$$;

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  perform public.ensure_admin();

  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'teachers', (select count(*) from public.profiles where role = 'teacher'),
    'admins', (select count(*) from public.profiles where is_admin = true),
    'courses', (select count(*) from public.courses),
    'coursesPublished', (select count(*) from public.courses where published = true),
    'documents', (select count(*) from public.books),
    'documentsPublished', (select count(*) from public.books where published = true),
    'lives', (select count(*) from public.lives),
    'livesActive', (select count(*) from public.lives where status in ('scheduled', 'live')),
    'quizzes', (select count(*) from public.quizzes),
    'quizzesPublished', (select count(*) from public.quizzes where published = true),
    'messages', (select count(*) from public.chat_messages),
    'threads', (select count(*) from public.chat_threads),
    'teacherPortalOpen', (
      select s.teacher_portal_open
      from public.admin_settings s
      where s.id = 1
    ),
    'teacherPortalMessage', (
      select s.teacher_portal_message
      from public.admin_settings s
      where s.id = 1
    )
  )
  into payload;

  return coalesce(payload, '{}'::jsonb);
end;
$$;

create or replace function public.admin_list_users(
  p_limit integer default 100,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id uuid,
  name text,
  email text,
  role text,
  is_admin boolean,
  school text,
  grade text,
  last_seen_ms bigint,
  created_at_ms bigint,
  updated_at_ms bigint,
  courses_count bigint,
  books_count bigint,
  lives_count bigint,
  quizzes_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_admin();

  return query
  with base as (
    select
      p.id,
      coalesce(nullif(trim(p.name), ''), split_part(coalesce(p.email, u.email, ''), '@', 1)) as name,
      coalesce(p.email, u.email, '') as email,
      coalesce(p.role, 'student') as role,
      coalesce(p.is_admin, false) as is_admin,
      p.school,
      p.grade,
      p.last_seen_ms,
      p.created_at_ms,
      p.updated_at_ms
    from public.profiles p
    left join auth.users u on u.id = p.id
    where
      coalesce(trim(p_search), '') = ''
      or lower(coalesce(p.name, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(p.email, u.email, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(p.school, '')) like '%' || lower(trim(p_search)) || '%'
    order by p.updated_at_ms desc nulls last
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  c as (select owner_id, count(*)::bigint as n from public.courses group by owner_id),
  b as (select owner_id, count(*)::bigint as n from public.books group by owner_id),
  l as (select owner_id, count(*)::bigint as n from public.lives group by owner_id),
  q as (select owner_id, count(*)::bigint as n from public.quizzes group by owner_id)
  select
    base.id,
    base.name,
    base.email,
    base.role,
    base.is_admin,
    base.school,
    base.grade,
    base.last_seen_ms,
    base.created_at_ms,
    base.updated_at_ms,
    coalesce(c.n, 0)::bigint as courses_count,
    coalesce(b.n, 0)::bigint as books_count,
    coalesce(l.n, 0)::bigint as lives_count,
    coalesce(q.n, 0)::bigint as quizzes_count
  from base
  left join c on c.owner_id = base.id
  left join b on b.owner_id = base.id
  left join l on l.owner_id = base.id
  left join q on q.owner_id = base.id
  order by base.updated_at_ms desc nulls last;
end;
$$;

create or replace function public.admin_list_courses(
  p_limit integer default 200,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id text,
  title text,
  level text,
  subject text,
  published boolean,
  owner_id uuid,
  owner_name text,
  updated_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  return query
  select
    c.id,
    c.title,
    c.level,
    c.subject,
    c.published,
    c.owner_id,
    coalesce(c.owner_name, p.name, p.email, 'Sans nom') as owner_name,
    c.updated_at_ms
  from public.courses c
  left join public.profiles p on p.id = c.owner_id
  where
    coalesce(trim(p_search), '') = ''
    or lower(coalesce(c.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(c.level, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(c.subject, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(c.owner_name, p.name, p.email, '')) like '%' || lower(trim(p_search)) || '%'
  order by c.updated_at_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_books(
  p_limit integer default 200,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id text,
  title text,
  level text,
  subject text,
  price numeric,
  published boolean,
  owner_id uuid,
  owner_name text,
  updated_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  return query
  select
    b.id,
    b.title,
    b.level,
    b.subject,
    b.price,
    b.published,
    b.owner_id,
    coalesce(b.owner_name, p.name, p.email, 'Sans nom') as owner_name,
    b.updated_at_ms
  from public.books b
  left join public.profiles p on p.id = b.owner_id
  where
    coalesce(trim(p_search), '') = ''
    or lower(coalesce(b.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.level, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.subject, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.owner_name, p.name, p.email, '')) like '%' || lower(trim(p_search)) || '%'
  order by b.updated_at_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_lives(
  p_limit integer default 200,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id text,
  title text,
  status text,
  owner_id uuid,
  owner_name text,
  start_at_ms bigint,
  updated_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  return query
  select
    l.id,
    l.title,
    l.status,
    l.owner_id,
    coalesce(l.owner_name, p.name, p.email, 'Sans nom') as owner_name,
    l.start_at_ms,
    l.updated_at_ms
  from public.lives l
  left join public.profiles p on p.id = l.owner_id
  where
    coalesce(trim(p_search), '') = ''
    or lower(coalesce(l.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(l.status, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(l.owner_name, p.name, p.email, '')) like '%' || lower(trim(p_search)) || '%'
  order by l.start_at_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_quizzes(
  p_limit integer default 200,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id text,
  title text,
  scope text,
  level text,
  subject text,
  published boolean,
  owner_id uuid,
  owner_name text,
  course_title text,
  chapter_title text,
  updated_at_ms bigint,
  attempts bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  return query
  with attempts as (
    select qa.quiz_id, count(*)::bigint as n
    from public.quiz_attempts qa
    group by qa.quiz_id
  )
  select
    qz.id,
    qz.title,
    case when qz.course_id is null then 'standalone' else 'lesson' end as scope,
    qz.level,
    qz.subject,
    qz.published,
    qz.owner_id,
    coalesce(p.name, p.email, 'Sans nom') as owner_name,
    c.title as course_title,
    ch.title as chapter_title,
    qz.updated_at_ms,
    coalesce(a.n, 0)::bigint as attempts
  from public.quizzes qz
  left join public.profiles p on p.id = qz.owner_id
  left join public.courses c on c.id = qz.course_id
  left join public.chapters ch on ch.id = qz.chapter_id
  left join attempts a on a.quiz_id = qz.id
  where
    coalesce(trim(p_search), '') = ''
    or lower(coalesce(qz.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(qz.level, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(qz.subject, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(c.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(ch.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(p.name, p.email, '')) like '%' || lower(trim(p_search)) || '%'
  order by qz.updated_at_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_messages(
  p_limit integer default 300,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id text,
  teacher_name text,
  student_name text,
  course_title text,
  last_text text,
  last_at_ms bigint,
  message_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  return query
  with msg_counts as (
    select m.thread_id, count(*)::bigint as n
    from public.chat_messages m
    group by m.thread_id
  )
  select
    t.id,
    t.teacher_name,
    t.student_name,
    t.course_title,
    t.last_text,
    t.last_at_ms,
    coalesce(mc.n, 0)::bigint as message_count
  from public.chat_threads t
  left join msg_counts mc on mc.thread_id = t.id
  where
    coalesce(trim(p_search), '') = ''
    or lower(coalesce(t.teacher_name, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(t.student_name, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(t.course_title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(t.last_text, '')) like '%' || lower(trim(p_search)) || '%'
  order by t.last_at_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 300), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_portal_settings()
returns table (
  teacher_portal_open boolean,
  teacher_portal_message text,
  updated_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  return query
  select
    s.teacher_portal_open,
    s.teacher_portal_message,
    s.updated_at_ms
  from public.admin_settings s
  where s.id = 1;
end;
$$;

create or replace function public.admin_update_portal_settings(
  p_open boolean,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  update public.admin_settings
  set
    teacher_portal_open = coalesce(p_open, teacher_portal_open),
    teacher_portal_message = nullif(trim(coalesce(p_message, '')), ''),
    updated_at = now(),
    updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = 1;
end;
$$;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text := lower(trim(coalesce(p_role, '')));
  v_email text;
begin
  perform public.ensure_admin();

  if v_role not in ('student', 'teacher') then
    raise exception 'invalid_role';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null then
    raise exception 'user_not_found';
  end if;

  insert into public.profiles (id, email, role, is_admin)
  values (p_user_id, v_email, v_role, false)
  on conflict (id) do update
  set role = excluded.role;
end;
$$;

create or replace function public.admin_set_user_admin(
  p_user_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count bigint;
  target_is_admin boolean;
begin
  perform public.ensure_admin();

  select coalesce(p.is_admin, false) into target_is_admin
  from public.profiles p
  where p.id = p_user_id;

  if target_is_admin is null then
    raise exception 'user_not_found';
  end if;

  if coalesce(p_is_admin, false) = false and target_is_admin then
    select count(*)::bigint into admin_count
    from public.profiles p
    where p.is_admin = true;

    if admin_count <= 1 then
      raise exception 'cannot_remove_last_admin';
    end if;
  end if;

  update public.profiles
  set is_admin = coalesce(p_is_admin, false)
  where id = p_user_id;
end;
$$;

create or replace function public.admin_set_course_published(
  p_course_id text,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  update public.courses
  set published = coalesce(p_published, false),
      updated_at = now(),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_course_id;

  if not found then
    raise exception 'course_not_found';
  end if;
end;
$$;

create or replace function public.admin_set_book_published(
  p_book_id text,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  update public.books
  set published = coalesce(p_published, false),
      updated_at = now(),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_book_id;

  if not found then
    raise exception 'book_not_found';
  end if;
end;
$$;

create or replace function public.admin_set_quiz_published(
  p_quiz_id text,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_admin();

  update public.quizzes
  set published = coalesce(p_published, false),
      updated_at = now(),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_quiz_id;

  if not found then
    raise exception 'quiz_not_found';
  end if;
end;
$$;

create or replace function public.admin_set_live_status(
  p_live_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  perform public.ensure_admin();

  if v_status not in ('scheduled', 'live', 'ended') then
    raise exception 'invalid_live_status';
  end if;

  update public.lives
  set status = v_status,
      updated_at = now(),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_live_id;

  if not found then
    raise exception 'live_not_found';
  end if;
end;
$$;

create or replace function public.admin_list_media(
  p_bucket_id text default 'iskul',
  p_limit integer default 300,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id uuid,
  bucket_id text,
  object_name text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  mime_type text,
  size_bytes bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform public.ensure_admin();

  return query
  select
    o.id,
    o.bucket_id::text,
    o.name::text as object_name,
    o.owner::uuid as owner_id,
    o.created_at,
    o.updated_at,
    coalesce(o.metadata ->> 'mimetype', '')::text as mime_type,
    case
      when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (o.metadata ->> 'size')::bigint
      else 0
    end as size_bytes
  from storage.objects o
  where
    (
      coalesce(trim(p_bucket_id), '') = ''
      or lower(o.bucket_id) = lower(trim(p_bucket_id))
    )
    and (
      coalesce(trim(p_search), '') = ''
      or lower(o.name) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(o.metadata ->> 'mimetype', '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(o.owner::text, '')) like '%' || lower(trim(p_search)) || '%'
    )
  order by o.updated_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 300), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_delete_media(
  p_bucket_id text,
  p_object_name text
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  perform public.ensure_admin();

  delete from storage.objects o
  where lower(o.bucket_id) = lower(trim(coalesce(p_bucket_id, '')))
    and o.name = trim(coalesce(p_object_name, ''));

  if not found then
    raise exception 'media_not_found';
  end if;
end;
$$;

-- Execute permissions for authenticated clients (checks are inside functions)
grant execute on function public.admin_dashboard_snapshot() to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_list_courses(integer, integer, text) to authenticated;
grant execute on function public.admin_list_books(integer, integer, text) to authenticated;
grant execute on function public.admin_list_lives(integer, integer, text) to authenticated;
grant execute on function public.admin_list_quizzes(integer, integer, text) to authenticated;
grant execute on function public.admin_list_messages(integer, integer, text) to authenticated;
grant execute on function public.admin_get_portal_settings() to authenticated;
grant execute on function public.admin_update_portal_settings(boolean, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_course_published(text, boolean) to authenticated;
grant execute on function public.admin_set_book_published(text, boolean) to authenticated;
grant execute on function public.admin_set_quiz_published(text, boolean) to authenticated;
grant execute on function public.admin_set_live_status(text, text) to authenticated;
grant execute on function public.admin_list_media(text, integer, integer, text) to authenticated;
grant execute on function public.admin_delete_media(text, text) to authenticated;

commit;
