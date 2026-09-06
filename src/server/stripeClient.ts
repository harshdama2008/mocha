import Stripe from 'stripe';

// Server-only. STRIPE_SECRET_KEY must be a sandbox/test key (sk_test_...) —
// see CLAUDE.md. This module is never imported from src/app or src/lib,
// which run on-device; it belongs to the Supabase Edge Function-shaped
// backend under src/server.
let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (client) return client;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (secretKey.startsWith('sk_live_')) {
    throw new Error('Refusing to use a live Stripe key — test mode only, always.');
  }

  client = new Stripe(secretKey);
  return client;
}
