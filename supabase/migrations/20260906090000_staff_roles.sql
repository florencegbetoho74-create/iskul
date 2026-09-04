-- Roles d'equipe nommes.
--
-- Avant : deux etats seulement. Administrateur, qui peut tout ; relecteur, qui
-- voit toute la file quel que soit le type de contenu. Confier la bibliotheque
-- a quelqu'un revenait donc a lui confier aussi la validation des cours, et
-- donner les pleins droits pour une tache bornee est la premiere facon de
-- perdre le controle d'une plateforme.
--
-- Apres : quatre roles nommes, cumulables, portes par un tableau sur le
-- profil. Un relecteur de cours ne voit que les cours dans sa file ; un
-- bibliothecaire ne decide que des documents. L'administrateur garde tout.
--
-- Le controle est fait par les procedures, pas par l'interface : masquer un
-- bouton n'a jamais empeche un appel direct a l'API.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regprocedure('public.is_reviewer(uuid)') is null then
    raise exception 'Appliquez d''abord 20260903120000_review_workflow.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Le profil porte ses roles                                                  */
/* -------------------------------------------------------------------------- */
alter table public.profiles
  add column if not exists staff_roles text[] not null default '{}';

do $chk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_staff_roles_chk' and conrelid = 'public.profiles'::regclass
  ) then
    -- Un role inconnu ne serait refuse nulle part ailleurs : il donnerait
    -- l'illusion d'un droit accorde.
    alter table public.profiles
      add constraint profiles_staff_roles_chk
      check (
        staff_roles <@ array[
          'course_reviewer',
          'librarian',
          'quiz_reviewer',
          'live_moderator'
        ]::text[]
      );
  end if;
end $chk$;

create index if not exists profiles_staff_roles_idx
  on public.profiles using gin (staff_roles)
  where staff_roles <> '{}';

-- Les relecteurs existants deviennent relecteurs de cours et de quiz : c'est
-- ce qu'ils faisaient. Personne ne perd un droit a l'application.
update public.profiles
set staff_roles = array['course_reviewer', 'quiz_reviewer']::text[]
where is_reviewer = true and staff_roles = '{}';

/* -------------------------------------------------------------------------- */
/* Lecture des droits                                                         */
/* -------------------------------------------------------------------------- */
create or replace function public.has_staff_role(p_user_id uuid, p_role text)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and (p.is_admin = true or p_role = any(p.staff_roles))
  );
$fn$;

/**
 * Droit de trancher sur un type de contenu.
 *
 * `is_reviewer` reste vrai pour les comptes qui le portent : un deploiement ne
 * doit pas retirer un droit en silence a quelqu'un qui travaillait hier.
 */
create or replace function public.can_review_kind(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and (
        p.is_admin = true
        or (lower(p_kind) = 'course' and 'course_reviewer' = any(p.staff_roles))
        or (lower(p_kind) = 'book'   and 'librarian'       = any(p.staff_roles))
        or (lower(p_kind) = 'quiz'   and 'quiz_reviewer'   = any(p.staff_roles))
      )
  );
$fn$;

-- Toute personne portant au moins un role d'equipe entre dans la console.
create or replace function public.is_reviewer(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and (p.is_reviewer = true or p.is_admin = true or p.staff_roles <> '{}')
  );
$fn$;

/* -------------------------------------------------------------------------- */
/* La file ne montre que ce qu'on peut trancher                               */
/* -------------------------------------------------------------------------- */
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
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_reviewer(v_uid) then
    raise exception 'reviewer_only';
  end if;

  -- Afficher un contenu qu'on ne peut pas trancher n'aide personne : le
  -- relecteur le lit, decide, et se fait refuser.
  return query
  select 'course'::text, c.id, c.title, c.level, c.subject, c.owner_id,
         coalesce(c.owner_name, p.name, 'Sans nom'), c.submitted_at_ms
  from public.courses c
  left join public.profiles p on p.id = c.owner_id
  where c.status = 'in_review' and public.can_review_kind(v_uid, 'course')
  union all
  select 'book'::text, b.id, b.title, b.level, b.subject, b.owner_id,
         coalesce(b.owner_name, p.name, 'Sans nom'), b.submitted_at_ms
  from public.books b
  left join public.profiles p on p.id = b.owner_id
  where b.status = 'in_review' and public.can_review_kind(v_uid, 'book')
  union all
  select 'quiz'::text, q.id, q.title, q.level, q.subject, q.owner_id,
         coalesce(p.name, 'Sans nom'), q.submitted_at_ms
  from public.quizzes q
  left join public.profiles p on p.id = q.owner_id
  where q.status = 'in_review' and public.can_review_kind(v_uid, 'quiz')
  order by 8 asc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* La decision verifie le type                                                */
