-- Les fichiers cessent d'etre publics.
--
-- Etat d'origine : le bucket `iskul` etait declare public, et la politique de
-- lecture disait `bucket_id = 'iskul'` sans le moindre controle. N'importe qui,
-- sans compte, telechargeait n'importe quel fichier des lors qu'il en
-- connaissait l'adresse -- et cette adresse etait stockee en clair dans
-- `books.file_url`, lisible par tout compte connecte.
--
-- Retirer les boutons de telechargement avait ferme l'interface. Cela n'avait
-- jamais ferme le fichier.
--
-- Ce que fait cette migration :
--
--   - le bucket devient prive ; les URL publiques cessent de repondre ;
--   - `storage.objects` recoit une politique qui reproduit les regles du
--     contenu : on lit ce qu'on a depose, ce qui est publie, ou ce qu'on a le
--     droit de relire ;
--   - les tables gardent le chemin du fichier, et non plus son adresse
--     publique. Le client demande une URL signee au moment de lire.
--
-- Le chemin est deduit des adresses deja enregistrees : rien n'est perdu.
--
-- Idempotent : rejouable sans effet de bord.

begin;

do $pre$
begin
  if to_regclass('storage.objects') is null then
    raise exception 'Le schema storage est absent.';
  end if;
  if to_regprocedure('public.can_review_kind(uuid, text)') is null then
    raise exception 'Appliquez d''abord 20260906090000_staff_roles.sql.';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Les tables gardent un chemin, pas une adresse                              */
/* -------------------------------------------------------------------------- */
alter table public.books add column if not exists storage_path text;
alter table public.chapters add column if not exists storage_path text;

/*
 * Extrait le chemin d'une adresse Supabase Storage.
 *
 * Les adresses enregistrees prennent deux formes selon qu'elles viennent d'une
 * URL publique ou d'une URL signee. Les deux portent le chemin apres le nom du
 * bucket, et c'est la seule partie qui compte.
 */
create or replace function public.storage_path_from_url(p_url text, p_bucket text default 'iskul')
returns text
language sql
immutable
as $fn$
  select case
    when p_url is null or btrim(p_url) = '' then null
    -- .../object/public/<bucket>/<chemin>  ou  .../object/sign/<bucket>/<chemin>
    when p_url ~ ('/object/(public|sign)/' || p_bucket || '/')
      then split_part(
             regexp_replace(p_url, '^.*/object/(public|sign)/' || p_bucket || '/', ''),
             '?', 1
           )
    else null
  end;
$fn$;

-- Retrocompatibilite : les lignes existantes recoivent leur chemin sans qu'on
-- ait a redeposer quoi que ce soit.
update public.books
set storage_path = public.storage_path_from_url(file_url)
where storage_path is null and public.storage_path_from_url(file_url) is not null;

update public.chapters
set storage_path = public.storage_path_from_url(video_url)
where storage_path is null and public.storage_path_from_url(video_url) is not null;

create index if not exists books_storage_path_idx
  on public.books (storage_path) where storage_path is not null;
create index if not exists chapters_storage_path_idx
  on public.chapters (storage_path) where storage_path is not null;

/* -------------------------------------------------------------------------- */
/* Le bucket devient prive                                                    */
/* -------------------------------------------------------------------------- */
update storage.buckets set public = false where id = 'iskul';

/* -------------------------------------------------------------------------- */
/* Qui peut lire quel objet                                                   */
/* -------------------------------------------------------------------------- */
-- La regle reproduit celle du contenu. Elle ne peut pas etre plus permissive :
-- une URL signee ne s'obtient qu'en passant par cette politique.
create or replace function public.can_read_media(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $fn$
  select
    auth.uid() is not null
    and (
      -- Un document publie, ou en attente de relecture pour qui la relit.
      exists (
        select 1 from public.books b
        where b.storage_path = p_path
          and (
            b.published = true
            or b.owner_id = auth.uid()
            or (
              coalesce(b.status, 'draft') <> 'draft'
              and public.can_review_kind(auth.uid(), 'book')
            )
          )
      )
      -- Une video de chapitre, selon l'etat du cours qui la porte.
      or exists (
        select 1
        from public.chapters ch
        join public.courses c on c.id = ch.course_id
        where ch.storage_path = p_path
          and (
            c.published = true
            or c.owner_id = auth.uid()
            or (
              coalesce(c.status, 'draft') <> 'draft'
              and public.can_review_kind(auth.uid(), 'course')
            )
          )
      )
      -- Les vignettes de couverture accompagnent un contenu publie.
      or exists (
        select 1 from public.books b
        where public.storage_path_from_url(b.cover_url) = p_path and b.published = true
      )
      or exists (
        select 1 from public.courses c
        where public.storage_path_from_url(c.cover_url) = p_path and c.published = true
      )
      -- Un avatar : chacun voit celui des autres, c'est le principe.
      or p_path like 'avatars/%'
    );
$fn$;

drop policy if exists storage_public_read on storage.objects;
drop policy if exists storage_read_scoped on storage.objects;
create policy storage_read_scoped on storage.objects
  for select using (
    bucket_id = 'iskul'
    and (
      -- Celui qui a depose garde toujours acces a son fichier, meme le temps
      -- que le contenu qui le porte soit cree.
      owner = auth.uid()
      or public.can_read_media(name)
    )
  );

-- Le depot reste ouvert a tout compte connecte : c'est l'ecriture du contenu
-- qui decide ensuite qui pourra lire.
drop policy if exists storage_auth_insert on storage.objects;
create policy storage_auth_insert on storage.objects
  for insert with check (auth.uid() is not null and bucket_id = 'iskul');

grant execute on function public.can_read_media(text) to authenticated;
grant execute on function public.storage_path_from_url(text, text) to authenticated;

commit;
