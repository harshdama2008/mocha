import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(
  path.join(__dirname, '../../../supabase/migrations/0001_init.sql'),
  'utf8'
);

describe('0001_init.sql', () => {
  it('defines every table from the CLAUDE.md data model', () => {
    for (const table of ['items', 'carts', 'cart_items', 'exit_events', 'disputes']) {
      expect(sql).toMatch(new RegExp(`create table if not exists ${table}\\s*\\(`));
    }
  });

  it('constrains cart status to the four allowed values', () => {
    expect(sql).toMatch(
      /status in \('open', 'pending_capture', 'settled', 'disputed'\)/
    );
  });

  it('enforces forward-only cart status transitions with a trigger', () => {
    expect(sql).toMatch(/create trigger cart_status_transition/);
    expect(sql).toMatch(/before update of status on carts/);
  });

  it('links cart_items to a Stripe PaymentIntent for the authorize-on-scan invariant', () => {
    expect(sql).toMatch(/cart_items[\s\S]*stripe_payment_intent_id text/);
  });
});
