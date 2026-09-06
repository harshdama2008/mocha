import type { Item } from '../../src/server/types';
import type { ReplayScenario } from '../engine';

const CORRECTION_WINDOW_MS = 10 * 60 * 1000;

const ITEMS: Item[] = [
  {
    id: 'item_sparkling_water',
    barcode: '811620021952',
    name: 'Sparkling Water',
    priceCents: 200,
    createdAt: new Date(0).toISOString(),
  },
];

/**
 * The "flag this charge" feature: a shopper disputes the whole charge from
 * the correction screen while still inside the window. Per hard invariant
 * #2, this must cancel the PaymentIntent instead of letting it capture.
 */
export const disputeCancelsInWindowScenario: ReplayScenario = {
  name: 'dispute-cancels-in-window',
  description: 'Flagging a charge during the correction window cancels instead of capturing.',
  items: ITEMS,
  customer: { stripeCustomerId: 'cus_dispute', stripePaymentMethodId: 'pm_dispute' },
  correctionWindowMs: CORRECTION_WINDOW_MS,
  events: [
    { type: 'scan', barcode: ITEMS[0].barcode, at: 0 },
    { type: 'exit', method: 'geofence_exit', at: 1000 },
    { type: 'dispute', reason: "never took this, camera must've misread a scan", at: 5000 },
    { type: 'tick', at: 1000 + CORRECTION_WINDOW_MS },
  ],
};
