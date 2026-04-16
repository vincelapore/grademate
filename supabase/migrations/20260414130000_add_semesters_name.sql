-- Add a human-friendly name for semester/grouping.
alter table public.semesters
  add column if not exists name text;

