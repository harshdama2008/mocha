// Live mirror of replayer/scenarios/*.ts, run against the deployed
// functions and the real database instead of the in-memory fakes.
//
//   node --env-file=.env --import tsx scripts/replay-live.ts
//
// Requires MOCHA_KIOSK_STRIPE_CUSTOMER_ID / MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID
// (see scripts/deploy-secrets.js) already set as function secrets, the
// functions deployed, and the capture-sweep cron migration applied
// (0002_capture_sweep_cron.sql).
//
// This isn't a literal reuse of replayer/engine.ts's synthetic-clock event
// interpreter: on a real backend "at: 90_000" isn't a wall-clock offset you'd
// want to sleep for. It previously tried to reconstruct the server's
// correction window client-side via a MOCHA_CORRECTION_WINDOW_MS env var —
// that value only ever existed as a Supabase secret (set to 8000ms) and was
// never in .env, so it silently fell back to a local default of 5000ms.
// That guess was ~3s short of the real window, so this script's own
// capture-sweep calls were consistently too early and correctly told "not
// due yet"; the cart only ever actually settled once the once-a-minute cron
// fallback got to it, up to ~60s later — which is exactly the intermittent,
// timing-dependent failures this was producing. Polling for the expected
// status instead of guessing a sleep duration removes the need for this
// script to know the server's window at all.
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const POLL_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 5_000;
// Only used for a *negative* check (still pending_capture mid-window) where
// being early is the point — comfortably shorter than any real window
// (default 10 minutes, or the 8s override currently set live), never used
// to predict when something should have already happened.
const SAFELY_MID_WINDOW_MS = 2_000;

// Node 20 doesn't expose the native WebSocket global @supabase/realtime-js
// checks for (that lands in Node 22), so supabase-js prints a warning and
// would otherwise fail to construct its realtime layer. This script never
// uses realtime — only functions.invoke and table reads — but the client
// still needs a transport passed explicitly to satisfy that check. This
// only affects this standalone Node script; the on-device app runs in a
// browser/RN environment with a native WebSocket already.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ws's
// WebSocket type and realtime-js's WebSocketLikeConstructor structurally
// disagree on event-handler signatures even though ws is exactly what
// realtime-js asks for at runtime; this is a known type-only interop gap
// between the two packages, not a real type error.
const realtimeOptions = { transport: WebSocket as any };

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY must be set (run with node --env-file=.env)'
  );
}

// anon: exactly what the app uses. admin (service role): verification only, never shipped on-device.
const anon = createClient(url, anonKey, { realtime: realtimeOptions });
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
  realtime: realtimeOptions,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await anon.functions.invoke(name, { body });
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

async function invokeExpectError(name: string, body: Record<string, unknown>): Promise<void> {
  const { error } = await anon.functions.invoke(name, { body });
  assert(error, `expected ${name} to reject`);
}

async function getCartRow(cartId: string) {
  const { data, error } = await admin.from('carts').select().eq('id', cartId).single();
  if (error) throw new Error(error.message);
  return data;
}

async function getCartItemRow(cartItemId: string) {
  const { data, error } = await admin.from('cart_items').select().eq('id', cartItemId).single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Polls the cart's status (also nudging it along with a capture-sweep call
 * each tick, so this doesn't just passively wait on the once-a-minute
 * cron) until `expected` is reached or POLL_TIMEOUT_MS elapses. Replaces a
 * fixed sleep-then-check-once, which raced against real settlement timing.
 */
async function waitForCartStatus(cartId: string, expected: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = '(unknown)';

  while (Date.now() < deadline) {
    await invoke('capture-sweep').catch(() => {
      // A transient error here just means this tick didn't hasten anything —
      // the next poll (or the cron) still gets a chance. Only a timeout with
      // the wrong final status is a real failure.
    });
    const cart = await getCartRow(cartId);
    lastStatus = cart.status as string;
    if (lastStatus === expected) return cart;
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`timed out after ${POLL_TIMEOUT_MS}ms waiting for ${expected}, last status was ${lastStatus}`);
}

