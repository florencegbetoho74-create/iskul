-- Bibliotheque typee : banque d'epreuves separee des oeuvres et des manuels.
--
-- Avant : une seule table `books` a plat, dont les champs "Matiere" et "Niveau"
-- etaient saisis en texte libre. Impossible de distinguer une epreuve de BEPC
-- d'une oeuvre au programme, ni de retrouver les annales d'une session.
--
-- Apres : un referentiel de types de documents gere par l'administration, et
-- les metadonnees d'examen portees par le document lui-meme.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.books') is null then
    raise exception 'Table public.books introuvable.';
  end if;
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Appliquez d''abord supabase/admin_console_portal_migration.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Types de documents                                                         */
/* -------------------------------------------------------------------------- */
create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  plural_label text not null,
  -- Un type d'examen porte une session et une annee ; une oeuvre porte un auteur.
  is_exam boolean not null default false,
  order_index integer not null default 100,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists document_types_order_idx on public.document_types (order_index);

insert into public.document_types (code, label, plural_label, is_exam, order_index) values
  ('epreuve', 'Epreuve',        'Epreuves',            true,  1),
  ('corrige', 'Corrige',        'Corriges',            true,  2),
  ('oeuvre',  'Oeuvre',         'Oeuvres litteraires', false, 3),
  ('manuel',  'Manuel',         'Manuels',             false, 4),
  ('resume',  'Resume de cours','Resumes de cours',    false, 5),
  ('fiche',   'Fiche',          'Fiches de revision',  false, 6),
  ('autre',   'Autre document', 'Autres documents',    false, 99)
on conflict (code) do update
set label = excluded.label,
    plural_label = excluded.plural_label,
    is_exam = excluded.is_exam,
    order_index = excluded.order_index;

-- Libelles accentues poses via chr() pour rester lisibles quel que soit
-- l'encodage du client psql qui applique la migration.
update public.document_types set label = 'Epreuve', plural_label = 'Epreuves' where code = 'epreuve';
update public.document_types
set label = 'Corrig' || chr(233), plural_label = 'Corrig' || chr(233) || 's'
where code = 'corrige';
update public.document_types
set label = chr(338) || 'uvre', plural_label = chr(338) || 'uvres litt' || chr(233) || 'raires'
where code = 'oeuvre';
update public.document_types
set label = 'R' || chr(233) || 'sum' || chr(233) || ' de cours',
    plural_label = 'R' || chr(233) || 'sum' || chr(233) || 's de cours'
where code = 'resume';
update public.document_types
set plural_label = 'Fiches de r' || chr(233) || 'vision'
where code = 'fiche';

/* -------------------------------------------------------------------------- */
/* Metadonnees portees par le document                                        */
/* -------------------------------------------------------------------------- */
alter table public.books
  add column if not exists document_type_id uuid references public.document_types(id),
  add column if not exists exam_name text,
  add column if not exists exam_year integer,
  add column if not exists exam_session text,
  add column if not exists author text;

do $chk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_exam_year_chk' and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_exam_year_chk
      check (exam_year is null or (exam_year between 1960 and 2100));
  end if;
end $chk$;

-- Les documents existants n'ont aucun type exploitable : les ranger dans
-- "Autre document" les garde visibles et permet a l'administration de les
-- reclasser depuis la console.
update public.books b
set document_type_id = dt.id
from public.document_types dt
where b.document_type_id is null
  and dt.code = 'autre';

create index if not exists books_document_type_idx on public.books (document_type_id);
create index if not exists books_exam_idx on public.books (exam_name, exam_year desc)
  where exam_name is not null;

/* -------------------------------------------------------------------------- */
/* Lecture publique du referentiel, ecriture reservee aux administrateurs     */
/* -------------------------------------------------------------------------- */
alter table public.document_types enable row level security;

drop policy if exists document_types_select on public.document_types;
create policy document_types_select on public.document_types
  for select using (auth.uid() is not null);

drop policy if exists document_types_admin_write on public.document_types;
create policy document_types_admin_write on public.document_types
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select on public.document_types to authenticated;

