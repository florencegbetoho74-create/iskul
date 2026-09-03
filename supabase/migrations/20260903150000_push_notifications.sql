-- Notifications push serveur.
--
-- Avant : les jetons Expo etaient collectes dans profiles.expo_push_tokens et
-- aucun service ne les consommait. Les seules notifications existantes etaient
-- programmees localement depuis l'ecran d'accueil, donc uniquement si l'eleve
-- ouvrait deja l'application -- ce qui vide l'idee de son interet.
--
-- Apres : les evenements ecrivent dans une file, une Edge Function la draine et
-- envoie a Expo. La file donne le rejeu, l'audit et l'ordre ; un appel HTTP
-- direct depuis un trigger n'aurait offert aucun des trois.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.content_reviews') is null then
    raise exception 'Appliquez d''abord 20260903120000_review_workflow.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Preference utilisateur                                                     */
/* -------------------------------------------------------------------------- */
-- L'ecran Reglages affichait un interrupteur de notifications qui n'etait
-- persiste nulle part. Voici la colonne qui lui manquait.
alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

/* -------------------------------------------------------------------------- */
/* File d'attente                                                             */
/* -------------------------------------------------------------------------- */
create table if not exists public.push_outbox (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  sent_at_ms bigint,
  constraint push_outbox_status_chk check (status in ('pending', 'sent', 'failed'))
);

create index if not exists push_outbox_pending_idx
  on public.push_outbox (created_at_ms)
  where status = 'pending';

create index if not exists push_outbox_user_idx
  on public.push_outbox (user_id, created_at_ms desc);

alter table public.push_outbox enable row level security;

