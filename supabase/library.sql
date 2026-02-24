-- Library-focused schema for Supabase (books + purchases + storage policies)
-- Safe to re-run; uses IF NOT EXISTS where possible.

-- Extensions
create extension if not exists "pgcrypto";

-- Helpers
create or replace function public.touch_updated_at_ms()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_at_ms = (extract(epoch from new.updated_at) * 1000)::bigint;
  return new;
end;
$$ language plpgsql;

/* -------------------------------------------------------------------------- */
/* Books                                                                      */
/* -------------------------------------------------------------------------- */
create table if not exists public.books (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subject text,
  level text,
  price numeric(10,2) not null default 0,
  cover_url text,
  file_url text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists books_owner_id_idx on public.books (owner_id);
create index if not exists books_published_idx on public.books (published);
create index if not exists books_updated_at_ms_idx on public.books (updated_at_ms desc);

drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
before update on public.books
for each row execute function public.touch_updated_at_ms();

/* -------------------------------------------------------------------------- */
/* Purchases (tracks paid/free acquisitions)                                  */
/* -------------------------------------------------------------------------- */
create table if not exists public.purchases (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, book_id)
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists purchases_book_id_idx on public.purchases (book_id);

/* -------------------------------------------------------------------------- */
/* Row Level Security                                                         */
/* -------------------------------------------------------------------------- */
alter table public.books enable row level security;
alter table public.purchases enable row level security;

-- Books policies: public reads only on published, full access for owner.
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'books_select') then
    create policy books_select on public.books
      for select using ((published = true and auth.uid() is not null) or owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'books_insert') then
    create policy books_insert on public.books
      for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'books_update') then
    create policy books_update on public.books
      for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'books_delete') then
    create policy books_delete on public.books
      for delete using (owner_id = auth.uid());
  end if;
end $$;

-- Purchases: user-scoped
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'purchases_select') then
    create policy purchases_select on public.purchases
      for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'purchases_insert') then
    create policy purchases_insert on public.purchases
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'purchases_delete') then
    create policy purchases_delete on public.purchases
      for delete using (user_id = auth.uid());
  end if;
end $$;

/* -------------------------------------------------------------------------- */
/* Storage bucket + policies (covers + files)                                 */
/* -------------------------------------------------------------------------- */
insert into storage.buckets (id, name, public)
values ('iskul', 'iskul', true)
on conflict (id) do update set public = excluded.public;

-- Enable RLS on storage.objects if not already, but do not fail if lacking ownership.
do $$
declare
  has_rls boolean;
begin
  select relrowsecurity
    into has_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relname = 'objects' and n.nspname = 'storage';

  if has_rls is distinct from true then
    begin
      execute 'alter table storage.objects enable row level security';
    exception
      when insufficient_privilege then
        raise notice 'Skip: need table owner to enable RLS on storage.objects. Run once with service role.';
    end;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'storage_public_read') then
    create policy storage_public_read on storage.objects
      for select using (bucket_id = 'iskul');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'storage_auth_insert') then
    create policy storage_auth_insert on storage.objects
      for insert with check (auth.uid() is not null and bucket_id = 'iskul');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'storage_auth_update') then
    create policy storage_auth_update on storage.objects
      for update using (auth.uid() = owner and bucket_id = 'iskul')
      with check (auth.uid() = owner and bucket_id = 'iskul');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'storage_auth_delete') then
    create policy storage_auth_delete on storage.objects
      for delete using (auth.uid() = owner and bucket_id = 'iskul');
  end if;
end $$;
