#!/usr/bin/env node
// Run this yourself — not through an assistant session — since it reads
// .env directly:
//   node --env-file=.env scripts/deploy-secrets.js <project-ref>
//
// One-shot setup: creates the kiosk's "house account" Stripe test Customer
// + PaymentMethod (see supabase/functions/_shared/backend.ts — this app has
// no per-shopper card flow) and sets it, plus STRIPE_SECRET_KEY, as Edge
// Function secrets on the given project. Prints confirmation only — never
// the key or the fixture ids.
const { execFileSync } = require('node:child_process');
const Stripe = require('stripe');

async function main() {
  const projectRef = process.argv[2];
  if (!projectRef) {
    throw new Error('usage: node --env-file=.env scripts/deploy-secrets.js <project-ref>');
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set — run with node --env-file=.env');
  }
  if (secretKey.startsWith('sk_live_')) {
    throw new Error('Refusing to use a live Stripe key — test mode only, always.');
  }

  const stripe = new Stripe(secretKey);
  const customer = await stripe.customers.create({ name: 'Mocha kiosk (house account)' });
  const paymentMethod = await stripe.paymentMethods.attach('pm_card_visa', {
    customer: customer.id,
  });

  // On Windows, npx resolves to npx.cmd, which CreateProcess can't launch
  // directly without going through cmd.exe — spawn/execFileSync throws
  // ENOENT unless either shell:true is set or the .cmd is named explicitly.
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  execFileSync(
    npxCommand,
    [
      'supabase',
      'secrets',
      'set',
      `STRIPE_SECRET_KEY=${secretKey}`,
      `MOCHA_KIOSK_STRIPE_CUSTOMER_ID=${customer.id}`,
      `MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID=${paymentMethod.id}`,
      '--project-ref',
      projectRef,
    ],
    { stdio: 'inherit' }
  );

  console.log('Secrets set (values not printed).');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
