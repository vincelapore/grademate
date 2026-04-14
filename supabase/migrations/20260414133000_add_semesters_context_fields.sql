-- Store locked scraper context per semester-group.
alter table public.semesters
  add column if not exists context_university text,
  add column if not exists context_year integer,
  add column if not exists context_semester integer,
  add column if not exists context_mode text;

do $$
begin
  alter table public.semesters
    add constraint semesters_context_mode_check
    check (context_mode in ('freeform', 'scraper'));
exception
  when duplicate_object then null;
end $$;

