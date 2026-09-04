-- Le code d'appairage parent devient imprevisible, et les tentatives sont
-- bornees.
--
-- Deux defauts qui se combinaient.
--
-- 1. `generate_pairing_code` tirait ses caracteres avec `random()`, le
--    generateur pseudo-aleatoire de PostgreSQL. Il n'est pas cryptographique :
--    sa suite est deterministe a partir d'une graine, et deux codes emis dans
--    la meme session sont lies. Pour un code qui ouvre l'acces aux resultats
--    scolaires d'un mineur, c'est la mauvaise primitive.
--
-- 2. `redeem_parent_pairing_code` est accessible a `anon` -- il le faut, un
--    parent n'a pas forcement de compte -- et rien ne limitait les tentatives.
--    Un code faible et un nombre d'essais illimite ne se compensent pas : ils
--    se multiplient.
--
-- Ce que la correction ne change pas : le code reste a usage unique, expirant,
-- et la table demeure inaccessible aux clients.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('public.parent_pairing_codes') is null then
    raise exception 'Appliquez d''abord 20260902210000_parent_pairing.sql.';
  end if;
  -- pgcrypto vit dans le schema `extensions` chez Supabase. Sans lui,
  -- gen_random_bytes n'existe pas et la correction serait sans effet.
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null
     and to_regprocedure('public.gen_random_bytes(integer)') is null then
    raise exception 'pgcrypto est absent : create extension pgcrypto with schema extensions;';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Un code reellement imprevisible                                            */
/* -------------------------------------------------------------------------- */
-- L'alphabet reste le meme : trente caracteres sans I, O, S ni 0, 1, 5, pour
-- qu'un code se dicte au telephone sans confusion. Huit caracteres donnent
-- 6,5 x 10^11 combinaisons -- assez, mais seulement si le tirage est vraiment
-- aleatoire.
create or replace function public.generate_pairing_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $fn$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
  v_len integer := length(v_alphabet);
  v_code text := '';
  v_bytes bytea;
  i integer;
begin
  -- Un octet par caractere, tire de la source cryptographique du systeme.
  v_bytes := gen_random_bytes(8);
  for i in 1..8 loop
    -- Le modulo introduit un biais negligeable ici : 256 n'est pas un multiple
    -- de 30, mais l'ecart de probabilite entre caracteres reste sous 4 %, sans
    -- effet exploitable sur un code a usage unique et de courte duree.
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i - 1) % v_len), 1);
  end loop;
  return v_code;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* Bornage des tentatives                                                     */
/* -------------------------------------------------------------------------- */
-- On ne dispose pas de l'adresse de l'appelant depuis une procedure. Le
-- compteur est donc global : il ne distingue pas qui echoue, mais il rend une
-- attaque automatisee impraticable, ce qui est le but.
--
-- Un parent qui se trompe une fois n'est jamais gene : le seuil est haut au
-- regard d'un usage humain, bas au regard d'un script.
create table if not exists public.pairing_attempts (
  -- Une ligne par minute civile.
  minute_bucket bigint primary key,
  failures integer not null default 0
);

alter table public.pairing_attempts enable row level security;
revoke all on public.pairing_attempts from anon, authenticated;

create or replace function public.note_pairing_failure()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bucket bigint := floor(extract(epoch from now()) / 60)::bigint;
begin
  insert into public.pairing_attempts (minute_bucket, failures)
  values (v_bucket, 1)
  on conflict (minute_bucket) do update set failures = public.pairing_attempts.failures + 1;

  -- Le journal ne sert qu'a la minute en cours : au-dela, il n'apprend rien et
  -- grossirait sans fin.
  delete from public.pairing_attempts where minute_bucket < v_bucket - 5;
end;
$fn$;

create or replace function public.pairing_is_throttled()
returns boolean
language sql
stable
set search_path = public
as $fn$
  select coalesce(
    (select failures from public.pairing_attempts
     where minute_bucket = floor(extract(epoch from now()) / 60)::bigint),
    0
  ) >= 30;
$fn$;

/* -------------------------------------------------------------------------- */
/* L'echange verifie la cadence avant de comparer le code                     */
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

  -- La cadence se verifie avant toute comparaison : sinon le refus lui-meme
  -- servirait d'oracle a qui teste des codes en boucle.
  if public.pairing_is_throttled() then
    raise exception 'trop_de_tentatives';
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
    perform public.note_pairing_failure();
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
revoke execute on function public.note_pairing_failure() from anon, authenticated;
revoke execute on function public.pairing_is_throttled() from anon, authenticated;

commit;
