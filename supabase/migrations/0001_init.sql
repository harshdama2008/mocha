-- Mocha schema: items, carts, cart_items, exit_events, disputes.
--
-- Cart status is a hard invariant (see CLAUDE.md): it only ever moves
-- open -> pending_capture -> settled OR open -> pending_capture -> disputed.
-- Never backwards, never skipping pending_capture. The trigger below
-- enforces that at the database layer as a second line of defense behind
-- the application-level state machine in src/server/cartService.ts.

create extension if not exists pgcrypto;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open', 'pending_capture', 'settled', 'disputed')),
  -- Stripe identifiers needed to authorize off_session on scan, i.e. without
  -- the shopper re-entering a card at checkout (there is no checkout screen).
  stripe_customer_id text,
  stripe_payment_method_id text,
  opened_at timestamptz not null default now(),
  pending_capture_at timestamptz,
  capture_due_at timestamptz,
  settled_at timestamptz,
  disputed_at timestamptz
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id),
  item_id uuid not null references items(id),
  scanned_at timestamptz not null default now(),
  -- One authorization per scan (hard invariant #2). Nullable only until the
  -- authorize call returns; voided_at marks a pre-capture correction such as
  -- the Goodwin Hall double-scan, which cancels this PaymentIntent instead
  -- of capturing it.
  stripe_payment_intent_id text,
  voided_at timestamptz
);

create table if not exists exit_events (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id),
  method text not null,
  confirmed_at timestamptz not null default now()
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id),
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists cart_items_cart_id_idx on cart_items(cart_id);
create index if not exists exit_events_cart_id_idx on exit_events(cart_id);
create index if not exists disputes_cart_id_idx on disputes(cart_id);

create or replace function enforce_cart_status_transition()
returns trigger as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'open' and new.status = 'pending_capture' then
    return new;
  end if;

  if old.status = 'pending_capture' and new.status in ('settled', 'disputed') then
    return new;
  end if;

  raise exception 'invalid cart status transition: % -> %', old.status, new.status;
end;
$$ language plpgsql;

drop trigger if exists cart_status_transition on carts;
create trigger cart_status_transition
  before update of status on carts
  for each row
  execute function enforce_cart_status_transition();
