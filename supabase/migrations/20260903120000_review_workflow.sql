-- Cycle de publication avec relecture experte.
--
-- Avant : un professeur cochait "publie" et son cours partait en ligne. Le
-- portail d'inscription professeur etant ouvert, n'importe qui pouvait creer un
-- compte enseignant et publier immediatement, sans relecture.
--
-- Apres : brouillon -> en relecture -> publie, ou renvoye a l'auteur avec un
-- motif. L'auteur ne peut plus publier lui-meme ; seul un relecteur ou un
-- administrateur le peut.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Appliquez d''abord supabase/admin_console_portal_migration.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Role relecteur                                                             */
/* -------------------------------------------------------------------------- */
-- Un booleen plutot qu'une valeur de `role` : un professeur peut relire les
-- contenus de ses pairs sans cesser d'etre professeur.
alter table public.profiles
  add column if not exists is_reviewer boolean not null default false;

create index if not exists profiles_is_reviewer_idx
  on public.profiles (is_reviewer) where is_reviewer = true;

create or replace function public.is_reviewer(p_user_id uuid)
returns boolean
language sql
stable
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and (p.is_reviewer = true or p.is_admin = true)
  );
$fn$;

-- Le garde-fou existant empeche un utilisateur de s'attribuer role ou is_admin.
-- is_reviewer doit relever de la meme regle.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
as $fn$
begin
  if auth.uid() is not null
     and (
       coalesce(new.role, 'student') is distinct from coalesce(old.role, 'student')
       or coalesce(new.is_admin, false) is distinct from coalesce(old.is_admin, false)
       or coalesce(new.is_reviewer, false) is distinct from coalesce(old.is_reviewer, false)
     )
     and not public.is_admin(auth.uid()) then
    raise exception 'forbidden_role_change';
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_guard_privileged_fields on public.profiles;
create trigger profiles_guard_privileged_fields
before update on public.profiles
for each row execute function public.guard_profile_privileged_fields();

