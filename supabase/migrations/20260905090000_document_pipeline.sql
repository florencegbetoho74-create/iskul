-- Chaine de traitement des documents de la bibliotheque.
--
-- Avant : un document etait un fichier. On deposait un PDF, on le rendait
-- disponible, et l'application n'en savait rien de plus que son titre. Un PDF
-- ne se cherche pas, ne se lit pas sur un telephone, et ne permet pas de relier
-- une epreuve a son corrige question par question.
--
-- Apres : le fichier n'est plus le document, il en est la source. Le depot
-- declenche une extraction qui produit un contenu structure en blocs et une
-- fiche de reference pre-remplie. Un humain relit avant publication : la
-- reference porte la credibilite du document, on ne la laisse pas a un
-- algorithme seul.
--
-- L'adresse du PDF d'origine ne figure nulle part dans `books`. Elle ne vit que
-- dans le journal des traitements, table qu'aucun client ne peut lire : c'est
-- ce qui garantit qu'elle n'atteint jamais un eleve, sans avoir a poser des
-- droits par colonne qui casseraient les requetes existantes.
--
-- Le format des blocs vit dans src/lib/documentFormat.ts et reste volontairement
-- ouvert : l'extraction d'aujourd'hui laisse les figures a completer a la main,
-- un service de decoupage pourra les remplir plus tard sans changer ce schema.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Appliquez d''abord supabase/admin_console_portal_migration.sql.';
  end if;
  if to_regprocedure('public.is_reviewer(uuid)') is null then
    raise exception 'Appliquez d''abord 20260903120000_review_workflow.sql.';
  end if;
  if to_regclass('public.document_types') is null then
    raise exception 'Appliquez d''abord 20260903090000_library_taxonomy.sql.';
  end if;
  -- books.id est de type text depuis supabase/library.sql : les cles etrangeres
  -- ci-dessous en dependent.
  if (
    select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'id'
  ) <> 'text' then
    raise exception 'books.id n''est pas de type text : adaptez cette migration.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Types de documents manquants                                               */
/* -------------------------------------------------------------------------- */
insert into public.document_types (code, label, plural_label, is_exam, order_index) values
  ('devoir',   'Devoir surveille', 'Devoirs surveilles', true,  3),
  ('exercice', 'Exercice',         'Exercices',          false, 7)
on conflict (code) do update
set label = excluded.label,
    plural_label = excluded.plural_label,
    is_exam = excluded.is_exam,
    order_index = excluded.order_index;

update public.document_types
set label = 'Devoir surveill' || chr(233), plural_label = 'Devoirs surveill' || chr(233) || 's'
where code = 'devoir';

-- Le devoir surveille se range avec les epreuves et les corriges, pas apres
-- les oeuvres litteraires : les suivants reculent d'un rang.
update public.document_types set order_index = 4 where code = 'oeuvre';
update public.document_types set order_index = 5 where code = 'manuel';
update public.document_types set order_index = 6 where code = 'resume';
update public.document_types set order_index = 8 where code = 'fiche';

/* -------------------------------------------------------------------------- */
/* Le document porte son contenu                                              */
/* -------------------------------------------------------------------------- */
alter table public.books
  -- Blocs structures produits par l'extraction, puis corriges a la relecture.
  add column if not exists content jsonb,
  -- Fiche de reference : etablissement, annee scolaire, session, redacteur.
  add column if not exists reference jsonb,
  -- Serie du lycee. Vide au college, ou le decoupage n'existe pas.
  add column if not exists series text,
  -- Un corrige pointe vers son epreuve.
  add column if not exists linked_document_id text references public.books(id) on delete set null,
  add column if not exists source_page_count integer,
  -- Texte brut du contenu, pour la recherche.
  add column if not exists content_text text;

-- Un document structure n'a plus de fichier a proposer au lecteur : le PDF
-- d'origine reste archive hors de `books`.
alter table public.books alter column file_url drop not null;

