-- Salle de classe en direct : identite, presence, chat, main levee, moderation.
--
-- Avant : la salle affichait "Participant 1042318" -- l'identifiant numerique
-- Agora derive de l'UUID. Le professeur ne savait pas qui etait present, aucun
-- eleve ne pouvait poser une question ecrite, personne ne pouvait lever la main
-- et rien ne permettait de couper un micro. La video fonctionnait ; la classe,
-- non.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.lives') is null then
    raise exception 'Table public.lives introuvable.';
  end if;
  if to_regprocedure('public.enqueue_push(uuid[], text, text, jsonb)') is null then
    raise exception 'Appliquez d''abord 20260903150000_push_notifications.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Presence                                                                   */
/* -------------------------------------------------------------------------- */
create table if not exists public.live_participants (
  id text primary key default gen_random_uuid()::text,
  live_id text not null references public.lives(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- L'identifiant numerique Agora, seul lien entre un flux video et une
  -- personne. Sans lui, la salle ne peut afficher que des nombres.
  agora_uid bigint,
  display_name text not null,
  role text not null default 'attendee',
  joined_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  left_at_ms bigint,
  last_seen_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  hand_raised_at_ms bigint,
  muted_by_host boolean not null default false,
  is_banned boolean not null default false,
  total_ms bigint not null default 0,
  unique (live_id, user_id),
  constraint live_participants_role_chk check (role in ('host', 'attendee'))
);

create index if not exists live_participants_live_idx
  on public.live_participants (live_id, joined_at_ms);
create index if not exists live_participants_agora_idx
  on public.live_participants (live_id, agora_uid);
create index if not exists live_participants_hand_idx
  on public.live_participants (live_id, hand_raised_at_ms)
  where hand_raised_at_ms is not null;

/* -------------------------------------------------------------------------- */
/* Chat de seance                                                             */
/* -------------------------------------------------------------------------- */
create table if not exists public.live_messages (
  id text primary key default gen_random_uuid()::text,
  live_id text not null references public.lives(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  text text not null,
  is_host boolean not null default false,
  at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  constraint live_messages_text_chk check (length(btrim(text)) between 1 and 1000)
);

create index if not exists live_messages_live_idx on public.live_messages (live_id, at_ms);

/* -------------------------------------------------------------------------- */
/* Acces                                                                      */
/* -------------------------------------------------------------------------- */
alter table public.live_participants enable row level security;
alter table public.live_messages enable row level security;

create or replace function public.is_live_host(p_live_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.lives l
    where l.id = p_live_id and l.owner_id = p_user_id
  );
$fn$;

create or replace function public.is_in_live(p_live_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.live_participants p
    where p.live_id = p_live_id
      and p.user_id = p_user_id
      and p.is_banned = false
  );
$fn$;

-- La liste des presents n'est visible que de l'interieur de la salle.
drop policy if exists live_participants_select on public.live_participants;
create policy live_participants_select on public.live_participants
  for select using (
    user_id = auth.uid()
    or public.is_live_host(live_id, auth.uid())
    or public.is_in_live(live_id, auth.uid())
  );

drop policy if exists live_messages_select on public.live_messages;
create policy live_messages_select on public.live_messages
  for select using (
    public.is_live_host(live_id, auth.uid())
    or public.is_in_live(live_id, auth.uid())
  );

-- Toutes les ecritures passent par les fonctions : c'est la qu'on verifie
-- l'exclusion, le bannissement et le statut de la seance.
revoke insert, update, delete on public.live_participants from anon, authenticated;
revoke insert, update, delete on public.live_messages from anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Entrer et sortir                                                           */
/* -------------------------------------------------------------------------- */
create or replace function public.join_live(
  p_live_id text,
  p_agora_uid bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_name text;
  v_role text;
  v_banned boolean;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  select l.owner_id, l.status into v_owner, v_status
  from public.lives l where l.id = p_live_id;

  if v_owner is null then
    raise exception 'live_not_found';
  end if;
  if v_status = 'ended' then
    raise exception 'live_ended';
  end if;

  select coalesce(p.is_banned, false) into v_banned
  from public.live_participants p
  where p.live_id = p_live_id and p.user_id = v_uid;

  if coalesce(v_banned, false) then
    raise exception 'participant_banned';
  end if;

  select coalesce(nullif(trim(pr.name), ''), 'Participant')
    into v_name
  from public.profiles pr where pr.id = v_uid;

  v_role := case when v_owner = v_uid then 'host' else 'attendee' end;

  insert into public.live_participants (
    live_id, user_id, agora_uid, display_name, role, joined_at_ms, last_seen_ms
  )
  values (p_live_id, v_uid, p_agora_uid, coalesce(v_name, 'Participant'), v_role, v_now, v_now)
  on conflict (live_id, user_id) do update
  set agora_uid = coalesce(excluded.agora_uid, public.live_participants.agora_uid),
      display_name = excluded.display_name,
      role = excluded.role,
      -- Une reconnexion ne remet pas le compteur a zero : on cumule le temps
      -- deja passe pour que la feuille de presence reste juste.
      total_ms = public.live_participants.total_ms
        + case
            when public.live_participants.left_at_ms is null
              then greatest(v_now - public.live_participants.last_seen_ms, 0)
            else 0
          end,
      joined_at_ms = coalesce(public.live_participants.joined_at_ms, v_now),
      left_at_ms = null,
      last_seen_ms = v_now;

  return jsonb_build_object('role', v_role, 'joinedAtMs', v_now);
end;
$fn$;

create or replace function public.heartbeat_live(p_live_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if auth.uid() is null then
    return;
  end if;

  update public.live_participants
  set total_ms = total_ms + greatest(v_now - last_seen_ms, 0),
      last_seen_ms = v_now
  where live_id = p_live_id
    and user_id = auth.uid()
    and left_at_ms is null;
end;
$fn$;

create or replace function public.leave_live(p_live_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if auth.uid() is null then
    return;
  end if;

  update public.live_participants
  set total_ms = total_ms + greatest(v_now - last_seen_ms, 0),
      last_seen_ms = v_now,
      left_at_ms = v_now,
      hand_raised_at_ms = null
  where live_id = p_live_id
    and user_id = auth.uid()
    and left_at_ms is null;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Lever la main                                                              */
/* -------------------------------------------------------------------------- */
create or replace function public.set_hand_raised(
  p_live_id text,
  p_raised boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  update public.live_participants
  set hand_raised_at_ms = case
    when coalesce(p_raised, false) then (extract(epoch from now()) * 1000)::bigint
    else null
  end
  where live_id = p_live_id and user_id = auth.uid();

  if not found then
    raise exception 'not_in_live';
  end if;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */
create or replace function public.moderate_live_participant(
  p_live_id text,
  p_user_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_uid is null or not public.is_live_host(p_live_id, v_uid) then
    raise exception 'host_only';
  end if;
  if p_user_id = v_uid then
    raise exception 'cannot_moderate_self';
  end if;
  if v_action not in ('mute', 'unmute', 'lower_hand', 'kick') then
    raise exception 'invalid_action';
  end if;

  if v_action = 'mute' then
    update public.live_participants set muted_by_host = true
    where live_id = p_live_id and user_id = p_user_id;

  elsif v_action = 'unmute' then
    update public.live_participants set muted_by_host = false
    where live_id = p_live_id and user_id = p_user_id;

  elsif v_action = 'lower_hand' then
    update public.live_participants set hand_raised_at_ms = null
    where live_id = p_live_id and user_id = p_user_id;

  elsif v_action = 'kick' then
    -- Exclure sans bannir laisserait l'eleve revenir aussitot.
    update public.live_participants
    set is_banned = true,
        left_at_ms = v_now,
        hand_raised_at_ms = null,
        total_ms = total_ms + greatest(v_now - last_seen_ms, 0),
        last_seen_ms = v_now
    where live_id = p_live_id and user_id = p_user_id;
  end if;

  if not found then
    raise exception 'participant_not_found';
  end if;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */
create or replace function public.post_live_message(
  p_live_id text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
  v_name text;
  v_is_host boolean;
  v_row public.live_messages;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;
  if length(v_text) = 0 then
    raise exception 'empty_message';
  end if;
  if length(v_text) > 1000 then
    v_text := left(v_text, 1000);
  end if;

  v_is_host := public.is_live_host(p_live_id, v_uid);

  if not v_is_host and not public.is_in_live(p_live_id, v_uid) then
    raise exception 'not_in_live';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Participant')
    into v_name
  from public.live_participants
  where live_id = p_live_id and user_id = v_uid;

  insert into public.live_messages (live_id, user_id, author_name, text, is_host)
  values (p_live_id, v_uid, coalesce(v_name, 'Participant'), v_text, v_is_host)
  returning * into v_row;

  return to_jsonb(v_row);
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Feuille de presence                                                        */
/* -------------------------------------------------------------------------- */
create or replace function public.live_attendance(p_live_id text)
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at_ms bigint,
  left_at_ms bigint,
  total_ms bigint,
  is_banned boolean,
  still_present boolean
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null or not public.is_live_host(p_live_id, auth.uid()) then
    raise exception 'host_only';
  end if;

  return query
  select
    p.user_id,
    p.display_name,
    p.role,
    p.joined_at_ms,
    p.left_at_ms,
    p.total_ms + case
      when p.left_at_ms is null
        then greatest((extract(epoch from now()) * 1000)::bigint - p.last_seen_ms, 0)
      else 0
    end as total_ms,
    p.is_banned,
    (p.left_at_ms is null and not p.is_banned) as still_present
  from public.live_participants p
  where p.live_id = p_live_id
  order by p.joined_at_ms;
end;
$fn$;

grant execute on function public.join_live(text, bigint) to authenticated;
grant execute on function public.heartbeat_live(text) to authenticated;
grant execute on function public.leave_live(text) to authenticated;
grant execute on function public.set_hand_raised(text, boolean) to authenticated;
grant execute on function public.moderate_live_participant(text, uuid, text) to authenticated;
grant execute on function public.post_live_message(text, text) to authenticated;
grant execute on function public.live_attendance(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* Diffusion temps reel                                                       */
/* -------------------------------------------------------------------------- */
-- Sans ces publications, la salle devrait interroger la base en boucle.
do $pub$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.live_participants;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.live_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $pub$;

commit;
