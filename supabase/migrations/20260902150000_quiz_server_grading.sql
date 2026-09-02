-- Correction des quiz cote serveur.
--
-- Avant : les bonnes reponses etaient telechargees avec le quiz, la note etait
-- calculee dans l'application, puis score et max_score inseres directement en
-- base. La politique RLS n'autorisant que `user_id = auth.uid()`, n'importe
-- quel eleve pouvait enregistrer 20/20 sans repondre -- et ces notes alimentent
-- le tableau de bord parental.
--
-- Apres : le corrige ne quitte jamais la base avant que l'eleve ait repondu, la
-- correction est faite par des fonctions serveur, et le client ne peut plus
-- ecrire dans quiz_attempts.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.quizzes') is null then
    raise exception 'Table public.quizzes introuvable.';
  end if;
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Appliquez d''abord supabase/admin_console_portal_migration.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Tentatives multiples et suivi de session                                   */
/* -------------------------------------------------------------------------- */
alter table public.quiz_attempts
  add column if not exists attempt_no integer not null default 1,
  add column if not exists duration_ms bigint,
  add column if not exists detail jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'completed',
  add column if not exists started_at_ms bigint;

-- Une seule tentative par quiz empechait tout reessai, donc toute progression.
alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_quiz_id_user_id_key;

do $chk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_status_chk'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_status_chk check (status in ('in_progress', 'completed'));
  end if;
end $chk$;

create index if not exists quiz_attempts_user_quiz_idx
  on public.quiz_attempts (user_id, quiz_id, created_at_ms desc);

create index if not exists quiz_attempts_open_idx
  on public.quiz_attempts (user_id, quiz_id)
  where status = 'in_progress';

/* -------------------------------------------------------------------------- */
/* Masquage du corrige                                                        */
/* -------------------------------------------------------------------------- */
create or replace function public.strip_quiz_answers(p_questions jsonb)
returns jsonb
language sql
immutable
as $fn$
  select coalesce(
    (
      select jsonb_agg((q - 'correctIndices' - 'correctIndex' - 'explanation') order by ord)
      from jsonb_array_elements(
        case when jsonb_typeof(p_questions) = 'array' then p_questions else '[]'::jsonb end
      ) with ordinality as t(q, ord)
    ),
    '[]'::jsonb
  );
$fn$;

create or replace function public.quiz_correct_indices(p_question jsonb)
returns jsonb
language sql
immutable
as $fn$
  select coalesce(
    p_question -> 'correctIndices',
    case
      when p_question ? 'correctIndex' then jsonb_build_array(p_question -> 'correctIndex')
      else '[]'::jsonb
    end
  );
$fn$;

-- Le corrige devient illisible colonne par colonne. Un `revoke select` sur
-- toute la table casserait les ecritures avec retour (insert ... returning),
-- d'ou le grant colonne a colonne.
revoke select on public.quizzes from anon, authenticated;
grant select (
  id, course_id, chapter_id, level, subject,
  country_code, grade_level_id, subject_id,
  title, description, published, owner_id,
  created_at, updated_at, created_at_ms, updated_at_ms
) on public.quizzes to authenticated;

-- Vue de lecture des quiz. Elle s'execute avec les droits de son proprietaire,
-- puisqu'elle doit lire la colonne `questions` interdite a tous : les regles de
-- visibilite sont donc portees par son WHERE, et non par les politiques RLS.
drop view if exists public.quizzes_readable;
create view public.quizzes_readable as
select
  q.id,
  q.course_id,
  q.chapter_id,
  q.level,
  q.subject,
  q.country_code,
  q.grade_level_id,
  q.subject_id,
  q.title,
  q.description,
  q.published,
  q.owner_id,
  q.created_at_ms,
  q.updated_at_ms,
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
/* Correction serveur, par session                                            */
/* -------------------------------------------------------------------------- */
-- L'ecran eleve donne un retour apres chaque question, sons compris. Comme le
-- corrige ne descend plus au client, ce retour doit venir du serveur.
--
-- Une simple fonction "cette reponse est-elle juste ?" serait sondable : quatre
-- appels suffiraient a trouver la bonne reponse avant de repondre. La reponse
-- est donc figee des le premier envoi pour une question donnee ; reappeler
-- renvoie le meme resultat sans rien modifier.

create or replace function public.start_quiz_attempt(p_quiz_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_questions jsonb;
  v_published boolean;
  v_owner uuid;
  v_attempt_id text;
  v_attempt_no integer;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select q.questions, q.published, q.owner_id
    into v_questions, v_published, v_owner
  from public.quizzes q
  where q.id = p_quiz_id;

  if v_questions is null then
    raise exception 'quiz_not_found';
  end if;
  if not v_published and v_owner is distinct from v_user then
    raise exception 'quiz_not_published';
  end if;

  -- Une tentative laissee ouverte est reprise plutot que dupliquee.
  select a.id, a.attempt_no
    into v_attempt_id, v_attempt_no
  from public.quiz_attempts a
  where a.quiz_id = p_quiz_id
    and a.user_id = v_user
    and a.status = 'in_progress'
  order by a.created_at_ms desc
  limit 1;

  if v_attempt_id is null then
    select coalesce(max(a.attempt_no), 0) + 1
      into v_attempt_no
    from public.quiz_attempts a
    where a.quiz_id = p_quiz_id and a.user_id = v_user;

    insert into public.quiz_attempts (
      quiz_id, user_id, answers, score, max_score, attempt_no,
      status, started_at_ms, detail, created_at_ms
    )
    values (
      p_quiz_id, v_user, '[]'::jsonb, 0, jsonb_array_length(v_questions),
      v_attempt_no, 'in_progress', v_now, '[]'::jsonb, v_now
    )
    returning id into v_attempt_id;
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'attemptNo', v_attempt_no,
    'questionCount', jsonb_array_length(v_questions)
  );
