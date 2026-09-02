-- Analytics professeur.
--
-- Le tableau de bord interrogeait lesson_progress et quiz_attempts en direct.
-- Les politiques RLS de ces deux tables sont strictement `user_id = auth.uid()`
-- : un professeur ne recevait donc que ses propres lignes, c'est-a-dire aucune.
-- La requete reussissait et renvoyait zero ligne, sans erreur -- d'ou des
-- compteurs a zero pour tout le monde, sur mobile comme sur web.
--
-- Plutot que d'elargir les RLS ligne a ligne (ce qui exposerait la progression
-- d'un eleve a tout professeur), les agregats passent par des fonctions
-- security definer qui verifient que l'appelant possede bien le contenu.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.lesson_progress') is null then
    raise exception 'Table public.lesson_progress introuvable.';
  end if;
  if to_regclass('public.quiz_attempts') is null then
    raise exception 'Table public.quiz_attempts introuvable.';
  end if;
end $pre$;

create index if not exists lesson_progress_course_idx
  on public.lesson_progress (course_id, user_id);

/* -------------------------------------------------------------------------- */
/* Avancement d'une ligne de progression                                      */
/* -------------------------------------------------------------------------- */
-- Une lecon est consideree terminee a 90 % : les generiques de fin et les
-- dernieres secondes ne sont presque jamais regardes.
create or replace function public.lesson_completion_ratio(
  p_watched integer,
  p_duration integer
)
returns numeric
language sql
immutable
as $fn$
  select case
    when coalesce(p_duration, 0) <= 0 then 0::numeric
    else least(greatest(coalesce(p_watched, 0)::numeric / p_duration::numeric, 0), 1)
  end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Tableau de bord du professeur                                              */
/* -------------------------------------------------------------------------- */
create or replace function public.teacher_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 30), 180));
  v_since_ms bigint;
  payload jsonb;
