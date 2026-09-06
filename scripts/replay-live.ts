// Live mirror of replayer/scenarios/*.ts, run against the deployed
// functions and the real database instead of the in-memory fakes.
//
//   node --env-file=.env --import tsx scripts/replay-live.ts
//
// Requires MOCHA_KIOSK_STRIPE_CUSTOMER_ID / MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID
// (see scripts/deploy-secrets.js) already set as function secrets, and the
// functions deployed. Sets MOCHA_CORRECTION_WINDOW_MS short before
// deploying so this doesn't have to wait out a real 10-minute window —
// see supabase/functions/_shared/backend.ts.
//
// This isn't a literal reuse of replayer/engine.ts's synthetic-clock event
// interpreter: on a real backend "at: 90_000" isn't a wall-clock offset
// you'd want to sleep for, so each scenario below is reproduced with real
// waits sized to MOCHA_CORRECTION_WINDOW_MS instead. The assertions match
// the corresponding replayer scenario one for one.
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const correctionWindowMs = Number(process.env.MOCHA_CORRECTION_WINDOW_MS ?? '5000');

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY must be set (run with node --env-file=.env)'
  );
}

// anon: exactly what the app uses. admin (service role): verification only, never shipped on-device.
const anon = createClient(url, anonKey);
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

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
  await sleep(Math.min(1000, correctionWindowMs / 2));
  await invoke('cart-exit', { cartId, method: 'geofence_enter' });

  await invoke('capture-sweep'); // mid-window: must be a no-op
  let cart = await getCartRow(cartId);
  assert(cart.status === 'pending_capture', `expected still pending_capture, got ${cart.status}`);

  await sleep(correctionWindowMs);
  await invoke('capture-sweep');
  cart = await getCartRow(cartId);
  assert(cart.status === 'settled', `expected settled, got ${cart.status}`);
  console.log('[ok] exit-then-return (live)');
}

async function goodwinHall() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  const original = await invoke<{ cartItemId: string }>('cart-scan', { cartId, barcode: '049000028911' });
  const duplicate = await invoke<{ cartItemId: string }>('cart-scan', { cartId, barcode: '049000028911' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });
  await invoke('cart-correct', { cartId, cartItemId: duplicate.cartItemId });

  await sleep(correctionWindowMs);
  await invoke('capture-sweep');

  const cart = await getCartRow(cartId);
  assert(cart.status === 'settled', `expected settled, got ${cart.status}`);
  const originalRow = await getCartItemRow(original.cartItemId);
  const duplicateRow = await getCartItemRow(duplicate.cartItemId);
  assert(originalRow.voided_at === null, 'original scan should not be voided');
  assert(duplicateRow.voided_at !== null, 'duplicate scan should be voided');
  console.log('[ok] goodwin-hall (live, permanent scenario)');
}

async function disputeCancelsInWindow() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  await invoke('cart-scan', { cartId, barcode: '811620021952' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });
  await invoke('cart-dispute', { cartId, reason: 'live smoke test' });

  await sleep(correctionWindowMs);
  await invoke('capture-sweep');

  const cart = await getCartRow(cartId);
  assert(cart.status === 'disputed', `expected disputed, got ${cart.status}`);
  console.log('[ok] dispute-cancels-in-window (live)');
}

async function captureThenDispute() {
  const { cartId } = await invoke<{ cartId: string }>('cart-open');
  await invoke('cart-scan', { cartId, barcode: '041220576463' });
  await invoke('cart-exit', { cartId, method: 'geofence_exit' });

  await sleep(correctionWindowMs);
  await invoke('capture-sweep');

  let cart = await getCartRow(cartId);
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
