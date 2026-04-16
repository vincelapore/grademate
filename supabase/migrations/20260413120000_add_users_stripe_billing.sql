-- Stripe customer + subscription linkage for webhooks and Checkout reuse.
alter table public.users
  add column if not exists stripe_customer_id text;

alter table public.users
  add column if not exists stripe_subscription_id text;

create unique index if not exists users_stripe_customer_id_unique
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;
