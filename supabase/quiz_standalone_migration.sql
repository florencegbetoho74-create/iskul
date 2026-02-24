-- Migration: enable standalone quizzes (not attached to a course chapter)
-- Safe to run multiple times.

begin;

alter table public.quizzes
  alter column course_id drop not null,
  alter column chapter_id drop not null;

alter table public.quizzes
  add column if not exists level text,
  add column if not exists subject text;

-- Backfill classification from linked courses when missing.
update public.quizzes q
set
  level = coalesce(nullif(trim(q.level), ''), c.level),
  subject = coalesce(nullif(trim(q.subject), ''), c.subject)
from public.courses c
where q.course_id = c.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_scope_shape_chk'
      and conrelid = 'public.quizzes'::regclass
  ) then
    alter table public.quizzes
      add constraint quizzes_scope_shape_chk check (
        (course_id is not null and chapter_id is not null)
        or
        (course_id is null and chapter_id is null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_standalone_classification_chk'
      and conrelid = 'public.quizzes'::regclass
  ) then
    alter table public.quizzes
      add constraint quizzes_standalone_classification_chk check (
        course_id is not null
        or
        (coalesce(trim(level), '') <> '' and coalesce(trim(subject), '') <> '')
      );
  end if;
end $$;

create index if not exists quizzes_level_idx on public.quizzes (level);
create index if not exists quizzes_subject_idx on public.quizzes (subject);

drop policy if exists quizzes_select on public.quizzes;
drop policy if exists quizzes_insert on public.quizzes;

create policy quizzes_select on public.quizzes
  for select using (
    (published = true or owner_id = auth.uid())
    and (
      (
        course_id is not null
        and exists (
          select 1 from public.courses c
          where c.id = course_id
            and ((c.published = true and auth.uid() is not null) or c.owner_id = auth.uid())
        )
      )
      or
      (course_id is null and auth.uid() is not null)
    )
  );

create policy quizzes_insert on public.quizzes
  for insert with check (
    owner_id = auth.uid()
    and (
      (
        course_id is not null
        and chapter_id is not null
        and exists (
          select 1 from public.courses c
          where c.id = course_id and c.owner_id = auth.uid()
        )
      )
      or
      (course_id is null and chapter_id is null)
    )
  );

commit;
