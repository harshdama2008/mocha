import type { Item } from '../../src/server/types';
import type { ReplayScenario } from '../engine';

const CORRECTION_WINDOW_MS = 60_000;

const ITEMS: Item[] = [
  {
    id: 'item_granola_bar',
    barcode: '041220576463',
    name: 'Granola Bar',
    priceCents: 250,
    createdAt: new Date(0).toISOString(),
  },
];

/**
 * A dispute flagged AFTER capture has already fired. Hard invariant #1
 * (status only ever moves open -> pending_capture -> settled OR disputed,
 * never backwards) means a settled cart cannot become disputed through
 * this pipeline — post-settlement disagreements are a refund flow, not a
 * cancel-before-capture flow, and are out of scope here (see CLAUDE.md's
 * non-goals). This scenario doesn't include a 'dispute' event: engine.ts
 * has no try/catch around cartService calls, so the test itself calls
 * flagDispute directly on the finished replay to assert it's rejected.
 */
export const captureThenDisputeScenario: ReplayScenario = {
  name: 'capture-then-dispute',
  description: 'A dispute flagged after capture is rejected; a settled cart cannot become disputed.',
  items: ITEMS,
  customer: { stripeCustomerId: 'cus_capture_then_dispute', stripePaymentMethodId: 'pm_capture_then_dispute' },
  correctionWindowMs: CORRECTION_WINDOW_MS,
  events: [
    { type: 'scan', barcode: ITEMS[0].barcode, at: 0 },
    { type: 'exit', method: 'geofence_exit', at: 1000 },
    { type: 'tick', at: 1000 + CORRECTION_WINDOW_MS },
  ],
};
