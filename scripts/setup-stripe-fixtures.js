#!/usr/bin/env node
// Run once, after .env has a real STRIPE_SECRET_KEY:
//   node --env-file=.env scripts/setup-stripe-fixtures.js
//
// This app never collects a shopper's card — there's no auth/session model
// at all (unattended kiosk, see CLAUDE.md). Every cart authorizes against
// one pre-registered "house" Stripe Customer + PaymentMethod. This script
// creates that test-mode Customer once and attaches Stripe's canned test
// Visa PaymentMethod to it, then prints the two ids to set as Edge
// Function secrets (MOCHA_KIOSK_STRIPE_CUSTOMER_ID /
// MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID). These are test-mode object ids,
// not secrets — safe to print and to commit in a deploy runbook.
const Stripe = require('stripe');

async function main() {
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

  console.log(`MOCHA_KIOSK_STRIPE_CUSTOMER_ID=${customer.id}`);
  console.log(`MOCHA_KIOSK_STRIPE_PAYMENT_METHOD_ID=${paymentMethod.id}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