-- La file n'est lisible et modifiable que par le role de service, via l'Edge
-- Function. Aucun client n'y touche.
revoke all on public.push_outbox from anon, authenticated;
revoke all on sequence public.push_outbox_id_seq from anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Mise en file                                                               */
/* -------------------------------------------------------------------------- */
create or replace function public.enqueue_push(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return 0;
  end if;

  -- On n'ecrit que pour les comptes qui ont un jeton et n'ont pas coupe les
  -- notifications : une file pleine de lignes inenvoyables ne sert personne.
  insert into public.push_outbox (user_id, title, body, data)
  select p.id, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p
  where p.id = any(p_user_ids)
    and coalesce(p.notifications_enabled, true)
    and coalesce(array_length(p.expo_push_tokens, 1), 0) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Retrait d'un jeton devenu invalide                                         */
/* -------------------------------------------------------------------------- */
-- Expo repond DeviceNotRegistered pour un jeton mort : le garder ferait
-- echouer chaque envoi suivant.
create or replace function public.remove_push_token(p_token text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
begin
  if coalesce(trim(p_token), '') = '' then
    return 0;
  end if;

  update public.profiles
  set expo_push_tokens = array_remove(expo_push_tokens, trim(p_token))
  where expo_push_tokens @> array[trim(p_token)];

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Decisions de relecture                                                     */
/* -------------------------------------------------------------------------- */
create or replace function public.notify_on_content_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_table text := public.content_table_name(new.content_kind);
  v_owner uuid;
  v_title text;
  v_kind_label text := case new.content_kind
    when 'course' then 'Votre cours'
    when 'book' then 'Votre document'
    else 'Votre quiz'
  end;
begin
  if v_table is null then
    return new;
  end if;

  execute format('select owner_id, title from public.%I where id = $1', v_table)
  into v_owner, v_title
  using new.content_id;

  if v_owner is null then
    return new;
  end if;

  if new.decision = 'published' then
    perform public.enqueue_push(
      array[v_owner],
      'Contenu publie',
      v_kind_label || ' "' || coalesce(v_title, 'sans titre') || '" est en ligne.',
      jsonb_build_object('type', 'review_published', 'kind', new.content_kind, 'id', new.content_id)
    );

  elsif new.decision = 'rejected' then
    perform public.enqueue_push(
      array[v_owner],
      'Modifications demandees',
      v_kind_label || ' "' || coalesce(v_title, 'sans titre') || '" doit etre corrige.',
      jsonb_build_object('type', 'review_rejected', 'kind', new.content_kind, 'id', new.content_id)
    );

  elsif new.decision = 'submitted' then
    -- Une file que personne ne sait pleine ne sera jamais traitee.
    perform public.enqueue_push(
      array(
        select p.id from public.profiles p
        where (p.is_reviewer = true or p.is_admin = true)
          and p.id is distinct from v_owner
      ),
      'Contenu a relire',
      coalesce(v_title, 'Un contenu') || ' attend une relecture.',
      jsonb_build_object('type', 'review_queued', 'kind', new.content_kind, 'id', new.content_id)
    );
  end if;

  return new;
end;
$fn$;

drop trigger if exists content_reviews_notify on public.content_reviews;
create trigger content_reviews_notify
after insert on public.content_reviews
for each row execute function public.notify_on_content_review();

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_recipients uuid[];
  v_sender text;
begin
  select array_agg(pid)
    into v_recipients
  from (
    select unnest(t.participants) as pid
    from public.chat_threads t
    where t.id = new.thread_id
  ) s
  where pid is distinct from new.from_id;

  if v_recipients is null then
    return new;
  end if;

  select coalesce(nullif(trim(p.name), ''), 'Un professeur')
    into v_sender
  from public.profiles p
  where p.id = new.from_id;

  perform public.enqueue_push(
    v_recipients,
    coalesce(v_sender, 'Nouveau message'),
    left(coalesce(nullif(trim(new.text), ''), 'Vous avez recu une piece jointe.'), 140),
    jsonb_build_object('type', 'chat_message', 'threadId', new.thread_id)
  );

  return new;
end;
$fn$;

drop trigger if exists chat_messages_notify on public.chat_messages;
create trigger chat_messages_notify
after insert on public.chat_messages
for each row execute function public.notify_on_chat_message();

/* -------------------------------------------------------------------------- */
/* Live qui demarre                                                           */
/* -------------------------------------------------------------------------- */
create or replace function public.notify_on_live_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status <> 'live' or coalesce(old.status, '') = 'live' then
    return new;
  end if;

  perform public.enqueue_push(
    array(
      select p.id from public.profiles p
      where p.role = 'student'
        and p.id is distinct from new.owner_id
        -- Une seance sans classe s'adresse a tout le monde.
        and (new.grade_level_id is null or p.grade_level_id = new.grade_level_id)
        and (new.country_code is null or p.country_code = new.country_code)
    ),
    'Le live a commence',
    coalesce(new.title, 'Une seance') || ' est en direct maintenant.',
    jsonb_build_object('type', 'live_started', 'liveId', new.id)
  );

  return new;
end;
$fn$;

drop trigger if exists lives_notify_started on public.lives;
create trigger lives_notify_started
after update of status on public.lives
for each row execute function public.notify_on_live_started();

/* -------------------------------------------------------------------------- */
/* Nouveau cours dans sa classe                                               */
/* -------------------------------------------------------------------------- */
create or replace function public.notify_on_course_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status <> 'published' or coalesce(old.status, '') = 'published' then
    return new;
  end if;

  perform public.enqueue_push(
    array(
      select p.id from public.profiles p
      where p.role = 'student'
        and (new.grade_level_id is null or p.grade_level_id = new.grade_level_id)
        and (new.country_code is null or p.country_code = new.country_code)
    ),
    'Nouveau cours disponible',
    coalesce(new.title, 'Un cours') || ' vient d''etre publie pour votre classe.',
    jsonb_build_object('type', 'course_published', 'courseId', new.id)
  );

  return new;
end;
$fn$;

drop trigger if exists courses_notify_published on public.courses;
create trigger courses_notify_published
after update of status on public.courses
for each row execute function public.notify_on_course_published();

/* -------------------------------------------------------------------------- */
/* Preference : lecture et ecriture par l'utilisateur                         */
/* -------------------------------------------------------------------------- */
create or replace function public.set_notifications_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  update public.profiles
  set notifications_enabled = coalesce(p_enabled, true)
  where id = auth.uid();
end;
$fn$;

grant execute on function public.set_notifications_enabled(boolean) to authenticated;

/* -------------------------------------------------------------------------- */
/* Purge                                                                      */
/* -------------------------------------------------------------------------- */
-- Une file qui grossit indefiniment finit par couter plus cher que le service
-- qu'elle rend.
create or replace function public.prune_push_outbox(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cutoff bigint := (extract(epoch from (now() - make_interval(days => greatest(coalesce(p_days, 30), 1)))) * 1000)::bigint;
  v_count integer := 0;
begin
  delete from public.push_outbox
  where status in ('sent', 'failed')
    and created_at_ms < v_cutoff;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Sante de la file                                                           */
/* -------------------------------------------------------------------------- */
-- Si la fonction de drainage n'est pas planifiee, la file grossit sans que
-- personne ne s'en apercoive. Cet indicateur rend la panne visible.
create or replace function public.admin_push_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  payload jsonb;
begin
  perform public.ensure_admin();

  select jsonb_build_object(
    'pending', count(*) filter (where status = 'pending'),
    'failed', count(*) filter (where status = 'failed'),
    'sent', count(*) filter (where status = 'sent'),
    'oldestPendingMs', min(created_at_ms) filter (where status = 'pending'),
    'lastSentMs', max(sent_at_ms) filter (where status = 'sent'),
    'devicesRegistered', (
      select count(*) from public.profiles p
      where coalesce(array_length(p.expo_push_tokens, 1), 0) > 0
    )
  )
  into payload
  from public.push_outbox;

  return coalesce(payload, '{}'::jsonb);
end;
$fn$;

grant execute on function public.admin_push_health() to authenticated;

-- L'Edge Function s'authentifie avec le role de service.
grant execute on function public.remove_push_token(text) to service_role;
grant execute on function public.prune_push_outbox(integer) to service_role;

commit;
