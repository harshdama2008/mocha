import { TEST_ITEMS } from '../../src/lib/testItems';
import type { Item } from '../../src/server/types';
import type { ReplayScenario } from '../engine';

// Same catalog the phase-3 camera screen resolves against (src/lib/testItems.ts),
// turned into full `items` rows for the in-memory store.
export const CATALOG: Item[] = TEST_ITEMS.map((item, index) => ({
  id: `item_${index}`,
  barcode: item.barcode,
  name: item.name,
  priceCents: item.priceCents,
  createdAt: new Date(0).toISOString(),
}));

export const scanSmallItemSetScenario: ReplayScenario = {
  name: 'scan-small-item-set',
  description:
    'Scans every item in the small on-device test catalog and expects one authorized PaymentIntent per scan.',
  items: CATALOG,
  customer: { stripeCustomerId: 'cus_goodwin', stripePaymentMethodId: 'pm_goodwin' },
  events: CATALOG.map((item, index) => ({
    type: 'scan' as const,
    barcode: item.barcode,
    at: index * 1000,
  })),
};
