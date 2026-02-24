-- Migration: parental tracking snapshot by student email
-- Safe to re-run.

begin;

alter table public.student_usage_daily
  add column if not exists lives_joined integer not null default 0;

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists student_usage_day_idx on public.student_usage_daily (day desc);

create or replace function public.parent_student_snapshot(
  p_student_email text,
  p_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_student_email, '')));
  v_days integer := greatest(1, least(coalesce(p_days, 7), 60));
  v_student_id uuid;
  v_student_name text;
  v_school text;
  v_grade text;
  v_since_date date := current_date - (v_days - 1);
  v_since_ms bigint := (extract(epoch from v_since_date::timestamp) * 1000)::bigint;
  payload jsonb;
begin
  if v_email = '' then
    raise exception 'missing_email';
  end if;

  select
    p.id,
    coalesce(nullif(trim(p.name), ''), split_part(v_email, '@', 1)),
    p.school,
    p.grade
  into
    v_student_id,
    v_student_name,
    v_school,
    v_grade
  from public.profiles p
  where lower(coalesce(p.email, '')) = v_email
  order by p.updated_at_ms desc nulls last
  limit 1;

  if v_student_id is null then
    raise exception 'student_not_found';
  end if;

  with days as (
    select generate_series(v_since_date, current_date, interval '1 day')::date as day
  ),
  usage_rows as (
    select
      d.day,
      coalesce(u.time_spent_ms, 0)::bigint as time_spent_ms,
      coalesce(u.courses_viewed, 0)::integer as courses_viewed,
      coalesce(u.lessons_viewed, 0)::integer as lessons_viewed,
      coalesce(u.documents_opened, 0)::integer as documents_opened,
      coalesce(u.lives_joined, 0)::integer as lives_joined
    from days d
    left join public.student_usage_daily u
      on u.user_id = v_student_id
     and u.day = d.day
    order by d.day
  ),
  quiz_daily as (
    select
      to_timestamp(qa.created_at_ms / 1000.0)::date as day,
      count(*)::integer as attempts,
      coalesce(
        avg(
          case
            when qa.max_score > 0 then (qa.score::numeric / qa.max_score::numeric) * 100
            else null
          end
        ),
        0
      )::numeric as avg_score_pct
    from public.quiz_attempts qa
    where qa.user_id = v_student_id
      and qa.created_at_ms >= v_since_ms
    group by 1
  ),
  timeline as (
    select jsonb_agg(
      jsonb_build_object(
        'day', to_char(u.day, 'YYYY-MM-DD'),
        'timeSpentMs', u.time_spent_ms,
        'coursesViewed', u.courses_viewed,
        'lessonsViewed', u.lessons_viewed,
        'documentsOpened', u.documents_opened,
        'livesJoined', u.lives_joined,
        'quizAttempts', coalesce(q.attempts, 0),
        'quizAvgScorePct', round(coalesce(q.avg_score_pct, 0), 2)
      )
      order by u.day
    ) as items
    from usage_rows u
    left join quiz_daily q on q.day = u.day
  ),
  totals as (
    select jsonb_build_object(
      'timeSpentMs', coalesce(sum(u.time_spent_ms), 0),
      'coursesViewed', coalesce(sum(u.courses_viewed), 0),
      'lessonsViewed', coalesce(sum(u.lessons_viewed), 0),
      'documentsOpened', coalesce(sum(u.documents_opened), 0),
      'livesJoined', coalesce(sum(u.lives_joined), 0),
      'quizAttempts', coalesce(
        (
          select count(*)::bigint
          from public.quiz_attempts qa
          where qa.user_id = v_student_id
            and qa.created_at_ms >= v_since_ms
        ),
        0
      ),
      'quizAvgScorePct', coalesce(
        (
          select round(
            avg(
              case
                when qa.max_score > 0 then (qa.score::numeric / qa.max_score::numeric) * 100
                else null
              end
            ),
            2
          )
          from public.quiz_attempts qa
          where qa.user_id = v_student_id
            and qa.created_at_ms >= v_since_ms
        ),
        0
      ),
      'quizBestScorePct', coalesce(
        (
          select round(
            max(
              case
                when qa.max_score > 0 then (qa.score::numeric / qa.max_score::numeric) * 100
                else null
              end
            ),
            2
          )
          from public.quiz_attempts qa
          where qa.user_id = v_student_id
            and qa.created_at_ms >= v_since_ms
        ),
        0
      )
    ) as item
    from usage_rows u
  ),
  recent_quiz as (
    select jsonb_agg(
      jsonb_build_object(
        'quizId', qa.quiz_id,
        'quizTitle', coalesce(qz.title, 'Quiz'),
        'scorePct', round(
          case
            when qa.max_score > 0 then (qa.score::numeric / qa.max_score::numeric) * 100
            else 0
          end,
          2
        ),
        'createdAtMs', qa.created_at_ms
      )
      order by qa.created_at_ms desc
    ) as items
    from (
      select qa.quiz_id, qa.score, qa.max_score, qa.created_at_ms
      from public.quiz_attempts qa
      where qa.user_id = v_student_id
        and qa.created_at_ms >= v_since_ms
      order by qa.created_at_ms desc
      limit 30
    ) qa
    left join public.quizzes qz on qz.id = qa.quiz_id
  )
  select jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student_id,
      'name', v_student_name,
      'email', v_email,
      'school', v_school,
      'grade', v_grade
    ),
    'periodDays', v_days,
    'generatedAtMs', (extract(epoch from now()) * 1000)::bigint,
    'totals', coalesce((select item from totals), '{}'::jsonb),
    'timeline', coalesce((select items from timeline), '[]'::jsonb),
    'recentQuizAttempts', coalesce((select items from recent_quiz), '[]'::jsonb)
  )
  into payload;

  return coalesce(payload, '{}'::jsonb);
end;
$$;

grant execute on function public.parent_student_snapshot(text, integer) to anon;
grant execute on function public.parent_student_snapshot(text, integer) to authenticated;

commit;