do $chk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_series_chk' and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_series_chk
      check (series is null or series ~ '^[A-Z]{1,3}[0-9]?$');
  end if;

  -- Un document ne peut pas etre son propre corrige.
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_linked_self_chk' and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_linked_self_chk
      check (linked_document_id is null or linked_document_id <> id);
  end if;

  -- Un document publie doit offrir quelque chose a lire : un contenu structure
  -- ou, pour les documents anterieurs a la chaine, son fichier.
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_readable_chk' and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_readable_chk
      check (
        published is not true
        or content is not null
        or coalesce(btrim(file_url), '') <> ''
      ) not valid;
  end if;
end $chk$;

create index if not exists books_linked_document_idx
  on public.books (linked_document_id) where linked_document_id is not null;

create index if not exists books_content_text_idx
  on public.books using gin (to_tsvector('french'::regconfig, coalesce(content_text, '')));

/* -------------------------------------------------------------------------- */
/* Journal des traitements                                                    */
/* -------------------------------------------------------------------------- */
-- source_url ne sort jamais de cette table : c'est l'adresse du PDF d'origine.
create table if not exists public.document_ingestions (
  id uuid primary key default gen_random_uuid(),
  book_id text not null references public.books(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'done', 'failed')),
  source_url text not null,
  page_count integer,
  block_count integer,
  figure_count integer,
  -- Ce qui a echoue, en toutes lettres, pour la console.
  error text,
  -- Modele et jetons consommes : sans cela le cout reste invisible.
  model text,
  input_tokens integer,
  output_tokens integer,
  attempts integer not null default 0,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  started_at_ms bigint,
  finished_at_ms bigint
);

create index if not exists document_ingestions_book_idx
  on public.document_ingestions (book_id, created_at_ms desc);
create index if not exists document_ingestions_state_idx
  on public.document_ingestions (state, created_at_ms)
  where state in ('queued', 'running');
create index if not exists document_ingestions_requester_idx
  on public.document_ingestions (requested_by, created_at_ms desc);