end;
$fn$;

create or replace function public.answer_quiz_question(
  p_attempt_id text,
  p_question_index integer,
  p_chosen_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_quiz_id text;
  v_status text;
  v_detail jsonb;
  v_questions jsonb;
  v_correct jsonb;
  v_existing jsonb;
  v_is_correct boolean;
  v_entry jsonb;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select a.quiz_id, a.status, a.detail
    into v_quiz_id, v_status, v_detail
  from public.quiz_attempts a
  where a.id = p_attempt_id and a.user_id = v_user;

  if v_quiz_id is null then
    raise exception 'attempt_not_found';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'attempt_closed';
  end if;

  select q.questions into v_questions
  from public.quizzes q
  where q.id = v_quiz_id;

  if p_question_index < 0 or p_question_index >= jsonb_array_length(v_questions) then
    raise exception 'question_out_of_range';
  end if;

  -- Reponse deja enregistree : on renvoie le meme resultat, sans reecriture.
  select e.value
    into v_existing
  from jsonb_array_elements(v_detail) e
  where (e.value ->> 'questionIndex')::integer = p_question_index
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_correct := public.quiz_correct_indices(v_questions -> p_question_index);
  v_is_correct := p_chosen_index is not null
    and v_correct @> to_jsonb(array[p_chosen_index]);

  v_entry := jsonb_build_object(
    'questionIndex', p_question_index,
    'chosenIndex', p_chosen_index,
    'correctIndices', v_correct,
    'isCorrect', coalesce(v_is_correct, false)
  );

  update public.quiz_attempts
  set detail = detail || v_entry
  where id = p_attempt_id;

  return v_entry;
end;
$fn$;

create or replace function public.finish_quiz_attempt(p_attempt_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_quiz_id text;
  v_detail jsonb;
  v_started bigint;
  v_max integer;
  v_score integer;
  v_attempt_no integer;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select a.quiz_id, a.detail, a.started_at_ms, a.max_score, a.attempt_no
    into v_quiz_id, v_detail, v_started, v_max, v_attempt_no
  from public.quiz_attempts a
  where a.id = p_attempt_id and a.user_id = v_user;

  if v_quiz_id is null then
    raise exception 'attempt_not_found';
  end if;

  select count(*)::integer
    into v_score
  from jsonb_array_elements(v_detail) e
  where (e.value ->> 'isCorrect')::boolean;

  update public.quiz_attempts
  set status = 'completed',
      score = v_score,
      answers = (
        select coalesce(
          jsonb_agg(
            jsonb_build_array(e.value -> 'chosenIndex')
            order by (e.value ->> 'questionIndex')::integer
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(v_detail) e
      ),
      duration_ms = case when v_started is null then null else greatest(v_now - v_started, 0) end,
      created_at_ms = v_now
  where id = p_attempt_id;

  return jsonb_build_object(
    'attemptId', p_attempt_id,
    'quizId', v_quiz_id,
    'score', v_score,
    'maxScore', v_max,
    'attemptNo', v_attempt_no,
    'detail', v_detail
  );
end;
$fn$;

grant execute on function public.start_quiz_attempt(text) to authenticated;
grant execute on function public.answer_quiz_question(text, integer, integer) to authenticated;
grant execute on function public.finish_quiz_attempt(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* Le client n'ecrit plus dans quiz_attempts                                  */
/* -------------------------------------------------------------------------- */
drop policy if exists quiz_attempts_insert on public.quiz_attempts;
drop policy if exists quiz_attempts_update on public.quiz_attempts;
drop policy if exists quiz_attempts_delete on public.quiz_attempts;

-- La lecture de ses propres tentatives reste ouverte : l'eleve doit pouvoir
-- revoir son historique. L'ecriture passe exclusivement par les fonctions.
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Historique des tentatives                                                  */
/* -------------------------------------------------------------------------- */
create or replace function public.my_quiz_attempts(p_quiz_id text)
returns table (
  id text,
  attempt_no integer,
  score integer,
  max_score integer,
  duration_ms bigint,
  status text,
  detail jsonb,
  created_at_ms bigint
)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, a.attempt_no, a.score, a.max_score, a.duration_ms,
         a.status, a.detail, a.created_at_ms
  from public.quiz_attempts a
  where a.quiz_id = p_quiz_id
    and a.user_id = auth.uid()
    and a.status = 'completed'
  order by a.created_at_ms desc;
$fn$;

grant execute on function public.my_quiz_attempts(text) to authenticated;

commit;