async function scanSmallItemSet() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  const barcodes = ['049000028911', '012345678905', '041220576463', '811620021952'];
  for (const barcode of barcodes) {
    const result = await invoke<{ cartItemId: string; itemName: string }>('cart-scan', { cartId, barcode });
    const row = await getCartItemRow(result.cartItemId);
    assert(row.voided_at === null, `${barcode} should not be voided`);
    assert(row.stripe_payment_intent_id, `${barcode} should have a PaymentIntent`);
  }
  console.log('[ok] scan-small-item-set (live)');
}

async function exitThenReturn() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  await invoke('cart-scan', { cartId, barcode: '012345678905' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });
  await sleep(SAFELY_MID_WINDOW_MS);
  await invoke('cart-exit', { cartId, method: 'geofence_enter' });

  await invoke('capture-sweep'); // mid-window: must be a no-op
  const stillPending = await getCartRow(cartId);
  assert(
    stillPending.status === 'pending_capture',
    `expected still pending_capture, got ${stillPending.status}`
  );

  const settled = await waitForCartStatus(cartId, 'settled');
  assert(settled.status === 'settled', `expected settled, got ${settled.status}`);
  console.log('[ok] exit-then-return (live)');
}

async function goodwinHall() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  const original = await invoke<{ cartItemId: string }>('cart-scan', { cartId, barcode: '049000028911' });
  const duplicate = await invoke<{ cartItemId: string }>('cart-scan', { cartId, barcode: '049000028911' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });
  await invoke('cart-correct', { cartId, cartItemId: duplicate.cartItemId });

  const cart = await waitForCartStatus(cartId, 'settled');
  assert(cart.status === 'settled', `expected settled, got ${cart.status}`);
  const originalRow = await getCartItemRow(original.cartItemId);
  const duplicateRow = await getCartItemRow(duplicate.cartItemId);
  assert(originalRow.voided_at === null, 'original scan should not be voided');
  assert(duplicateRow.voided_at !== null, 'duplicate scan should be voided');

  // The status screen's own read path: anon key, cart-status function, no
  // direct table access (RLS denies that now — see 0003_enable_rls.sql).
  const receipt = await invoke<{ status: string; totalCents: number; lines: { name: string }[] }>(
    'cart-status',
    { cartId }
  );
  assert(receipt.status === 'settled', `cart-status: expected settled, got ${receipt.status}`);
  assert(receipt.totalCents === 500, `cart-status: expected 500 cents (one drink), got ${receipt.totalCents}`);
  assert(receipt.lines.length === 1, `cart-status: expected 1 line, got ${receipt.lines.length}`);
  console.log('[ok] goodwin-hall (live, permanent scenario)');
}

async function disputeCancelsInWindow() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  await invoke('cart-scan', { cartId, barcode: '811620021952' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });
  await invoke('cart-dispute', { cartId, reason: 'live smoke test' });

  // The dispute already moved status to 'disputed' synchronously — no
  // window to wait out here. Just confirm a sweep (cron or manual) can't
  // move it to settled afterward.
  const disputed = await getCartRow(cartId);
  assert(disputed.status === 'disputed', `expected disputed, got ${disputed.status}`);

  await invoke('capture-sweep');
  const stillDisputed = await getCartRow(cartId);
  assert(stillDisputed.status === 'disputed', `expected still disputed, got ${stillDisputed.status}`);

  const receipt = await invoke<{ status: string }>('cart-status', { cartId });
  assert(receipt.status === 'disputed', `cart-status: expected disputed, got ${receipt.status}`);
  console.log('[ok] dispute-cancels-in-window (live)');
}

async function captureThenDispute() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  await invoke('cart-scan', { cartId, barcode: '041220576463' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });

  let cart = await waitForCartStatus(cartId, 'settled');
  assert(cart.status === 'settled', `expected settled, got ${cart.status}`);

  await invokeExpectError('cart-dispute', { cartId, reason: 'too late' });

  cart = await getCartRow(cartId);
  assert(cart.status === 'settled', 'status must not move backwards to disputed');
  console.log('[ok] capture-then-dispute (live)');
}

async function main() {
  await scanSmallItemSet();
  await exitThenReturn();
  await goodwinHall();
  await disputeCancelsInWindow();
  await captureThenDispute();
  console.log('All live scenarios passed.');
}

main().catch((err) => {
  console.error('[FAIL]', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
