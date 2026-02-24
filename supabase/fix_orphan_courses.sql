-- Fix orphan/invalid course owners (supports legacy text owner_id)
-- Safe to re-run.

do $$
declare
  col_type text;
  fallback_teacher uuid;
  fallback_name text;
begin
  select data_type
    into col_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'courses'
     and column_name = 'owner_id';

  if col_type is null then
    raise exception 'Column public.courses.owner_id not found.';
  end if;

  select p.id, p.name
    into fallback_teacher, fallback_name
    from public.profiles p
   where p.role = 'teacher'
   order by p.updated_at_ms desc nulls last
   limit 1;

  if fallback_teacher is null then
    raise exception 'No teacher profile found. Create one or set a fallback id manually.';
  end if;

  if col_type = 'uuid' then
    update public.courses c
       set owner_id = fallback_teacher,
           owner_name = coalesce(owner_name, fallback_name)
     where owner_id is null
        or not exists (select 1 from auth.users u where u.id = c.owner_id);
  elsif col_type in ('text', 'character varying') then
    alter table public.courses add column if not exists owner_id_uuid uuid;

    update public.courses c
       set owner_id_uuid = coalesce(
         case
           when c.owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then c.owner_id::uuid
         end,
         (select p.id from public.profiles p where lower(p.email) = lower(c.owner_id) limit 1),
         (select p.id from public.profiles p where p.name = c.owner_name limit 1),
         fallback_teacher
       );

    update public.courses c
       set owner_name = coalesce(c.owner_name, (select p.name from public.profiles p where p.id = c.owner_id_uuid))
     where c.owner_id_uuid is not null;

    alter table public.courses drop column owner_id;
    alter table public.courses rename column owner_id_uuid to owner_id;
    alter table public.courses alter column owner_id set not null;

    begin
      alter table public.courses
        add constraint courses_owner_id_fkey foreign key (owner_id)
        references auth.users(id) on delete cascade;
    exception when duplicate_object then
      null;
    end;

    create index if not exists courses_owner_id_idx on public.courses (owner_id);
  else
    raise exception 'Unsupported owner_id type: %', col_type;
  end if;
end $$;
