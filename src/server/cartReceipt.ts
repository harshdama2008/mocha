import type { Cart, CartItem, Item } from './types.ts';

export interface CartReceiptLine {
  name: string;
  priceCents: number;
}

export interface CartReceipt {
  status: Cart['status'];
  totalCents: number;
  lines: CartReceiptLine[];
}

/**
 * The status screen's "what actually happened" view. A voided cart_item
 * (e.g. the Goodwin Hall double-scan, corrected before capture) was never
 * charged, so it's excluded here even if a caller passes includeVoided
 * rows in — this is the one place that decides what counts toward the
 * total, and it shouldn't depend on every caller filtering correctly.
 */
export function buildCartReceipt(cart: Cart, cartItems: CartItem[], items: Item[]): CartReceipt {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const lines = cartItems
    .filter((cartItem) => cartItem.voidedAt === null)
    .map((cartItem) => {
      const item = itemsById.get(cartItem.itemId);
      if (!item) throw new Error(`buildCartReceipt: unknown item ${cartItem.itemId}`);
      return { name: item.name, priceCents: item.priceCents };
    });

  const totalCents = lines.reduce((sum, line) => sum + line.priceCents, 0);

  return { status: cart.status, totalCents, lines };
}
