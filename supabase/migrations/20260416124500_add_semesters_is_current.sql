-- Explicitly track "current semester" per user.
-- Only one semester per user can be current at a time.

alter table public.semesters
  add column if not exists is_current boolean not null default false;

-- Enforce: at most 1 current semester per user.
do $$
begin
  create unique index if not exists semesters_one_current_per_user
    on public.semesters (user_id)
    where is_current;
exception
  when duplicate_object then null;
end $$;