/* -------------------------------------------------------------------------- */
/* Quota journalier                                                           */
/* -------------------------------------------------------------------------- */
-- Chaque traitement coute un appel facture. Sans borne, un depot massif de PDF
-- viderait le budget avant que quiconque s'en apercoive.
create table if not exists public.ingestion_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Jour civil UTC : une remise a zero simple et verifiable.
  day date not null default (now() at time zone 'utc')::date,
  used integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.ingestion_settings (
  id boolean primary key default true check (id),
  daily_limit integer not null default 10 check (daily_limit >= 0),
  reviewer_daily_limit integer not null default 60 check (reviewer_daily_limit >= 0),
  max_pages integer not null default 40 check (max_pages > 0),
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

insert into public.ingestion_settings (id) values (true)
on conflict (id) do nothing;

create or replace function public.ingestion_daily_limit(p_user_id uuid)
returns integer
language sql
stable
set search_path = public, auth
as $fn$
  select case
    when public.is_admin(p_user_id) or public.is_reviewer(p_user_id)
      then s.reviewer_daily_limit
    else s.daily_limit
  end
  from public.ingestion_settings s
  where s.id = true;
$fn$;

/* -------------------------------------------------------------------------- */
/* Demander un traitement                                                     */
/* -------------------------------------------------------------------------- */
-- Appelee par le client juste apres le depot du fichier. Verifie le quota,
-- refuse un second travail sur un document deja en cours, et rend l'identifiant
-- du travail cree.
create or replace function public.request_document_ingestion(
  p_book_id text,
  p_source_url text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_limit integer;
  v_used integer;
  v_job uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select owner_id into v_owner from public.books where id = p_book_id;
  if v_owner is null then
    raise exception 'document_introuvable';
  end if;

  -- Un depot ne se traite que par son auteur, un relecteur ou un administrateur.
  if v_owner <> v_user
     and not public.is_reviewer(v_user)
     and not public.is_admin(v_user) then
    raise exception 'droits_insuffisants';
  end if;

  if coalesce(btrim(p_source_url), '') = '' then
    raise exception 'source_manquante';
  end if;

  -- Un travail deja en file ou en cours sur ce document est rendu tel quel :
  -- deux extractions simultanees se marcheraient dessus.
  select id into v_job
  from public.document_ingestions
  where book_id = p_book_id and state in ('queued', 'running')
  order by created_at_ms desc
  limit 1;
  if v_job is not null then
    return v_job;
  end if;

  v_limit := public.ingestion_daily_limit(v_user);

  insert into public.ingestion_quotas (user_id, day, used)
  values (v_user, (now() at time zone 'utc')::date, 0)
  on conflict (user_id, day) do nothing;

  -- Le verrou de ligne serialise deux depots simultanes du meme compte.
  select used into v_used
  from public.ingestion_quotas
  where user_id = v_user and day = (now() at time zone 'utc')::date
  for update;

  if v_used >= v_limit then
    raise exception 'quota_atteint:%', v_limit;
  end if;

  update public.ingestion_quotas
  set used = used + 1
  where user_id = v_user and day = (now() at time zone 'utc')::date;

  insert into public.document_ingestions (book_id, requested_by, source_url, state)
  values (p_book_id, v_user, btrim(p_source_url), 'queued')
  returning id into v_job;

  return v_job;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Ce que voit celui qui a demande                                            */
/* -------------------------------------------------------------------------- */
create or replace function public.document_ingestion_state(p_book_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_row public.document_ingestions;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select i.* into v_row
  from public.document_ingestions i
  join public.books b on b.id = i.book_id
  where i.book_id = p_book_id
    and (b.owner_id = v_user or public.is_reviewer(v_user) or public.is_admin(v_user))
  order by i.created_at_ms desc
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('state', 'none');
  end if;

  -- source_url reste dans la table : la rendre ici la donnerait au client.
  return jsonb_build_object(
    'id', v_row.id,
    'state', v_row.state,
    'pageCount', v_row.page_count,
    'blockCount', v_row.block_count,
    'figureCount', v_row.figure_count,
    'error', v_row.error,
    'attempts', v_row.attempts,
    'createdAtMs', v_row.created_at_ms,
    'finishedAtMs', v_row.finished_at_ms
  );
end;
$fn$;

create or replace function public.ingestion_quota_left()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_used integer;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  v_limit := public.ingestion_daily_limit(v_user);
  select coalesce(used, 0) into v_used
  from public.ingestion_quotas
  where user_id = v_user and day = (now() at time zone 'utc')::date;
  return jsonb_build_object('limit', v_limit, 'used', coalesce(v_used, 0));
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Cote traitement : reserve au service                                       */
/* -------------------------------------------------------------------------- */
-- Prend le plus ancien travail en attente et le marque en cours. Le verrou
-- saute les lignes deja prises : deux instances du service ne traiteront jamais
-- le meme document.
create or replace function public.claim_document_ingestion()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_row public.document_ingestions;
  v_max_pages integer;
begin
  select max_pages into v_max_pages from public.ingestion_settings where id = true;

  select * into v_row
  from public.document_ingestions
  where state = 'queued'
  order by created_at_ms
  for update skip locked
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('state', 'none');
  end if;

  update public.document_ingestions
  set state = 'running',
      attempts = attempts + 1,
      started_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = v_row.id;

  return jsonb_build_object(
    'id', v_row.id,
    'bookId', v_row.book_id,
    'sourceUrl', v_row.source_url,
    'maxPages', v_max_pages
  );
end;
$fn$;

create or replace function public.complete_document_ingestion(
  p_job_id uuid,
  p_content jsonb,
  p_reference jsonb,
  p_content_text text,
  p_page_count integer default null,
  p_model text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_book text;
  v_blocks integer;
  v_figures integer;
begin
  select book_id into v_book from public.document_ingestions where id = p_job_id;
  if v_book is null then
    raise exception 'travail_introuvable';
  end if;

  v_blocks := coalesce(jsonb_array_length(p_content -> 'blocks'), 0);
  select count(*) into v_figures
  from jsonb_array_elements(coalesce(p_content -> 'blocks', '[]'::jsonb)) b
  where b ->> 'kind' = 'figure';

  -- L'extraction ne publie pas : elle remplit un brouillon qu'un humain relit.
  update public.books
  set content = p_content,
      reference = coalesce(p_reference, reference),
      content_text = p_content_text,
      source_page_count = coalesce(p_page_count, source_page_count),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = v_book;

  update public.document_ingestions
  set state = 'done',
      error = null,
      page_count = coalesce(p_page_count, page_count),
      block_count = v_blocks,
      figure_count = v_figures,
      model = coalesce(p_model, model),
      input_tokens = coalesce(p_input_tokens, input_tokens),
      output_tokens = coalesce(p_output_tokens, output_tokens),
      finished_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_job_id;
end;
$fn$;

create or replace function public.fail_document_ingestion(
  p_job_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $fn$
begin
  update public.document_ingestions
  set state = 'failed',
      error = left(coalesce(p_error, 'echec inconnu'), 500),
      finished_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_job_id;
end;
$fn$;

-- Relancer apres un echec. La source est relue dans le journal : le client n'a
-- jamais eu a la connaitre. Le quota n'est pas re-decompte, l'appel precedent
-- n'ayant rien produit.
create or replace function public.retry_document_ingestion(p_book_id text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_source text;
  v_job uuid;
begin
  if v_user is null or not (public.is_reviewer(v_user) or public.is_admin(v_user)) then
    raise exception 'droits_insuffisants';
  end if;

  if exists (
    select 1 from public.document_ingestions
    where book_id = p_book_id and state in ('queued', 'running')
  ) then
    raise exception 'traitement_deja_en_cours';
  end if;

  select source_url into v_source
  from public.document_ingestions
  where book_id = p_book_id
  order by created_at_ms desc
  limit 1;

  if coalesce(btrim(v_source), '') = '' then
    raise exception 'source_manquante';
  end if;

  insert into public.document_ingestions (book_id, requested_by, source_url, state)
  values (p_book_id, v_user, v_source, 'queued')
  returning id into v_job;

  return v_job;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Droits                                                                     */
/* -------------------------------------------------------------------------- */
alter table public.document_ingestions enable row level security;
alter table public.ingestion_quotas enable row level security;
alter table public.ingestion_settings enable row level security;

-- Aucun acces direct au journal : il contient l'adresse du PDF d'origine. Tout
-- passe par les fonctions ci-dessus, qui ne la rendent jamais.
revoke all on public.document_ingestions from authenticated, anon;
revoke all on public.ingestion_quotas from authenticated, anon;

drop policy if exists ingestion_quotas_self on public.ingestion_quotas;
create policy ingestion_quotas_self on public.ingestion_quotas
  for select using (user_id = auth.uid());

drop policy if exists ingestion_settings_read on public.ingestion_settings;
create policy ingestion_settings_read on public.ingestion_settings
  for select using (auth.uid() is not null);

drop policy if exists ingestion_settings_admin on public.ingestion_settings;
create policy ingestion_settings_admin on public.ingestion_settings
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select on public.ingestion_settings to authenticated;

grant execute on function public.request_document_ingestion(text, text) to authenticated;
grant execute on function public.document_ingestion_state(text) to authenticated;
grant execute on function public.ingestion_quota_left() to authenticated;
grant execute on function public.retry_document_ingestion(text) to authenticated;

-- Le service d'extraction s'authentifie avec la cle de service : ces trois
-- fonctions ne sont accessibles a aucun client.
revoke execute on function public.claim_document_ingestion() from public, authenticated, anon;
revoke execute on function public.complete_document_ingestion(uuid, jsonb, jsonb, text, integer, text, integer, integer)
  from public, authenticated, anon;
revoke execute on function public.fail_document_ingestion(uuid, text)
  from public, authenticated, anon;

commit;
