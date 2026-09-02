-- Appairage parent - eleve.
--
-- parent_student_snapshot(email, jours) etait accordee a `anon` : connaitre ou
-- deviner l'adresse e-mail d'un eleve suffisait a obtenir son nom, son ecole,
-- sa classe, son temps d'ecran quotidien et l'historique de ses notes. Sans
-- compte, sans authentification. Il s'agit de donnees de mineurs.
--
-- Remplacement : l'eleve genere un code d'appairage depuis l'application, le
-- parent l'echange une fois contre un jeton d'acces durable, et l'eleve peut
-- revoquer cet acces quand il veut. Aucun compte parent n'est necessaire.
--
-- Idempotent : rejouable sans effet de bord.

begin;

create extension if not exists "pgcrypto";

do $pre$
declare
  v_schema text;
begin
  if to_regclass('public.student_usage_daily') is null then
    raise exception 'Appliquez d''abord supabase/usage.sql.';
  end if;

  -- Supabase installe pgcrypto dans le schema `extensions`, pas dans `public`.
  -- Les fonctions ci-dessous fixent leur search_path : sans le bon schema,
  -- gen_random_bytes() et digest() restent introuvables a l'execution.
  select n.nspname into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_schema is null then
    raise exception 'Extension pgcrypto absente. Activez-la avant cette migration.';
  end if;

  if v_schema not in ('public', 'extensions') then
    raise exception
      'pgcrypto est installee dans le schema %. Ajoutez ce schema au search_path des fonctions d''appairage.',
      v_schema;
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Reprise du DDL utile de l'ancien script                                    */
/* -------------------------------------------------------------------------- */
-- supabase/parental_tracking_portal.sql est supprime du depot : le rejouer
-- recreerait la fonction vulnerable. Ses colonnes et index sont repris ici.
alter table public.student_usage_daily
  add column if not exists lives_joined integer not null default 0;

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists student_usage_day_idx on public.student_usage_daily (day desc);

/* -------------------------------------------------------------------------- */
/* Fermeture de la fuite                                                      */
/* -------------------------------------------------------------------------- */
-- revoke n'accepte pas IF EXISTS : sur une base neuve la fonction est absente.
do $rev$
begin
  if to_regprocedure('public.parent_student_snapshot(text, integer)') is not null then
    execute 'revoke execute on function public.parent_student_snapshot(text, integer) from anon, authenticated';
  end if;
end $rev$;

drop function if exists public.parent_student_snapshot(text, integer);

/* -------------------------------------------------------------------------- */
/* Liens et codes                                                             */
/* -------------------------------------------------------------------------- */
create table if not exists public.parent_links (
  id text primary key default gen_random_uuid()::text,
  student_id uuid not null references auth.users(id) on delete cascade,
  label text,
  token_hash bytea not null,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  last_used_at_ms bigint,
  revoked_at_ms bigint
);

create unique index if not exists parent_links_token_hash_idx on public.parent_links (token_hash);
create index if not exists parent_links_student_idx on public.parent_links (student_id, created_at_ms desc);

create table if not exists public.parent_pairing_codes (
  code text primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  expires_at_ms bigint not null,
  used_at_ms bigint,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists parent_pairing_codes_student_idx
  on public.parent_pairing_codes (student_id, created_at_ms desc);

alter table public.parent_links enable row level security;
alter table public.parent_pairing_codes enable row level security;

-- Aucun acces direct : tout passe par les fonctions ci-dessous.
revoke all on public.parent_links from anon, authenticated;
revoke all on public.parent_pairing_codes from anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Generation du code par l'eleve                                             */
/* -------------------------------------------------------------------------- */
-- Alphabet sans caracteres ambigus : ni O/0, ni I/1, ni S/5.
create or replace function public.generate_pairing_code()
returns text
language plpgsql
volatile
as $fn$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
  v_code text := '';
  i integer;
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
  end loop;
  return v_code;
end;
$fn$;

create or replace function public.create_parent_pairing_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_expires bigint;
  v_tries integer := 0;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  -- Un code en attente est remplace : deux codes valides en meme temps
  -- doublent la surface d'attaque sans rien apporter.
  delete from public.parent_pairing_codes
  where student_id = v_user and used_at_ms is null;

  v_expires := v_now + 15 * 60 * 1000;

  loop
    v_tries := v_tries + 1;
    v_code := public.generate_pairing_code();
    begin
      insert into public.parent_pairing_codes (code, student_id, expires_at_ms, created_at_ms)
      values (v_code, v_user, v_expires, v_now);
      exit;
    exception when unique_violation then
      if v_tries >= 5 then
        raise exception 'code_generation_failed';
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'code', v_code,
    'expiresAtMs', v_expires,
    'validForMinutes', 15
  );
end;
$fn$;

grant execute on function public.create_parent_pairing_code() to authenticated;

