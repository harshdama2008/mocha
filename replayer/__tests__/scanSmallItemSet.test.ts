import { runScenario } from '../engine';
import { CATALOG, scanSmallItemSetScenario } from '../scenarios/scanSmallItemSet';

describe('replayer: scan-small-item-set', () => {
  it('authorizes one requires_capture PaymentIntent per scanned item, for the correct amount', async () => {
    const result = await runScenario(scanSmallItemSetScenario);

    expect(result.cart.status).toBe('open');
    expect(result.cartItems).toHaveLength(CATALOG.length);

    for (const [index, cartItem] of result.cartItems.entries()) {
      const catalogItem = CATALOG[index];
      expect(cartItem.itemId).toBe(catalogItem.id);
      expect(cartItem.voidedAt).toBeNull();

      const intent = result.intents.get(cartItem.stripePaymentIntentId!);
      expect(intent?.status).toBe('requires_capture');
      expect(intent?.amountCents).toBe(catalogItem.priceCents);
    }
  });
});
