-- Moderation des contenus publies, et traitement des documents sur decision.
--
-- Deux manques signales a l'usage.
--
-- 1. La console listait les contenus publies sans permettre de les ouvrir. Un
--    administrateur voyait un titre et une date, et pouvait depublier -- sans
--    avoir pu regarder ce qu'il depubliait. C'est le meme defaut que la file de
--    relecture avait avant qu'on puisse y voir le contenu.
--
-- 2. Le traitement d'un document partait au depot. Chaque appel etant facture,
--    la decision revient a l'equipe : un document depose attend desormais qu'un
--    administrateur ou un bibliothecaire le lance. Le quota journalier reste,
--    comme garde-fou de second rang.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regprocedure('public.can_review_kind(uuid, text)') is null then
    raise exception 'Appliquez d''abord 20260906090000_staff_roles.sql.';
  end if;
  if to_regprocedure('public.request_document_ingestion(text, text)') is null then
    raise exception 'Appliquez d''abord 20260905090000_document_pipeline.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Ouvrir un contenu pour le moderer                                          */
/* -------------------------------------------------------------------------- */
-- Volontairement plus large que `review_content_detail`, qui ne rend que ce
-- qui attend une decision. Ici on ouvre aussi le publie et le renvoye.
--
-- Le brouillon reste exclu : tant qu'un professeur n'a rien soumis, son travail
-- ne regarde que lui. Un moderateur n'a pas a lire par-dessus son epaule.
create or replace function public.admin_content_detail(
  p_kind text,
  p_content_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_kind text := lower(coalesce(p_kind, ''));
  v_out jsonb;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if not public.can_review_kind(v_user, v_kind) then
    raise exception 'reviewer_only';
  end if;

  if v_kind = 'course' then
    select jsonb_build_object(
      'kind', 'course',
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'level', c.level,
      'subject', c.subject,
      'coverUrl', c.cover_url,
      'ownerName', c.owner_name,
      'status', c.status,
      'published', c.published,
      'updatedAtMs', c.updated_at_ms,
      'chapters', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', ch.id,
            'title', ch.title,
            'orderIndex', ch.order_index,
            'videoUrl', ch.video_url,
            'videoByLang', ch.video_by_lang
          ) order by ch.order_index
        )
        from public.chapters ch where ch.course_id = c.id
      ), '[]'::jsonb)
    )
    into v_out
    from public.courses c
    where c.id = p_content_id and coalesce(c.status, 'draft') <> 'draft';

  elsif v_kind = 'book' then
    select jsonb_build_object(
      'kind', 'book',
      'id', b.id,
      'title', b.title,
      'level', b.level,
      'subject', b.subject,
      'author', b.author,
      'series', b.series,
      'examName', b.exam_name,
      'examYear', b.exam_year,
      'examSession', b.exam_session,
      'coverUrl', b.cover_url,
      'content', b.content,
      'reference', b.reference,
      'ownerName', b.owner_name,
      'status', b.status,
      'published', b.published,
      'updatedAtMs', b.updated_at_ms,
      -- Le fichier d'origine n'est pas rendu ; on dit seulement s'il existe,
      -- ce qui suffit a savoir si le document peut etre traite.
      'hasSource', coalesce(btrim(b.file_url), '') <> '',
      'hasContent', b.content is not null
    )
    into v_out
    from public.books b
    where b.id = p_content_id and coalesce(b.status, 'draft') <> 'draft';

  elsif v_kind = 'quiz' then
    select jsonb_build_object(
      'kind', 'quiz',
      'id', q.id,
      'title', q.title,
      'description', q.description,
      'level', q.level,
      'subject', q.subject,
      'questions', q.questions,
      'ownerName', q.owner_name,
      'status', q.status,
      'published', q.published,
      'updatedAtMs', q.updated_at_ms
    )
    into v_out
    from public.quizzes q
    where q.id = p_content_id and coalesce(q.status, 'draft') <> 'draft';

  else
    raise exception 'type_inconnu';
  end if;

  if v_out is null then
    raise exception 'contenu_introuvable';
  end if;

  return v_out;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Lire un contenu publie, quel que soit son type                             */
/* -------------------------------------------------------------------------- */
-- La politique ouverte au lot precedent ne couvrait que `in_review`. Un
-- moderateur doit aussi pouvoir charger un contenu renvoye a son auteur, pour
-- verifier qu'il a ete corrige.
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select using (
    (published = true and auth.uid() is not null)
    or owner_id = auth.uid()
    or (
      coalesce(status, 'draft') <> 'draft'
      and public.can_review_kind(auth.uid(), 'course')
    )
  );

drop policy if exists books_select on public.books;
create policy books_select on public.books
  for select using (
    (published = true and auth.uid() is not null)
    or owner_id = auth.uid()
    or (
      coalesce(status, 'draft') <> 'draft'
      and public.can_review_kind(auth.uid(), 'book')
    )
  );

/* -------------------------------------------------------------------------- */
/* Le traitement se decide, il ne part plus tout seul                          */
/* -------------------------------------------------------------------------- */
-- Chaque extraction coute un appel facture. Le depot ne la declenche plus :
-- l'equipe bibliotheque choisit ce qui merite d'etre traite, apres avoir vu de
-- quoi il s'agit.
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
  v_limit integer;
  v_used integer;
  v_job uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  -- Un professeur ne lance plus le traitement de son propre depot : seuls un
  -- administrateur et un bibliothecaire le peuvent.
  if not public.can_review_kind(v_user, 'book') then
    raise exception 'droits_insuffisants';
  end if;

  if not exists (select 1 from public.books where id = p_book_id) then
    raise exception 'document_introuvable';
  end if;

  if coalesce(btrim(p_source_url), '') = '' then
    raise exception 'source_manquante';
  end if;

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

-- La console n'a pas a connaitre l'adresse du fichier pour demander son
-- traitement : elle donne l'identifiant, le serveur relit la source.
create or replace function public.admin_request_ingestion(p_book_id text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $fn$
declare
  v_user uuid := auth.uid();
  v_source text;
begin
  if v_user is null or not public.can_review_kind(v_user, 'book') then
    raise exception 'droits_insuffisants';
  end if;

  select file_url into v_source from public.books where id = p_book_id;
  if coalesce(btrim(v_source), '') = '' then
    raise exception 'source_manquante';
  end if;

  return public.request_document_ingestion(p_book_id, v_source);
end;
$fn$;

grant execute on function public.admin_content_detail(text, text) to authenticated;
grant execute on function public.admin_request_ingestion(text) to authenticated;

commit;
