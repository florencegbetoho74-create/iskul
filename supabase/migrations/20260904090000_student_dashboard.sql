-- Tableau de bord de l'eleve.
--
-- L'accueil etait un second catalogue : arbres deplians par niveau et matiere,
-- qui doublaient l'onglet Cours. Il devient un point de depart personnel --
-- reprendre, ce qu'il reste a faire, la progression de la semaine.
--
-- Une seule fonction plutot que six requetes : sur une connexion mobile
-- beninoise, six allers-retours se voient.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.lesson_progress') is null then
    raise exception 'Table public.lesson_progress introuvable.';
  end if;
  if to_regclass('public.grade_levels') is null then
    raise exception 'Appliquez d''abord 20260902090000_referentials.sql.';
  end if;
end $pre$;

create or replace function public.student_dashboard(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 7), 30));
  v_grade uuid;
  v_country text;
  v_since_date date := current_date - (v_days - 1);
  v_since_ms bigint;
  payload jsonb;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  v_since_ms := (extract(epoch from v_since_date::timestamp) * 1000)::bigint;

  select p.grade_level_id, p.country_code
    into v_grade, v_country
  from public.profiles p
  where p.id = v_user;

  with
  -- Perimetre de l'eleve : sa classe, ou les contenus tous niveaux.
  my_courses as (
    select c.id, c.title, c.subject, c.level, c.cover_url, c.updated_at_ms
    from public.courses c
    where c.status = 'published'
      and (v_grade is null or c.grade_level_id is null or c.grade_level_id = v_grade)
      and (v_country is null or c.country_code is null or c.country_code = v_country)
  ),
  -- Derniere lecon commencee mais pas finie : c'est elle qu'on propose de
  -- reprendre, pas la plus recente tous etats confondus.
  resume as (
    select jsonb_build_object(
      'courseId', lp.course_id,
      'courseTitle', c.title,
      'lessonId', lp.chapter_id,
      'lessonTitle', ch.title,
      'watchedSec', lp.watched_sec,
      'durationSec', lp.duration_sec,
      'percent', round(public.lesson_completion_ratio(lp.watched_sec, lp.duration_sec), 3),
      'updatedAtMs', lp.updated_at_ms
    ) as item
    from public.lesson_progress lp
    join public.courses c on c.id = lp.course_id
    join public.chapters ch on ch.id = lp.chapter_id
    where lp.user_id = v_user
      and c.status = 'published'
      and public.lesson_completion_ratio(lp.watched_sec, lp.duration_sec) between 0.02 and 0.95
    order by lp.updated_at_ms desc
    limit 1
  ),
  days as (
    select generate_series(v_since_date, current_date, interval '1 day')::date as day
  ),
  weekly as (
    select jsonb_agg(
      jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'minutes', round(coalesce(u.time_spent_ms, 0) / 60000.0)::integer,
        'lessons', coalesce(u.lessons_viewed, 0)
      )
      order by d.day
    ) as items
    from days d
    left join public.student_usage_daily u
      on u.user_id = v_user and u.day = d.day
  ),
  attempts as (
    select qa.quiz_id, qa.score, qa.max_score, qa.created_at_ms
    from public.quiz_attempts qa
    where qa.user_id = v_user and qa.status = 'completed'
  ),
  -- Quiz publies de sa classe qu'il n'a jamais termines.
  pending as (
    select jsonb_agg(
      jsonb_build_object(
        'quizId', q.id,
        'title', q.title,
        'subject', q.subject,
        'courseId', q.course_id
      )
      order by q.updated_at_ms desc
    ) as items
    from (
      select qz.id, qz.title, qz.subject, qz.course_id, qz.updated_at_ms
      from public.quizzes qz
      where qz.status = 'published'
        and (v_grade is null or qz.grade_level_id is null or qz.grade_level_id = v_grade)
        and (v_country is null or qz.country_code is null or qz.country_code = v_country)
        and not exists (select 1 from attempts a where a.quiz_id = qz.id)
      order by qz.updated_at_ms desc
      limit 5
    ) q
  ),
  next_live as (
    select jsonb_build_object(
      'liveId', l.id,
      'title', l.title,
      'startAtMs', l.start_at_ms,
      'status', l.status,
      'ownerName', l.owner_name
    ) as item
    from public.lives l
    where l.status in ('scheduled', 'live')
      and l.start_at_ms >= (extract(epoch from now()) * 1000)::bigint - 2 * 3600 * 1000
      and (v_grade is null or l.grade_level_id is null or l.grade_level_id = v_grade)
      and (v_country is null or l.country_code is null or l.country_code = v_country)
    order by l.start_at_ms
    limit 1
  ),
  -- Nouveautes que l'eleve n'a pas encore ouvertes.
  fresh as (
    select jsonb_agg(
      jsonb_build_object(
        'courseId', c.id,
        'title', c.title,
        'subject', c.subject,
        'coverUrl', c.cover_url
      )
      order by c.updated_at_ms desc
    ) as items
    from (
      select mc.*
      from my_courses mc
      where not exists (
        select 1 from public.lesson_progress lp
        where lp.user_id = v_user and lp.course_id = mc.id
      )
      order by mc.updated_at_ms desc
      limit 6
    ) c
  ),
  totals as (
    select jsonb_build_object(
      'minutesThisPeriod', (
        select round(coalesce(sum(u.time_spent_ms), 0) / 60000.0)::integer
        from public.student_usage_daily u
        where u.user_id = v_user and u.day >= v_since_date
      ),
      'lessonsCompleted', (
        select count(*) from public.lesson_progress lp
        where lp.user_id = v_user
          and public.lesson_completion_ratio(lp.watched_sec, lp.duration_sec) >= 0.9
      ),
      'quizAttempts', (select count(*) from attempts),
      'quizAvgScorePct', (
        select round(coalesce(avg(
          case when a.max_score > 0 then a.score::numeric / a.max_score::numeric * 100 else null end
        ), 0), 1)
        from attempts a
        where a.created_at_ms >= v_since_ms
      ),
      'coursesAvailable', (select count(*) from my_courses)
    ) as item
  )
  select jsonb_build_object(
    'periodDays', v_days,
    'generatedAtMs', (extract(epoch from now()) * 1000)::bigint,
    'totals', (select item from totals),
    'resume', coalesce((select item from resume), 'null'::jsonb),
    'weekly', coalesce((select items from weekly), '[]'::jsonb),
    'pendingQuizzes', coalesce((select items from pending), '[]'::jsonb),
    'nextLive', coalesce((select item from next_live), 'null'::jsonb),
    'freshCourses', coalesce((select items from fresh), '[]'::jsonb)
  )
  into payload;

  return coalesce(payload, '{}'::jsonb);
end;
$fn$;

grant execute on function public.student_dashboard(integer) to authenticated;

commit;
