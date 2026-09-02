-- Rattachement des contenus au referentiel pays / classe / matiere.
--
-- Regle produit : un contenu sans classe (grade_level_id null) est considere
-- "tous niveaux" et reste visible par tous. C'est ce qui permet de ne pas faire
-- disparaitre les contenus existants mal classes, et cela donne aux professeurs
-- une option reelle pour les seances transversales.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.grade_levels') is null then
    raise exception 'Appliquez d''abord 20260902090000_referentials.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Colonnes de rattachement                                                   */
/* -------------------------------------------------------------------------- */
alter table public.courses
  add column if not exists country_code text references public.countries(code),
  add column if not exists grade_level_id uuid references public.grade_levels(id),
  add column if not exists subject_id uuid references public.subjects(id);

alter table public.books
  add column if not exists country_code text references public.countries(code),
  add column if not exists grade_level_id uuid references public.grade_levels(id),
  add column if not exists subject_id uuid references public.subjects(id);

alter table public.quizzes
  add column if not exists country_code text references public.countries(code),
  add column if not exists grade_level_id uuid references public.grade_levels(id),
  add column if not exists subject_id uuid references public.subjects(id);

-- Les seances live n'avaient ni classe ni matiere : impossible de proposer a un
-- eleve de 6e les travaux diriges de terminale.
alter table public.lives
  add column if not exists country_code text references public.countries(code),
  add column if not exists grade_level_id uuid references public.grade_levels(id),
  add column if not exists subject_id uuid references public.subjects(id),
  add column if not exists level text,
  add column if not exists subject text;

/* -------------------------------------------------------------------------- */
/* Resolution texte -> referentiel                                            */
/* -------------------------------------------------------------------------- */
create or replace function public.resolve_grade_level_id(
  p_label text,
  p_country text default 'BJ'
)
returns uuid
language sql
stable
as $fn$
  select gl.id
  from public.grade_levels gl
  join public.education_systems es on es.id = gl.system_id
  where es.country_code = coalesce(nullif(trim(p_country), ''), 'BJ')
    and es.is_default = true
    and gl.code = case lower(regexp_replace(coalesce(p_label, ''), '[^a-zA-Z0-9]', '', 'g'))
      when '6e'        then '6e'
      when '6eme'      then '6e'
      when '5e'        then '5e'
      when '5eme'      then '5e'
      when '4e'        then '4e'
      when '4eme'      then '4e'
      when '3e'        then '3e'
      when '3eme'      then '3e'
      when '2nde'      then '2nde'
      when '2de'       then '2nde'
      when '2nd'       then '2nde'
      when 'seconde'   then '2nde'
      when '1ere'      then '1ere'
      when '1re'       then '1ere'
      when 'premiere'  then '1ere'
      when 'tle'       then 'Terminale'
      when 'terminale' then 'Terminale'
      else null
    end
  limit 1;
$fn$;

create or replace function public.resolve_subject_id(
  p_label text,
  p_country text default 'BJ'
)
returns uuid
language sql
stable
as $fn$
  select s.id
  from public.subjects s
  join public.education_systems es on es.id = s.system_id
  where es.country_code = coalesce(nullif(trim(p_country), ''), 'BJ')
    and es.is_default = true
    and s.code = case lower(regexp_replace(coalesce(p_label, ''), '[^a-zA-Z0-9]', '', 'g'))
      when 'maths'             then 'maths'
      when 'mathematiques'     then 'maths'
      when 'math'              then 'maths'
      when 'pct'               then 'pct'
      when 'physiquechimie'    then 'pct'
      when 'physiquechimiepct' then 'pct'
      when 'physique'          then 'pct'
      when 'svt'               then 'svt'
      when 'francais'          then 'francais'
      when 'french'            then 'francais'
      when 'anglais'           then 'anglais'
      when 'english'           then 'anglais'
      when 'espagnol'          then 'espagnol'
      when 'hg'                then 'hg'
      when 'histoiregeographie' then 'hg'
      when 'histoiregeo'       then 'hg'
      when 'philosophie'       then 'philosophie'
      when 'philo'             then 'philosophie'
      when 'informatique'      then 'informatique'
      when 'info'              then 'informatique'
      else null
    end
  limit 1;
$fn$;

/* -------------------------------------------------------------------------- */
/* Reprise des donnees existantes                                             */
/* -------------------------------------------------------------------------- */
update public.courses
set country_code = 'BJ'
where country_code is null;

update public.books
set country_code = 'BJ'
where country_code is null;

update public.quizzes
set country_code = 'BJ'
where country_code is null;

update public.lives
set country_code = 'BJ'
where country_code is null;

