-- Un relecteur peut enfin lire ce qu'on lui demande de juger.
--
-- Le circuit de relecture etait casse de bout en bout, et pas seulement
-- depourvu d'ecran : la politique de lecture des cours n'autorisait que
-- `published = true or owner_id = auth.uid()`. Un relecteur ne pouvait donc pas
-- charger un cours en attente -- il decidait de publier ou de renvoyer sur la
-- seule foi d'un titre et d'un nom d'auteur. Meme chose pour les documents et
-- les quiz.
--
-- Ce que ces politiques ouvrent est etroit, volontairement :
--
--   - uniquement `status = 'in_review'`. Un brouillon ne regarde que son
--     auteur : tant qu'il n'a pas ete soumis, personne d'autre n'a a le lire.
--   - uniquement pour le type que le relecteur a le droit de juger. Un
--     bibliothecaire voit les documents, pas les cours. `can_review_kind`
--     porte deja cette regle, elle n'est pas reecrite ici.
--   - en lecture seule. Publier ou renvoyer reste le fait de `review_content`,
--     qui verifie le droit et ecrit le motif.
--
-- Le quiz fait exception a une regle du produit : ses bonnes reponses sont
-- normalement retirees avant d'atteindre un client. Un relecteur doit les voir
-- -- juger un quiz sans connaitre les reponses attendues n'a aucun sens.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regprocedure('public.can_review_kind(uuid, text)') is null then
    raise exception 'Appliquez d''abord 20260906090000_staff_roles.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Cours en attente de decision                                               */
/* -------------------------------------------------------------------------- */
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select using (
    (published = true and auth.uid() is not null)
    or owner_id = auth.uid()
    or (status = 'in_review' and public.can_review_kind(auth.uid(), 'course'))
  );

-- Un cours se juge par ses chapitres : les rendre invisibles reviendrait a
-- n'ouvrir que la fiche.
drop policy if exists chapters_select on public.chapters;
create policy chapters_select on public.chapters
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = course_id
        and (
          (c.published = true and auth.uid() is not null)
          or c.owner_id = auth.uid()
          or (c.status = 'in_review' and public.can_review_kind(auth.uid(), 'course'))
        )
    )
  );

/* -------------------------------------------------------------------------- */
/* Documents en attente de decision                                           */
/* -------------------------------------------------------------------------- */
drop policy if exists books_select on public.books;
create policy books_select on public.books
  for select using (
    (published = true and auth.uid() is not null)
    or owner_id = auth.uid()
    or (status = 'in_review' and public.can_review_kind(auth.uid(), 'book'))
  );

/* -------------------------------------------------------------------------- */
/* Quiz en attente de decision                                                */
/* -------------------------------------------------------------------------- */
-- La condition d'origine exigeait en plus que le cours porteur soit lisible.
-- Elle est conservee telle quelle et la branche du relecteur s'ajoute a cote :
-- un quiz en relecture se lit meme si son cours ne l'est pas encore, sans quoi
-- un quiz rattache a un cours lui-meme en attente resterait invisible.
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes
  for select using (
    (
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
        or (course_id is null and auth.uid() is not null)
      )
    )
    or (status = 'in_review' and public.can_review_kind(auth.uid(), 'quiz'))
  );

/* -------------------------------------------------------------------------- */
/* Ce que le relecteur a sous les yeux                                        */
/* -------------------------------------------------------------------------- */
-- Une procedure rassemble le contenu a juger en un appel. Les politiques
-- ci-dessus suffiraient a le lire table par table ; les reunir evite trois
-- allers-retours et, surtout, garantit que la console montre la meme chose que
-- ce que le relecteur decide.
create or replace function public.review_content_detail(
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
      'gradeLevelId', c.grade_level_id,
      'subjectId', c.subject_id,
      'coverUrl', c.cover_url,
      'ownerName', c.owner_name,
      'status', c.status,
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
    where c.id = p_content_id and c.status = 'in_review';

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
      'documentTypeId', b.document_type_id,
      'coverUrl', b.cover_url,
      -- `content` porte les blocs structures, `reference` la fiche
      -- d'etablissement. `file_url` n'est pas rendu : le relecteur juge le
      -- contenu converti, pas le fichier d'origine.
      'content', b.content,
      'reference', b.reference,
      'ownerName', b.owner_name,
      'status', b.status,
      'updatedAtMs', b.updated_at_ms
    )
    into v_out
    from public.books b
    where b.id = p_content_id and b.status = 'in_review';

  elsif v_kind = 'quiz' then
    select jsonb_build_object(
      'kind', 'quiz',
      'id', q.id,
      'title', q.title,
      'description', q.description,
      'level', q.level,
      'subject', q.subject,
      'courseId', q.course_id,
      'chapterId', q.chapter_id,
      -- Les bonnes reponses sont incluses : sans elles, il n'y a rien a juger.
      'questions', q.questions,
      'ownerName', q.owner_name,
      'status', q.status,
      'updatedAtMs', q.updated_at_ms
    )
    into v_out
    from public.quizzes q
    where q.id = p_content_id and q.status = 'in_review';

  else
    raise exception 'type_inconnu';
  end if;

  if v_out is null then
    raise exception 'contenu_introuvable';
  end if;

  return v_out;
end;
$fn$;

grant execute on function public.review_content_detail(text, text) to authenticated;

commit;