create or replace function public.admin_set_user_reviewer(
  p_user_id uuid,
  p_is_reviewer boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();

  update public.profiles
  set is_reviewer = coalesce(p_is_reviewer, false)
  where id = p_user_id;

  if not found then
    raise exception 'user_not_found';
  end if;
end;
$fn$;

grant execute on function public.admin_set_user_reviewer(uuid, boolean) to authenticated;

/* -------------------------------------------------------------------------- */
/* La liste admin expose le role relecteur                                    */
/* -------------------------------------------------------------------------- */
drop function if exists public.admin_list_users(integer, integer, text);

create or replace function public.admin_list_users(
  p_limit integer default 100,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id uuid, name text, email text, role text,
  is_admin boolean, is_reviewer boolean,
  school text, grade text, last_seen_ms bigint,
  created_at_ms bigint, updated_at_ms bigint,
  courses_count bigint, books_count bigint, lives_count bigint, quizzes_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $fn$
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
      coalesce(p.is_reviewer, false) as is_reviewer,
      p.school, p.grade, p.last_seen_ms, p.created_at_ms, p.updated_at_ms
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
    base.id, base.name, base.email, base.role, base.is_admin, base.is_reviewer,
    base.school, base.grade, base.last_seen_ms, base.created_at_ms, base.updated_at_ms,
    coalesce(c.n, 0)::bigint, coalesce(b.n, 0)::bigint,
    coalesce(l.n, 0)::bigint, coalesce(q.n, 0)::bigint
  from base
  left join c on c.owner_id = base.id
  left join b on b.owner_id = base.id
  left join l on l.owner_id = base.id
  left join q on q.owner_id = base.id
  order by base.updated_at_ms desc nulls last;
end;
$fn$;

grant execute on function public.admin_list_users(integer, integer, text) to authenticated;

/* -------------------------------------------------------------------------- */
/* Statut editorial                                                           */
/* -------------------------------------------------------------------------- */
do $cols$
declare
  t text;
begin
  foreach t in array array['courses', 'books', 'quizzes'] loop
    execute format($sql$
      alter table public.%I
        add column if not exists status text,
        add column if not exists submitted_at_ms bigint,
        add column if not exists reviewed_at_ms bigint,
        add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
        add column if not exists review_note text
    $sql$, t);

    -- Reprise : ce qui etait en ligne le reste, le reste part en brouillon.
    execute format(
      'update public.%I set status = case when published then ''published'' else ''draft'' end where status is null',
      t
    );

    execute format('alter table public.%I alter column status set default ''draft''', t);
    execute format('alter table public.%I alter column status set not null', t);

    if not exists (
      select 1 from pg_constraint
      where conname = t || '_status_chk'
        and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (status in (''draft'', ''in_review'', ''published'', ''rejected''))',
        t, t || '_status_chk'
      );
    end if;

    execute format(
      'create index if not exists %I on public.%I (status, submitted_at_ms) where status = ''in_review''',
      t || '_review_queue_idx', t
    );
  end loop;
end $cols$;

/* -------------------------------------------------------------------------- */
/* published devient le reflet du statut                                      */
/* -------------------------------------------------------------------------- */
-- L'application deja publiee lit encore `published` : la colonne reste, mais
-- elle est desormais derivee et ne peut plus etre pilotee a la main.
create or replace function public.sync_publication_status()
returns trigger
language plpgsql
as $fn$
begin
  new.published := (new.status = 'published');
  return new;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* L'auteur ne publie plus lui-meme                                           */
/* -------------------------------------------------------------------------- */
create or replace function public.guard_content_status()
returns trigger
language plpgsql
as $fn$
declare
  v_uid uuid := auth.uid();
  v_old text := coalesce(old.status, 'draft');
  v_new text := coalesce(new.status, 'draft');
begin
  if v_uid is null or v_old = v_new then
    return new;
  end if;

  if public.is_reviewer(v_uid) then
    return new;
  end if;

  -- Un auteur peut soumettre son travail et le retirer de la file tant qu'il
  -- n'a pas ete relu. Tout le reste releve du relecteur.
  if v_old = 'draft' and v_new = 'in_review' then
    return new;
  end if;
  if v_old = 'in_review' and v_new = 'draft' then
    return new;
  end if;
  if v_old = 'rejected' and v_new in ('draft', 'in_review') then
    return new;
  end if;

  raise exception 'forbidden_status_change';
end;
$fn$;

do $trg$
declare
  t text;
begin
  foreach t in array array['courses', 'books', 'quizzes'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_status', t);
    execute format(
      'create trigger %I before update of status on public.%I for each row execute function public.guard_content_status()',
      t || '_guard_status', t
    );

    execute format('drop trigger if exists %I on public.%I', t || '_sync_published', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.sync_publication_status()',
      t || '_sync_published', t
    );
  end loop;
end $trg$;

/* -------------------------------------------------------------------------- */
/* La vue des quiz expose le statut                                           */
/* -------------------------------------------------------------------------- */
-- quizzes_readable est la seule lecture possible des quiz : sans ces colonnes,
-- l'auteur ne saurait pas ou en est sa soumission.
drop view if exists public.quizzes_readable;
create view public.quizzes_readable as
select
  q.id, q.course_id, q.chapter_id, q.level, q.subject,
  q.country_code, q.grade_level_id, q.subject_id,
  q.title, q.description, q.published, q.status, q.review_note,
  q.owner_id, q.created_at_ms, q.updated_at_ms,
  c.title as course_title,
  ch.title as chapter_title,
  case
    when q.owner_id = auth.uid() or public.is_admin(auth.uid()) then q.questions
    else public.strip_quiz_answers(q.questions)
  end as questions
from public.quizzes q
left join public.courses c on c.id = q.course_id
left join public.chapters ch on ch.id = q.chapter_id
where auth.uid() is not null
  and (
    q.owner_id = auth.uid()
    or public.is_admin(auth.uid())
    or (q.published = true and (q.course_id is null or c.published = true))
  );

grant select on public.quizzes_readable to authenticated;

/* -------------------------------------------------------------------------- */
/* Historique des decisions                                                   */
/* -------------------------------------------------------------------------- */
create table if not exists public.content_reviews (
  id text primary key default gen_random_uuid()::text,
  content_kind text not null check (content_kind in ('course', 'book', 'quiz')),
  content_id text not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('submitted', 'published', 'rejected', 'withdrawn')),
  note text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists content_reviews_content_idx
  on public.content_reviews (content_kind, content_id, created_at_ms desc);

alter table public.content_reviews enable row level security;

drop policy if exists content_reviews_select on public.content_reviews;
create policy content_reviews_select on public.content_reviews
  for select using (public.is_reviewer(auth.uid()));

revoke insert, update, delete on public.content_reviews from anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Soumission, file d'attente et decision                                     */
/* -------------------------------------------------------------------------- */
create or replace function public.content_table_name(p_kind text)
returns text
language sql
immutable
as $fn$
  select case lower(coalesce(p_kind, ''))
    when 'course' then 'courses'
    when 'book' then 'books'
    when 'quiz' then 'quizzes'
    else null
  end;
$fn$;

create or replace function public.submit_content_for_review(
  p_kind text,
  p_content_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_table text := public.content_table_name(p_kind);
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;
  if v_table is null then
    raise exception 'invalid_kind';
  end if;

  execute format('select owner_id, status from public.%I where id = $1', v_table)
  into v_owner, v_status
  using p_content_id;

  if v_owner is null then
    raise exception 'content_not_found';
  end if;
  if v_owner <> v_uid and not public.is_reviewer(v_uid) then
    raise exception 'not_owner';
  end if;
  if v_status = 'in_review' then
    raise exception 'already_in_review';
  end if;
  if v_status = 'published' then
    raise exception 'already_published';
  end if;

  execute format(
    'update public.%I set status = ''in_review'', submitted_at_ms = $1, review_note = null where id = $2',
    v_table
  ) using v_now, p_content_id;

  insert into public.content_reviews (content_kind, content_id, reviewer_id, decision, created_at_ms)
  values (lower(p_kind), p_content_id, v_uid, 'submitted', v_now);

  return jsonb_build_object('status', 'in_review', 'submittedAtMs', v_now);
end;
$fn$;

create or replace function public.withdraw_content_from_review(
  p_kind text,
  p_content_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_table text := public.content_table_name(p_kind);
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;
  if v_table is null then
    raise exception 'invalid_kind';
  end if;

  execute format('select owner_id, status from public.%I where id = $1', v_table)
  into v_owner, v_status
  using p_content_id;

  if v_owner is null then
    raise exception 'content_not_found';
  end if;
  if v_owner <> v_uid and not public.is_reviewer(v_uid) then
    raise exception 'not_owner';
  end if;
  if v_status <> 'in_review' then
    raise exception 'not_in_review';
  end if;

  execute format('update public.%I set status = ''draft'', submitted_at_ms = null where id = $1', v_table)
  using p_content_id;

  insert into public.content_reviews (content_kind, content_id, reviewer_id, decision, created_at_ms)
  values (lower(p_kind), p_content_id, v_uid, 'withdrawn', v_now);

  return jsonb_build_object('status', 'draft');
end;
$fn$;

create or replace function public.review_content(
  p_kind text,
  p_content_id text,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_table text := public.content_table_name(p_kind);
  v_uid uuid := auth.uid();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_status text;
  v_owner uuid;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_uid is null or not public.is_reviewer(v_uid) then
    raise exception 'reviewer_only';
  end if;
  if v_table is null then
    raise exception 'invalid_kind';
  end if;
  if v_decision not in ('published', 'rejected') then
    raise exception 'invalid_decision';
  end if;
  -- Un refus sans motif renvoie l'auteur a un mur : le motif est obligatoire.
  if v_decision = 'rejected' and v_note is null then
    raise exception 'note_required';
  end if;

  execute format('select owner_id, status from public.%I where id = $1', v_table)
  into v_owner, v_status
  using p_content_id;

  if v_owner is null then
    raise exception 'content_not_found';
  end if;

  execute format(
    'update public.%I set status = $1, reviewed_at_ms = $2, reviewed_by = $3, review_note = $4 where id = $5',
    v_table
  ) using v_decision, v_now, v_uid, v_note, p_content_id;

  insert into public.content_reviews (content_kind, content_id, reviewer_id, decision, note, created_at_ms)
  values (lower(p_kind), p_content_id, v_uid, v_decision, v_note, v_now);

  return jsonb_build_object('status', v_decision, 'reviewedAtMs', v_now);
end;
$fn$;

create or replace function public.review_queue(p_limit integer default 100)
returns table (
  content_kind text,
  content_id text,
  title text,
  level text,
  subject text,
  owner_id uuid,
  owner_name text,
  submitted_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null or not public.is_reviewer(auth.uid()) then
    raise exception 'reviewer_only';
  end if;

  return query
  select 'course'::text, c.id, c.title, c.level, c.subject, c.owner_id,
         coalesce(c.owner_name, p.name, 'Sans nom'), c.submitted_at_ms
  from public.courses c
  left join public.profiles p on p.id = c.owner_id
  where c.status = 'in_review'
  union all
  select 'book'::text, b.id, b.title, b.level, b.subject, b.owner_id,
         coalesce(b.owner_name, p.name, 'Sans nom'), b.submitted_at_ms
  from public.books b
  left join public.profiles p on p.id = b.owner_id
  where b.status = 'in_review'
  union all
  select 'quiz'::text, q.id, q.title, q.level, q.subject, q.owner_id,
         coalesce(p.name, 'Sans nom'), q.submitted_at_ms
  from public.quizzes q
  left join public.profiles p on p.id = q.owner_id
  where q.status = 'in_review'
  order by 8 asc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$fn$;

grant execute on function public.submit_content_for_review(text, text) to authenticated;
grant execute on function public.withdraw_content_from_review(text, text) to authenticated;
grant execute on function public.review_content(text, text, text, text) to authenticated;
grant execute on function public.review_queue(integer) to authenticated;

/* -------------------------------------------------------------------------- */
/* Les bascules admin passent par le meme chemin                              */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_set_course_published(
  p_course_id text,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();
  perform public.review_content(
    'course', p_course_id,
    case when coalesce(p_published, false) then 'published' else 'rejected' end,
    case when coalesce(p_published, false) then null else 'Depublie depuis la console.' end
  );
end;
$fn$;

create or replace function public.admin_set_book_published(
  p_book_id text,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();
  perform public.review_content(
    'book', p_book_id,
    case when coalesce(p_published, false) then 'published' else 'rejected' end,
    case when coalesce(p_published, false) then null else 'Depublie depuis la console.' end
  );
end;
$fn$;

create or replace function public.admin_set_quiz_published(
  p_quiz_id text,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();
  perform public.review_content(
    'quiz', p_quiz_id,
    case when coalesce(p_published, false) then 'published' else 'rejected' end,
    case when coalesce(p_published, false) then null else 'Depublie depuis la console.' end
  );
end;
$fn$;

commit;