begin
  if v_owner is null then
    raise exception 'auth_required';
  end if;

  v_since_ms := (extract(epoch from (now() - make_interval(days => v_days))) * 1000)::bigint;

  with
  -- Perimetre : uniquement les contenus dont l'appelant est proprietaire.
  my_courses as (
    select c.id, c.title, c.published
    from public.courses c
    where c.owner_id = v_owner
  ),
  my_chapters as (
    select ch.id, ch.course_id, ch.title, ch.order_index
    from public.chapters ch
    join my_courses c on c.id = ch.course_id
  ),
  my_quizzes as (
    select q.id, q.title, q.questions
    from public.quizzes q
    where q.owner_id = v_owner
  ),
  progress as (
    select
      lp.user_id,
      lp.course_id,
      lp.chapter_id,
      public.lesson_completion_ratio(lp.watched_sec, lp.duration_sec) as ratio
    from public.lesson_progress lp
    join my_courses c on c.id = lp.course_id
  ),
  attempts as (
    select
      a.id, a.quiz_id, a.user_id, a.score, a.max_score, a.detail, a.created_at_ms
    from public.quiz_attempts a
    join my_quizzes q on q.id = a.quiz_id
    where a.status = 'completed'
  ),
  recent_attempts as (
    select * from attempts where created_at_ms >= v_since_ms
  ),
  learner_progress as (
    select
      p.user_id,
      avg(p.ratio) as avg_ratio,
      count(*) as rows_count
    from progress p
    group by p.user_id
  ),
  learner_attempts as (
    select a.user_id, count(*)::bigint as attempts
    from attempts a
    group by a.user_id
  ),
  learners as (
    select coalesce(lp.user_id, la.user_id) as user_id,
           lp.avg_ratio,
           coalesce(lp.rows_count, 0) as rows_count,
           coalesce(la.attempts, 0) as attempts
    from learner_progress lp
    full outer join learner_attempts la on la.user_id = lp.user_id
  ),
  -- Une reponse est rattachee a sa question via l'index enregistre par la
  -- correction serveur.
  answer_rows as (
    select
      a.quiz_id,
      (e.value ->> 'questionIndex')::integer as question_index,
      ((e.value ->> 'isCorrect')::boolean) as is_correct
    from attempts a
    cross join lateral jsonb_array_elements(a.detail) e
  ),
  question_stats as (
    select
      r.quiz_id,
      r.question_index,
      count(*)::bigint as answers,
      count(*) filter (where r.is_correct)::bigint as correct
    from answer_rows r
    group by r.quiz_id, r.question_index
  ),
  weak_questions as (
    select jsonb_agg(x order by x_success, x_answers desc) as items
    from (
      select
        jsonb_build_object(
          'quizId', qs.quiz_id,
          'quizTitle', mq.title,
          'questionIndex', qs.question_index,
          'prompt', coalesce(mq.questions -> qs.question_index ->> 'prompt', 'Question'),
          'answers', qs.answers,
          'correct', qs.correct,
          'successRate', round(qs.correct::numeric / nullif(qs.answers, 0), 3)
        ) as x,
        qs.correct::numeric / nullif(qs.answers, 0) as x_success,
        qs.answers as x_answers
      from question_stats qs
      join my_quizzes mq on mq.id = qs.quiz_id
      where qs.answers >= 3
      order by x_success asc, qs.answers desc
      limit 10
    ) ranked
  ),
  at_risk as (
    select jsonb_agg(
      jsonb_build_object(
        'userId', l.user_id,
        'name', coalesce(nullif(trim(p.name), ''), 'Eleve'),
        'completionRate', round(coalesce(l.avg_ratio, 0), 3),
        'attempts', l.attempts
      )
      order by l.avg_ratio asc nulls first
    ) as items
    from (
      select * from learners
      where rows_count >= 2 and coalesce(avg_ratio, 0) < 0.4
      order by avg_ratio asc nulls first
      limit 12
    ) l
    left join public.profiles p on p.id = l.user_id
  ),
  per_course as (
    select jsonb_agg(
      jsonb_build_object(
        'courseId', c.id,
        'title', c.title,
        'published', c.published,
        'learners', coalesce(s.learners, 0),
        'completionRate', round(coalesce(s.avg_ratio, 0), 3)
      )
      order by coalesce(s.learners, 0) desc, c.title
    ) as items
    from my_courses c
    left join (
      select p.course_id,
             count(distinct p.user_id)::bigint as learners,
             avg(p.ratio) as avg_ratio
      from progress p
      group by p.course_id
    ) s on s.course_id = c.id
  ),
  per_chapter as (
    select jsonb_agg(
      jsonb_build_object(
        'chapterId', ch.id,
        'courseId', ch.course_id,
        'title', ch.title,
        'learners', coalesce(s.learners, 0),
        'completionRate', round(coalesce(s.avg_ratio, 0), 3)
      )
      order by coalesce(s.avg_ratio, 0) asc, ch.order_index
    ) as items
    from my_chapters ch
    left join (
      select p.chapter_id,
             count(distinct p.user_id)::bigint as learners,
             avg(p.ratio) as avg_ratio
      from progress p
      group by p.chapter_id
    ) s on s.chapter_id = ch.id
  ),
  per_quiz as (
    select jsonb_agg(
      jsonb_build_object(
        'quizId', q.id,
        'title', q.title,
        'attempts', coalesce(s.attempts, 0),
        'avgScorePct', round(coalesce(s.avg_pct, 0), 1)
      )
      order by coalesce(s.attempts, 0) desc, q.title
    ) as items
    from my_quizzes q
    left join (
      select a.quiz_id,
             count(*)::bigint as attempts,
             avg(case when a.max_score > 0
                      then a.score::numeric / a.max_score::numeric * 100
                      else null end) as avg_pct
      from attempts a
      group by a.quiz_id
    ) s on s.quiz_id = q.id
  ),
  days as (
    select generate_series(
      (current_date - (v_days - 1)),
      current_date,
      interval '1 day'
    )::date as day
  ),
  daily as (
    select jsonb_agg(
      jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'attempts', coalesce(s.attempts, 0),
        'learners', coalesce(s.learners, 0),
        'avgScorePct', round(coalesce(s.avg_pct, 0), 1)
      )
      order by d.day
    ) as items
    from days d
    left join (
      select
        to_timestamp(a.created_at_ms / 1000.0)::date as day,
        count(*)::bigint as attempts,
        count(distinct a.user_id)::bigint as learners,
        avg(case when a.max_score > 0
                 then a.score::numeric / a.max_score::numeric * 100
                 else null end) as avg_pct
      from recent_attempts a
      group by 1
    ) s on s.day = d.day
  ),
  totals as (
    select jsonb_build_object(
      'learners', (select count(*) from learners),
      'completionRate', round(coalesce((select avg(ratio) from progress), 0), 3),
      'lessonsCompleted', (select count(*) from progress where ratio >= 0.9),
      'quizAttempts', (select count(*) from attempts),
      'quizAttemptsRecent', (select count(*) from recent_attempts),
      'atRiskCount', (
        select count(*) from learners
        where rows_count >= 2 and coalesce(avg_ratio, 0) < 0.4
      ),
      'courses', (select count(*) from my_courses),
      'coursesPublished', (select count(*) from my_courses where published),
      'chapters', (select count(*) from my_chapters),
      'quizzes', (select count(*) from my_quizzes)
    ) as item
  )
  select jsonb_build_object(
    'periodDays', v_days,
    'generatedAtMs', (extract(epoch from now()) * 1000)::bigint,
    'totals', (select item from totals),
    'atRiskLearners', coalesce((select items from at_risk), '[]'::jsonb),
    'weakQuestions', coalesce((select items from weak_questions), '[]'::jsonb),
    'courses', coalesce((select items from per_course), '[]'::jsonb),
    'chapters', coalesce((select items from per_chapter), '[]'::jsonb),
    'quizzes', coalesce((select items from per_quiz), '[]'::jsonb),
    'daily', coalesce((select items from daily), '[]'::jsonb)
  )
  into payload;

  return coalesce(payload, '{}'::jsonb);
