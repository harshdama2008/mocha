-- Lock the client (anon key) out of the settlement pipeline. Every cart
-- mutation — open, scan, correct, exit, dispute, capture — already goes
-- through the Edge Functions in supabase/functions/, which use the
-- service-role key via getSupabaseAdmin() and so bypass RLS entirely. The
-- on-device app (src/lib/supabaseClient.ts) never queries a table directly
-- today, but RLS is the actual enforcement boundary, not "the UI happens
-- not to do that" — this makes it true at the database layer too.
--
-- items is the one table the anon key gets read access to, for a future
-- scan-screen catalog lookup (CLAUDE.md phase 3 currently ships with a
-- small hardcoded list in src/lib/testItems.ts instead). It's a public
-- price list with no per-shopper data in it, so a plain anon SELECT policy
-- is enough — no per-row filtering needed.
--
-- carts, cart_items, exit_events, disputes get RLS enabled with no anon/
-- authenticated policies at all, which denies by default. Nothing needs to
-- change there for that to be correct: this app has no auth/session model
-- (see supabase/config.toml's verify_jwt = false comment), so every read of
-- cart state already happens either inside an Edge Function (service role)
-- or, for scripts/replay-live.ts's own assertions, via its admin client —
-- never via the anon client.

alter table items enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table exit_events enable row level security;
alter table disputes enable row level security;

drop policy if exists items_public_read on items;
create policy items_public_read
  on items
  for select
  to anon, authenticated
  using (true);