/* -------------------------------------------------------------------------- */
/* Gestion du referentiel depuis la console                                   */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_upsert_document_type(
  p_code text,
  p_label text,
  p_plural_label text default null,
  p_is_exam boolean default false,
  p_order_index integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code text := lower(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_label text := trim(coalesce(p_label, ''));
  v_row public.document_types;
begin
  perform public.ensure_admin();

  if v_code = '' then
    raise exception 'invalid_code';
  end if;
  if v_label = '' then
    raise exception 'invalid_label';
  end if;

  insert into public.document_types (code, label, plural_label, is_exam, order_index)
  values (
    v_code,
    v_label,
    coalesce(nullif(trim(coalesce(p_plural_label, '')), ''), v_label),
    coalesce(p_is_exam, false),
    coalesce(p_order_index, 100)
  )
  on conflict (code) do update
  set label = excluded.label,
      plural_label = excluded.plural_label,
      is_exam = excluded.is_exam,
      order_index = excluded.order_index
  returning * into v_row;

  return to_jsonb(v_row);
end;
$fn$;

create or replace function public.admin_delete_document_type(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_fallback uuid;
  v_count bigint;
begin
  perform public.ensure_admin();

  if lower(trim(coalesce(p_code, ''))) = 'autre' then
    raise exception 'cannot_delete_fallback';
  end if;

  select id into v_id from public.document_types where code = lower(trim(coalesce(p_code, '')));
  if v_id is null then
    raise exception 'type_not_found';
  end if;

  select id into v_fallback from public.document_types where code = 'autre';

  -- Les documents rattaches ne disparaissent pas : ils repassent en
  -- "Autre document" pour rester visibles et reclassables.
  update public.books set document_type_id = v_fallback where document_type_id = v_id;
  get diagnostics v_count = row_count;

  delete from public.document_types where id = v_id;
end;
$fn$;

grant execute on function public.admin_upsert_document_type(text, text, text, boolean, integer) to authenticated;
grant execute on function public.admin_delete_document_type(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* Creation de matiere depuis la console                                      */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_upsert_subject(
  p_country_code text,
  p_code text,
  p_label text,
  p_order_index integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_system uuid;
  v_code text := lower(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_label text := trim(coalesce(p_label, ''));
  v_row public.subjects;
begin
  perform public.ensure_admin();

  if v_code = '' or v_label = '' then
    raise exception 'invalid_subject';
  end if;

  select s.id into v_system
  from public.education_systems s
  where s.country_code = upper(trim(coalesce(p_country_code, 'BJ')))
    and s.is_default = true;

  if v_system is null then
    raise exception 'education_system_not_found';
  end if;

  insert into public.subjects (system_id, code, label, order_index)
  values (v_system, v_code, v_label, coalesce(p_order_index, 100))
  on conflict (system_id, code) do update
  set label = excluded.label,
      order_index = excluded.order_index
  returning * into v_row;

  return to_jsonb(v_row);
end;
$fn$;

grant execute on function public.admin_upsert_subject(text, text, text, integer) to authenticated;

/* -------------------------------------------------------------------------- */
/* Liste admin enrichie du type                                               */
/* -------------------------------------------------------------------------- */
drop function if exists public.admin_list_books(integer, integer, text);

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
  document_type_code text,
  document_type_label text,
  exam_name text,
  exam_year integer,
  price numeric,
  published boolean,
  owner_id uuid,
  owner_name text,
  updated_at_ms bigint
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.ensure_admin();

  return query
  select
    b.id,
    b.title,
    b.level,
    b.subject,
    dt.code,
    dt.label,
    b.exam_name,
    b.exam_year,
    b.price,
    b.published,
    b.owner_id,
    coalesce(b.owner_name, p.name, p.email, 'Sans nom') as owner_name,
    b.updated_at_ms
  from public.books b
  left join public.profiles p on p.id = b.owner_id
  left join public.document_types dt on dt.id = b.document_type_id
  where
    coalesce(trim(p_search), '') = ''
    or lower(coalesce(b.title, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.level, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.subject, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.exam_name, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(dt.label, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.owner_name, p.name, p.email, '')) like '%' || lower(trim(p_search)) || '%'
  order by b.updated_at_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;

grant execute on function public.admin_list_books(integer, integer, text) to authenticated;

commit;
