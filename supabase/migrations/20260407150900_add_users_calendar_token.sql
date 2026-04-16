-- Add per-user secret calendar subscription token.
-- Used by GET /api/calendar/[token].ics (token is authentication).

-- gen_random_uuid() is provided by pgcrypto on Postgres.
create extension if not exists "pgcrypto";

alter table public.users
  add column if not exists calendar_token text;

-- Backfill existing users so every user has a token.
update public.users
  set calendar_token = gen_random_uuid()::text
  where calendar_token is null;

-- Enforce default + non-null going forward.
alter table public.users
  alter column calendar_token set default (gen_random_uuid()::text);

alter table public.users
  alter column calendar_token set not null;

-- Uniqueness: use an index so this is idempotent.
create unique index if not exists users_calendar_token_unique
  on public.users (calendar_token);

