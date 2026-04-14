-- Enforce RLS on semesters and prevent free users
-- from inserting multiple semesters via direct Supabase client calls.
--
-- Policy logic:
-- - All users can read/write only their own semesters.
-- - INSERT is allowed if:
--   - auth.uid() = user_id AND
--   - user is pro OR they have zero existing semesters.

-- Helper: whether a user can create a new semester.
-- SECURITY DEFINER so it can read tables regardless of RLS (typical Supabase pattern).
create or replace function public.gm_can_create_semester(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_count int;
begin
  select plan into v_plan
  from public.users
  where id = p_user_id;

  if v_plan = 'pro' then
    return true;
  end if;

  select count(*) into v_count
  from public.semesters
  where user_id = p_user_id;

  return coalesce(v_count, 0) < 1;
end;
$$;

-- Lock down the function surface.
revoke all on function public.gm_can_create_semester(uuid) from public;
grant execute on function public.gm_can_create_semester(uuid) to authenticated;

-- Enable RLS for semesters if not already enabled.
alter table public.semesters enable row level security;

-- Basic ownership policies.
drop policy if exists "Users can view own semesters" on public.semesters;
create policy "Users can view own semesters"
  on public.semesters for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own semesters" on public.semesters;
create policy "Users can insert own semesters"
  on public.semesters for insert
  with check (auth.uid() = user_id and public.gm_can_create_semester(auth.uid()));

drop policy if exists "Users can update own semesters" on public.semesters;
create policy "Users can update own semesters"
  on public.semesters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own semesters" on public.semesters;
create policy "Users can delete own semesters"
  on public.semesters for delete
  using (auth.uid() = user_id);

