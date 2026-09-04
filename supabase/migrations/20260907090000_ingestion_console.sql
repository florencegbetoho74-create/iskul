-- La console voit et debloque la chaine de traitement des documents.
--
-- Le journal des traitements etait volontairement ferme a tout client : il
-- porte l'adresse du PDF d'origine, qui ne doit jamais atteindre un navigateur.
-- La consequence n'avait pas ete tiree : personne ne pouvait voir qu'une
-- extraction avait echoue, ni la relancer. Un document depose restait en panne
-- sans que quiconque l'apprenne.
--
-- Ces procedures rendent le journal lisible sans jamais rendre `source_url`.
-- C'est la meme regle que pour `document_ingestion_state` : on renseigne
-- l'operateur, on ne lui donne pas le fichier.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.document_ingestions') is null then
    raise exception 'Appliquez d''abord 20260905090000_document_pipeline.sql.';
  end if;
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Appliquez d''abord supabase/admin_console_portal_migration.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Etat de la file                                                            */
/* -------------------------------------------------------------------------- */
-- Les compteurs d'abord : c'est ce qu'on regarde en arrivant, et cela suffit a
-- savoir si la chaine tourne.
create or replace function public.admin_ingestion_health()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_admin(v_user) then
    raise exception 'admin_only';
  end if;

  return jsonb_build_object(
    'queued',  (select count(*) from public.document_ingestions where state = 'queued'),
    'running', (select count(*) from public.document_ingestions where state = 'running'),
    'failed',  (select count(*) from public.document_ingestions where state = 'failed'),
    'done',    (select count(*) from public.document_ingestions where state = 'done'),
    -- Un travail en attente depuis longtemps signale que la fonction planifiee
    -- ne tourne plus : c'est la panne la plus courante et la plus silencieuse.
    'oldestQueuedMs', (
      select min(created_at_ms) from public.document_ingestions where state = 'queued'
    ),
    -- Le cout consomme, sans lequel la depense reste invisible jusqu'a la
    -- facture.
    'inputTokens',  (select coalesce(sum(input_tokens), 0) from public.document_ingestions),
    'outputTokens', (select coalesce(sum(output_tokens), 0) from public.document_ingestions)
  );
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Le detail, sans l'adresse du fichier                                       */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_list_ingestions(
  p_state text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  book_id text,
  book_title text,
  state text,
  requested_by uuid,
  requester_name text,
  page_count integer,
  block_count integer,
  figure_count integer,
  error text,
  attempts integer,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at_ms bigint,
  finished_at_ms bigint
)
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_admin(v_user) then
    raise exception 'admin_only';
  end if;

  -- source_url est absente de la liste des colonnes rendues. Ce n'est pas un
  -- oubli : c'est ce qui garantit que l'adresse du PDF ne quitte pas le
  -- serveur, quelle que soit la page qui appelle.
  return query
  select
    i.id,
    i.book_id,
    b.title,
    i.state,
    i.requested_by,
    coalesce(p.name, p.email, 'Compte supprime'),
    i.page_count,
    i.block_count,
    i.figure_count,
    i.error,
    i.attempts,
    i.model,
    i.input_tokens,
    i.output_tokens,
    i.created_at_ms,
    i.finished_at_ms
  from public.document_ingestions i
  left join public.books b on b.id = i.book_id
  left join public.profiles p on p.id = i.requested_by
  where p_state is null or i.state = p_state
  order by
    -- Les echecs remontent : ce sont eux qui demandent une decision.
    case i.state when 'failed' then 0 when 'queued' then 1 when 'running' then 2 else 3 end,
    i.created_at_ms desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Bornes de depense                                                          */
/* -------------------------------------------------------------------------- */
create or replace function public.admin_get_ingestion_settings()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_row public.ingestion_settings;
begin
  if v_user is null or not public.is_admin(v_user) then
    raise exception 'admin_only';
  end if;

  select * into v_row from public.ingestion_settings where id = true;
  return jsonb_build_object(
    'dailyLimit', coalesce(v_row.daily_limit, 0),
    'reviewerDailyLimit', coalesce(v_row.reviewer_daily_limit, 0),
    'maxPages', coalesce(v_row.max_pages, 0)
  );
end;
$fn$;

create or replace function public.admin_update_ingestion_settings(
  p_daily_limit integer,
  p_reviewer_daily_limit integer,
  p_max_pages integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_admin(v_user) then
    raise exception 'admin_only';
  end if;

  -- Les bornes sont verifiees ici et non seulement par la contrainte : un
  -- message lisible vaut mieux qu'une violation de contrainte remontee brute.
  if p_daily_limit < 0 or p_reviewer_daily_limit < 0 then
    raise exception 'limite_negative';
  end if;
  if p_max_pages < 1 then
    raise exception 'pages_minimum';
  end if;

  update public.ingestion_settings
  set daily_limit = p_daily_limit,
      reviewer_daily_limit = p_reviewer_daily_limit,
      max_pages = p_max_pages,
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = true;

  return public.admin_get_ingestion_settings();
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Droits                                                                     */
/* -------------------------------------------------------------------------- */
grant execute on function public.admin_ingestion_health() to authenticated;
grant execute on function public.admin_list_ingestions(text, integer) to authenticated;
grant execute on function public.admin_get_ingestion_settings() to authenticated;
grant execute on function public.admin_update_ingestion_settings(integer, integer, integer)
  to authenticated;

-- Le journal lui-meme reste ferme : les procedures ci-dessus sont la seule
-- facon de le lire, et elles ne rendent jamais source_url.
revoke all on public.document_ingestions from authenticated, anon;

commit;
