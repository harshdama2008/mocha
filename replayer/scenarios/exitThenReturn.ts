import type { Item } from '../../src/server/types';
import type { ReplayScenario } from '../engine';

const CORRECTION_WINDOW_MS = 10 * 60 * 1000; // matches src/config.ts's default

const ITEMS: Item[] = [
  {
    id: 'item_iced_mocha',
    barcode: '012345678905',
    name: 'Iced Mocha',
    priceCents: 450,
    createdAt: new Date(0).toISOString(),
  },
];

/**
 * Shopper scans an item, the OS geofence fires an exit (starting the
 * correction window), then the shopper walks back in range and the
 * geofence fires an enter — e.g. they forgot something and went back for
 * it. CLAUDE.md's invariant #1 (status never moves backwards) means that
 * re-entry must not reopen the cart or reset the window: the capture still
 * fires when the *original* window elapses.
 */
export const exitThenReturnScenario: ReplayScenario = {
  name: 'exit-then-return',
  description:
    "A geofence re-entry during the correction window doesn't reopen the cart or push back the capture.",
  items: ITEMS,
  customer: { stripeCustomerId: 'cus_exit_return', stripePaymentMethodId: 'pm_exit_return' },
  correctionWindowMs: CORRECTION_WINDOW_MS,
  events: [
    { type: 'scan', barcode: ITEMS[0].barcode, at: 0 },
    { type: 'exit', method: 'geofence_exit', at: 1000 },
    // Walked back into range partway through the window.
    { type: 'exit', method: 'geofence_enter', at: 60_000 },
    // A capture attempt mid-window must still be a no-op.
    { type: 'tick', at: 90_000 },
    // The original window (from the first exit at 1000ms) elapses.
    { type: 'tick', at: 1000 + CORRECTION_WINDOW_MS },
  ],
};