/* -------------------------------------------------------------------------- */
/* Echange du code contre un jeton, cote parent                               */
/* -------------------------------------------------------------------------- */
create or replace function public.redeem_parent_pairing_code(
  p_code text,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $fn$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_student uuid;
  v_token text;
  v_link_id text;
  v_name text;
  v_grade text;
begin
  if length(v_code) <> 8 then
    raise exception 'invalid_code';
  end if;

  -- Le code est consomme dans la meme requete que sa verification : deux
  -- parents ne peuvent pas l'echanger simultanement.
  update public.parent_pairing_codes
  set used_at_ms = v_now
  where code = v_code
    and used_at_ms is null
    and expires_at_ms > v_now
  returning student_id into v_student;

  if v_student is null then
    raise exception 'invalid_code';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.parent_links (student_id, label, token_hash, created_at_ms)
  values (
    v_student,
    nullif(trim(coalesce(p_label, '')), ''),
    digest(v_token, 'sha256'),
    v_now
  )
  returning id into v_link_id;

  select coalesce(nullif(trim(p.name), ''), 'Eleve'), p.grade
    into v_name, v_grade
  from public.profiles p
  where p.id = v_student;

  return jsonb_build_object(
    'accessToken', v_token,
    'linkId', v_link_id,
    'studentName', v_name,
    'studentGrade', v_grade
  );
end;
$fn$;

grant execute on function public.redeem_parent_pairing_code(text, text) to anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Suivi parental par jeton                                                    */
/* -------------------------------------------------------------------------- */
create or replace function public.parent_snapshot(
  p_token text,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $fn$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 90));
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_student uuid;
  v_student_name text;
  v_school text;
  v_grade text;
  v_since_date date := current_date - (v_days - 1);
  v_since_ms bigint := (extract(epoch from v_since_date::timestamp) * 1000)::bigint;
  payload jsonb;
begin
  if coalesce(trim(p_token), '') = '' then
    raise exception 'invalid_token';
  end if;

  update public.parent_links
  set last_used_at_ms = v_now
  where token_hash = digest(trim(p_token), 'sha256')
    and revoked_at_ms is null
  returning student_id into v_student;

  if v_student is null then
    raise exception 'invalid_token';
  end if;

  select
    coalesce(nullif(trim(p.name), ''), 'Eleve'),
    p.school,
    p.grade
  into v_student_name, v_school, v_grade
  from public.profiles p
  where p.id = v_student;

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
      on u.user_id = v_student and u.day = d.day
  ),
  quiz_daily as (
    select
      to_timestamp(qa.created_at_ms / 1000.0)::date as day,
      count(*)::integer as attempts,
      coalesce(avg(case when qa.max_score > 0
                        then (qa.score::numeric / qa.max_score::numeric) * 100
                        else null end), 0)::numeric as avg_score_pct
    from public.quiz_attempts qa
    where qa.user_id = v_student
      and qa.status = 'completed'
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
  attempt_stats as (
    select
      count(*)::bigint as attempts,
      round(coalesce(avg(case when qa.max_score > 0
                              then (qa.score::numeric / qa.max_score::numeric) * 100
                              else null end), 0), 2) as avg_pct,
      round(coalesce(max(case when qa.max_score > 0
                              then (qa.score::numeric / qa.max_score::numeric) * 100
                              else null end), 0), 2) as best_pct
    from public.quiz_attempts qa
    where qa.user_id = v_student
      and qa.status = 'completed'
      and qa.created_at_ms >= v_since_ms
  ),
  totals as (
    select jsonb_build_object(
      'timeSpentMs', coalesce(sum(u.time_spent_ms), 0),
      'coursesViewed', coalesce(sum(u.courses_viewed), 0),
      'lessonsViewed', coalesce(sum(u.lessons_viewed), 0),
      'documentsOpened', coalesce(sum(u.documents_opened), 0),
      'livesJoined', coalesce(sum(u.lives_joined), 0),
      'quizAttempts', (select attempts from attempt_stats),
      'quizAvgScorePct', (select avg_pct from attempt_stats),
      'quizBestScorePct', (select best_pct from attempt_stats)
    ) as item
    from usage_rows u
  ),
  recent_quiz as (
    select jsonb_agg(
      jsonb_build_object(
        'quizId', qa.quiz_id,
        'quizTitle', coalesce(qz.title, 'Quiz'),
        'scorePct', round(case when qa.max_score > 0
                               then (qa.score::numeric / qa.max_score::numeric) * 100
                               else 0 end, 2),
        'createdAtMs', qa.created_at_ms
      )
      order by qa.created_at_ms desc
    ) as items
    from (
      select qa.quiz_id, qa.score, qa.max_score, qa.created_at_ms
      from public.quiz_attempts qa
      where qa.user_id = v_student
        and qa.status = 'completed'
        and qa.created_at_ms >= v_since_ms
      order by qa.created_at_ms desc
      limit 30
    ) qa
    left join public.quizzes qz on qz.id = qa.quiz_id
  )
  select jsonb_build_object(
    'student', jsonb_build_object(
      'name', v_student_name,
      'school', v_school,
      'grade', v_grade
    ),
    'periodDays', v_days,
    'generatedAtMs', v_now,
    'totals', coalesce((select item from totals), '{}'::jsonb),
    'timeline', coalesce((select items from timeline), '[]'::jsonb),
    'recentQuizAttempts', coalesce((select items from recent_quiz), '[]'::jsonb)
  )
  into payload;

  return coalesce(payload, '{}'::jsonb);
end;
$fn$;

grant execute on function public.parent_snapshot(text, integer) to anon, authenticated;

/* -------------------------------------------------------------------------- */
/* L'eleve garde la main                                                      */
/* -------------------------------------------------------------------------- */
create or replace function public.my_parent_links()
returns table (
  id text,
  label text,
  created_at_ms bigint,
  last_used_at_ms bigint
)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.id, l.label, l.created_at_ms, l.last_used_at_ms
  from public.parent_links l
  where l.student_id = auth.uid()
    and l.revoked_at_ms is null
  order by l.created_at_ms desc;
$fn$;

create or replace function public.revoke_parent_link(p_link_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  update public.parent_links
  set revoked_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_link_id
    and student_id = auth.uid()
    and revoked_at_ms is null;

  if not found then
    raise exception 'link_not_found';
  end if;
end;
$fn$;

grant execute on function public.my_parent_links() to authenticated;
grant execute on function public.revoke_parent_link(text) to authenticated;

commit;
