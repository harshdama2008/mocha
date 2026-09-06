// Wires up the exact same cartService that src/server/__tests__ unit-tests
// and replayer/ exercises against fakes — nothing here reimplements the
// state machine. The 'stripe' and '@supabase/supabase-js' bare specifiers
// inside src/server/stripeClient.ts, stripeGateway.ts, supabaseAdmin.ts,
// and supabaseStore.ts resolve via supabase/functions/deno.json's import
// map, and their internal relative imports use explicit .ts extensions,
// which Deno requires and Node's "bundler" moduleResolution also accepts.
import { createCartService } from '../../../src/server/cartService.ts';
import { stripeGateway } from '../../../src/server/stripeGateway.ts';
import { getSupabaseAdmin } from '../../../src/server/supabaseAdmin.ts';
import { createSupabaseStore } from '../../../src/server/supabaseStore.ts';
import { getEnv } from '../../../src/server/env.ts';

// MOCHA_CORRECTION_WINDOW_MS is an optional override of the one constant
// in src/config.ts, for live smoke-testing only (scripts/replay-live.ts) —
// waiting out a real 10-minute window on a deployed function isn't
// practical for a verification run. Unset in normal operation, so
// production always uses the real CORRECTION_WINDOW_MS.
const correctionWindowOverride = getEnv('MOCHA_CORRECTION_WINDOW_MS');

export const store = createSupabaseStore(getSupabaseAdmin());
export const cartService = createCartService(store, stripeGateway, {
  correctionWindowMs: correctionWindowOverride ? Number(correctionWindowOverride) : undefined,
});

// This app never collects a shopper's card or creates a per-shopper Stripe
// Customer — there's no auth/session model at all (unattended kiosk, see
// CLAUDE.md). Every cart authorizes against one pre-registered "house"
// Customer + PaymentMethod set up once via scripts/setup-stripe-fixtures.ts
// and stored as function secrets. A real multi-shopper deployment needs a
// card-on-file flow; that's new scope, not implied by this settlement
// pipeline.
export function getKioskPaymentProfile(): { stripeCustomerId: string; stripePaymentMethodId: string } {
  const stripeCustomerId = getEnv('MOCHA_KIOSK_STRIPE_CUSTOMER_ID');
  const stripePaymentMethodId = getEnv('MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID');
  if (!stripeCustomerId || !stripePaymentMethodId) {
    throw new Error(
      'MOCHA_KIOSK_STRIPE_CUSTOMER_ID / MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID are not set — run scripts/setup-stripe-fixtures.ts once and set the printed ids as function secrets.'
    );
  }
  return { stripeCustomerId, stripePaymentMethodId };
}
