import type { Item } from '../../src/server/types';
import type { ReplayScenario } from '../engine';

const CORRECTION_WINDOW_MS = 10 * 60 * 1000; // matches src/config.ts's default

const ITEMS: Item[] = [
  {
    id: 'item_energy_drink',
    barcode: '049000028911',
    name: 'Energy Drink',
    priceCents: 500,
    createdAt: new Date(0).toISOString(),
  },
];

/**
 * THE GOODWIN HALL SCENARIO — a permanent regression test (CLAUDE.md hard
 * invariant #4). The same energy drink scanned twice back-to-back by
 * accident, caught and corrected during the window, well before capture.
 * This scenario and the test that runs it must never be deleted, skipped,
 * or weakened to make a build pass — if a change breaks this, the bug is
 * in cartService, not here.
 */
export const goodwinHallScenario: ReplayScenario = {
  name: 'goodwin-hall',
  description: 'Accidental double-scan, caught and corrected before capture.',
  items: ITEMS,
  customer: { stripeCustomerId: 'cus_goodwin_hall', stripePaymentMethodId: 'pm_goodwin_hall' },
  correctionWindowMs: CORRECTION_WINDOW_MS,
  events: [
    { type: 'scan', barcode: ITEMS[0].barcode, at: 0 }, // the one drink actually taken
    { type: 'scan', barcode: ITEMS[0].barcode, at: 1000 }, // accidental double-scan
    { type: 'exit', method: 'geofence_exit', at: 2000 },
    { type: 'correctLastScan', at: 3000 }, // caught during the window, before capture
    { type: 'tick', at: 2000 + CORRECTION_WINDOW_MS },
  ],
};