update public.courses
set grade_level_id = public.resolve_grade_level_id(level, 'BJ')
where grade_level_id is null;

update public.courses
set subject_id = public.resolve_subject_id(subject, 'BJ')
where subject_id is null;

update public.books
set grade_level_id = public.resolve_grade_level_id(level, 'BJ')
where grade_level_id is null;

update public.books
set subject_id = public.resolve_subject_id(subject, 'BJ')
where subject_id is null;

update public.quizzes
set grade_level_id = public.resolve_grade_level_id(level, 'BJ')
where grade_level_id is null;

update public.quizzes
set subject_id = public.resolve_subject_id(subject, 'BJ')
where subject_id is null;

-- Un quiz rattache a un cours herite du classement de ce cours.
update public.quizzes q
set grade_level_id = c.grade_level_id,
    subject_id = coalesce(q.subject_id, c.subject_id)
from public.courses c
where q.course_id = c.id
  and q.grade_level_id is null
  and c.grade_level_id is not null;

/* -------------------------------------------------------------------------- */
/* Synchronisation des colonnes texte                                         */
/* -------------------------------------------------------------------------- */
-- L'application deja publiee lit encore courses.level / courses.subject.
-- Tant qu'elle est en circulation, ces colonnes doivent rester exactes.
create or replace function public.sync_content_taxonomy_text()
returns trigger
language plpgsql
as $fn$
begin
  if new.grade_level_id is not null then
    select gl.code into new.level
    from public.grade_levels gl
    where gl.id = new.grade_level_id;
  end if;

  if new.subject_id is not null then
    select s.label into new.subject
    from public.subjects s
    where s.id = new.subject_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists courses_sync_taxonomy_text on public.courses;
create trigger courses_sync_taxonomy_text
before insert or update of grade_level_id, subject_id on public.courses
for each row execute function public.sync_content_taxonomy_text();

drop trigger if exists books_sync_taxonomy_text on public.books;
create trigger books_sync_taxonomy_text
before insert or update of grade_level_id, subject_id on public.books
for each row execute function public.sync_content_taxonomy_text();

drop trigger if exists quizzes_sync_taxonomy_text on public.quizzes;
create trigger quizzes_sync_taxonomy_text
before insert or update of grade_level_id, subject_id on public.quizzes
for each row execute function public.sync_content_taxonomy_text();

drop trigger if exists lives_sync_taxonomy_text on public.lives;
create trigger lives_sync_taxonomy_text
before insert or update of grade_level_id, subject_id on public.lives
for each row execute function public.sync_content_taxonomy_text();

/* -------------------------------------------------------------------------- */
/* Index de filtrage                                                          */
/* -------------------------------------------------------------------------- */
-- Le filtrage eleve porte toujours sur (pays, classe) puis tri par recence.
create index if not exists courses_scope_idx
  on public.courses (country_code, grade_level_id, updated_at_ms desc);
create index if not exists courses_subject_idx
  on public.courses (subject_id);

create index if not exists books_scope_idx
  on public.books (country_code, grade_level_id, updated_at_ms desc);
create index if not exists books_subject_idx
  on public.books (subject_id);

create index if not exists quizzes_scope_idx
  on public.quizzes (country_code, grade_level_id, updated_at_ms desc);
create index if not exists quizzes_subject_id_idx
  on public.quizzes (subject_id);

create index if not exists lives_scope_idx
  on public.lives (country_code, grade_level_id, start_at_ms);

/* -------------------------------------------------------------------------- */
/* Contenus non classes : de quoi agir plutot que de deviner                  */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_unclassified_content()
returns table (
  kind text,
  id text,
  title text,
  level_text text,
  subject_text text,
  owner_id uuid,
  updated_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();

  return query
  select 'course'::text, c.id, c.title, c.level, c.subject, c.owner_id, c.updated_at_ms
  from public.courses c
  where c.grade_level_id is null or c.subject_id is null
  union all
  select 'book'::text, b.id, b.title, b.level, b.subject, b.owner_id, b.updated_at_ms
  from public.books b
  where b.grade_level_id is null or b.subject_id is null
  union all
  select 'quiz'::text, q.id, q.title, q.level, q.subject, q.owner_id, q.updated_at_ms
  from public.quizzes q
  where q.grade_level_id is null or q.subject_id is null
  union all
  select 'live'::text, l.id, l.title, l.level, l.subject, l.owner_id, l.updated_at_ms
  from public.lives l
  where l.grade_level_id is null
  order by 7 desc nulls last;
end;
$fn$;

grant execute on function public.admin_unclassified_content() to authenticated;

commit;
