import { buildCartReceipt } from '../cartReceipt';
import type { Cart, CartItem, Item } from '../types';

const ENERGY_DRINK: Item = {
  id: 'item_energy_drink',
  barcode: '049000028911',
  name: 'Energy Drink',
  priceCents: 500,
  createdAt: new Date(0).toISOString(),
};

const GRANOLA_BAR: Item = {
  id: 'item_granola_bar',
  barcode: '041220576463',
  name: 'Granola Bar',
  priceCents: 250,
  createdAt: new Date(0).toISOString(),
};

function makeCart(status: Cart['status']): Cart {
  return {
    id: 'cart_1',
    status,
    stripeCustomerId: 'cus_1',
    stripePaymentMethodId: 'pm_1',
    openedAt: new Date(0).toISOString(),
    pendingCaptureAt: null,
    captureDueAt: null,
    settledAt: null,
    disputedAt: null,
  };
}

function makeCartItem(itemId: string, voidedAt: string | null = null): CartItem {
  return {
    id: `ci_${itemId}_${voidedAt ?? 'live'}`,
    cartId: 'cart_1',
    itemId,
    scannedAt: new Date(0).toISOString(),
    stripePaymentIntentId: 'pi_1',
    voidedAt,
  };
}

describe('buildCartReceipt', () => {
  it('totals the settled cart and lists each charged item', () => {
    const receipt = buildCartReceipt(
      makeCart('settled'),
      [makeCartItem(ENERGY_DRINK.id), makeCartItem(GRANOLA_BAR.id)],
      [ENERGY_DRINK, GRANOLA_BAR]
    );

    expect(receipt.status).toBe('settled');
    expect(receipt.totalCents).toBe(750);
    expect(receipt.lines).toEqual([
      { name: 'Energy Drink', priceCents: 500 },
      { name: 'Granola Bar', priceCents: 250 },
    ]);
  });

  it('excludes voided cart_items from the total and line list (the Goodwin Hall case)', () => {
    const receipt = buildCartReceipt(
      makeCart('settled'),
      [makeCartItem(ENERGY_DRINK.id), makeCartItem(ENERGY_DRINK.id, new Date(1).toISOString())],
      [ENERGY_DRINK]
    );

    expect(receipt.totalCents).toBe(500);
    expect(receipt.lines).toHaveLength(1);
  });

  it('passes through a disputed cart with whatever line items it was given', () => {
    const receipt = buildCartReceipt(makeCart('disputed'), [makeCartItem(GRANOLA_BAR.id)], [GRANOLA_BAR]);

    expect(receipt.status).toBe('disputed');
    expect(receipt.totalCents).toBe(250);
  });

  it('throws if a cart_item references an item the caller did not fetch', () => {
    expect(() => buildCartReceipt(makeCart('settled'), [makeCartItem(ENERGY_DRINK.id)], [])).toThrow(
      /unknown item/
    );
  });
});
