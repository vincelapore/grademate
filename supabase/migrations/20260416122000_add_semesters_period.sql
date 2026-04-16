-- Add structured period to semesters for "current semester" detection.
-- Period options:
-- Semester 1, Semester 2, Trimester 1, Trimester 2, Trimester 3, Summer, Winter

alter table public.semesters
  add column if not exists period text;

-- Backfill existing rows from legacy integer `semester` where possible.
update public.semesters
set period = case
  when period is not null and btrim(period) <> '' then period
  when semester = 1 then 'Semester 1'
  when semester = 2 then 'Semester 2'
  when semester = 3 then 'Trimester 3'
  else 'Semester 1'
end;

do $$
begin
  alter table public.semesters
    alter column period set not null;
exception
  when others then null;
end $$;

do $$
begin
  alter table public.semesters
    add constraint semesters_period_check
    check (period in ('Semester 1', 'Semester 2', 'Trimester 1', 'Trimester 2', 'Trimester 3', 'Summer', 'Winter'));
exception
  when duplicate_object then null;
end $$;