/* -------------------------------------------------------------------------- */
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
  if v_table is null then
    raise exception 'invalid_kind';
  end if;
  -- Le droit se verifie sur le type demande, pas sur la qualite de relecteur
  -- en general : c'est toute la difference apportee par les roles nommes.
  if v_uid is null or not public.can_review_kind(v_uid, p_kind) then
    raise exception 'reviewer_only';
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
  if coalesce(v_status, 'draft') <> 'in_review' then
    raise exception 'not_in_review';
  end if;

  execute format(
    'update public.%I set status = $1, reviewed_at_ms = $2, reviewed_by = $3, review_note = $4 where id = $5',
    v_table
  ) using v_decision, v_now, v_uid, v_note, p_content_id;

  insert into public.content_reviews (content_kind, content_id, reviewer_id, decision, note, created_at_ms)
  values (lower(p_kind), p_content_id, v_uid, v_decision, v_note, v_now);

  return jsonb_build_object('status', v_decision, 'note', v_note);
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Administration des roles                                                   */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_list_staff_roles()
returns table (user_id uuid, staff_roles text[])
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();
  return query
  select p.id, p.staff_roles
  from public.profiles p
  where p.staff_roles <> '{}' or p.is_admin = true;
end;
$fn$;

create or replace function public.admin_set_staff_roles(
  p_user_id uuid,
  p_roles text[]
)
returns text[]
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_clean text[];
begin
  perform public.ensure_admin();

  -- Un role inconnu est ecarte plutot que de faire echouer l'appel : la
  -- console pourrait envoyer une valeur d'une version plus recente.
  select coalesce(array_agg(distinct r), '{}')
  into v_clean
  from unnest(coalesce(p_roles, '{}')) as r
  where r in ('course_reviewer', 'librarian', 'quiz_reviewer', 'live_moderator');

  update public.profiles
  set staff_roles = v_clean,
      -- Le drapeau historique suit : il sert encore de porte d'entree.
      is_reviewer = (v_clean <> '{}')
  where id = p_user_id;

  if not found then
    raise exception 'user_not_found';
  end if;

  return v_clean;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Actions bornees par role                                                   */
/* -------------------------------------------------------------------------- */
-- La publication directe d'un document revient au bibliothecaire, celle d'un
-- cours au relecteur de cours. Sans cette borne, un role restreint pourrait
-- contourner sa restriction par la console.
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
  if auth.uid() is null or not public.can_review_kind(auth.uid(), 'book') then
    raise exception 'admin_only';
  end if;
  update public.books
  set status = case when p_published then 'published' else 'draft' end,
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_book_id;
end;
$fn$;

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
  if auth.uid() is null or not public.can_review_kind(auth.uid(), 'course') then
    raise exception 'admin_only';
  end if;
  update public.courses
  set status = case when p_published then 'published' else 'draft' end,
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_course_id;
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
  if auth.uid() is null or not public.can_review_kind(auth.uid(), 'quiz') then
    raise exception 'admin_only';
  end if;
  update public.quizzes
  set status = case when p_published then 'published' else 'draft' end,
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_quiz_id;
end;
$fn$;

create or replace function public.admin_set_live_status(
  p_live_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null
     or not (public.is_admin(auth.uid()) or public.has_staff_role(auth.uid(), 'live_moderator')) then
    raise exception 'admin_only';
  end if;
  if lower(coalesce(p_status, '')) not in ('scheduled', 'live', 'ended') then
    raise exception 'invalid_status';
  end if;
  update public.lives
  set status = lower(p_status),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_live_id;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Droits d'appel                                                             */
/* -------------------------------------------------------------------------- */
grant execute on function public.has_staff_role(uuid, text) to authenticated;
grant execute on function public.can_review_kind(uuid, text) to authenticated;
grant execute on function public.admin_list_staff_roles() to authenticated;
grant execute on function public.admin_set_staff_roles(uuid, text[]) to authenticated;

commit;