end;
$fn$;

grant execute on function public.teacher_dashboard(integer) to authenticated;

/* -------------------------------------------------------------------------- */
/* Liste des eleves suivis                                                    */
/* -------------------------------------------------------------------------- */
-- Un professeur ne voit que les eleves ayant reellement travaille sur ses
-- propres contenus : pas d'annuaire general.
create or replace function public.teacher_learners(p_limit integer default 100)
returns table (
  user_id uuid,
  name text,
  grade text,
  completion_rate numeric,
  lessons_started bigint,
  quiz_attempts bigint,
  avg_score_pct numeric,
  last_active_ms bigint
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'auth_required';
  end if;

  return query
  with my_courses as (
    select c.id from public.courses c where c.owner_id = v_owner
  ),
  my_quizzes as (
    select q.id from public.quizzes q where q.owner_id = v_owner
  ),
  progress as (
    select lp.user_id,
           public.lesson_completion_ratio(lp.watched_sec, lp.duration_sec) as ratio,
           lp.updated_at_ms
    from public.lesson_progress lp
    join my_courses c on c.id = lp.course_id
  ),
  attempts as (
    select a.user_id, a.score, a.max_score, a.created_at_ms
    from public.quiz_attempts a
    join my_quizzes q on q.id = a.quiz_id
    where a.status = 'completed'
  ),
  agg as (
    select
      coalesce(p.user_id, a.user_id) as user_id,
      p.ratio_avg,
      coalesce(p.rows_count, 0) as rows_count,
      coalesce(a.attempts, 0) as attempts,
      a.avg_pct,
      greatest(coalesce(p.last_ms, 0), coalesce(a.last_ms, 0)) as last_ms
    from (
      select user_id, avg(ratio) as ratio_avg, count(*)::bigint as rows_count,
             max(updated_at_ms) as last_ms
      from progress group by user_id
    ) p
    full outer join (
      select user_id, count(*)::bigint as attempts,
             avg(case when max_score > 0
                      then score::numeric / max_score::numeric * 100
                      else null end) as avg_pct,
             max(created_at_ms) as last_ms
      from attempts group by user_id
    ) a on a.user_id = p.user_id
  )
  select
    agg.user_id,
    coalesce(nullif(trim(pr.name), ''), 'Eleve') as name,
    pr.grade,
    round(coalesce(agg.ratio_avg, 0), 3) as completion_rate,
    agg.rows_count as lessons_started,
    agg.attempts as quiz_attempts,
    round(coalesce(agg.avg_pct, 0), 1) as avg_score_pct,
    nullif(agg.last_ms, 0) as last_active_ms
  from agg
  left join public.profiles pr on pr.id = agg.user_id
  order by agg.last_ms desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$fn$;

grant execute on function public.teacher_learners(integer) to authenticated;

commit;
