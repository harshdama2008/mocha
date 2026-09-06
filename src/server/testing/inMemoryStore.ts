import type { Cart, CartItem, Dispute, ExitEvent, ExitMethod, Item } from '../types';
import type { CartStore } from '../store';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

/**
 * In-memory CartStore used by unit tests and the synthetic event replayer,
 * so both can exercise the real cartService state machine directly —
 * "hitting the backend directly, no phone or beacon required" — without a
 * Supabase project or network access.
 */
export function createInMemoryStore(seedItems: Item[] = []): CartStore & { seedItem(item: Item): void } {
  const carts = new Map<string, Cart>();
  const items = new Map<string, Item>();
  const cartItems = new Map<string, CartItem>();
  const exitEvents: ExitEvent[] = [];
  const disputes: Dispute[] = [];

  for (const item of seedItems) items.set(item.barcode, item);

  return {
    seedItem(item: Item) {
      items.set(item.barcode, item);
    },

    async createCart({ stripeCustomerId, stripePaymentMethodId }) {
      const cart: Cart = {
        id: nextId('cart'),
        status: 'open',
        stripeCustomerId,
        stripePaymentMethodId,
        openedAt: new Date().toISOString(),
        pendingCaptureAt: null,
        captureDueAt: null,
        settledAt: null,
        disputedAt: null,
      };
      carts.set(cart.id, cart);
      return cart;
    },

    async getCart(cartId) {
      const cart = carts.get(cartId);
      if (!cart) throw new Error(`getCart: no cart ${cartId}`);
      return cart;
    },

    async updateCart(cartId, patch) {
      const cart = carts.get(cartId);
      if (!cart) throw new Error(`updateCart: no cart ${cartId}`);
      const updated = { ...cart, ...patch };
      carts.set(cartId, updated);
      return updated;
    },

    async getItemByBarcode(barcode) {
      const item = items.get(barcode);
      if (!item) throw new Error(`getItemByBarcode: unknown barcode ${barcode}`);
      return item;
    },

    async addCartItem({ cartId, itemId, stripePaymentIntentId }) {
      const cartItem: CartItem = {
        id: nextId('cart_item'),
        cartId,
        itemId,
        scannedAt: new Date().toISOString(),
        stripePaymentIntentId,
        voidedAt: null,
      };
      cartItems.set(cartItem.id, cartItem);
      return cartItem;
    },

    async voidCartItem(cartItemId, voidedAt) {
      const cartItem = cartItems.get(cartItemId);
      if (!cartItem) throw new Error(`voidCartItem: no cart_item ${cartItemId}`);
      const updated = { ...cartItem, voidedAt };
      cartItems.set(cartItemId, updated);
      return updated;
    },

    async listCartItems(cartId, opts) {
      return [...cartItems.values()].filter(
        (ci) => ci.cartId === cartId && (opts?.includeVoided || ci.voidedAt === null)
      );
    },

    async addExitEvent({ cartId, method }: { cartId: string; method: ExitMethod }) {
      const event: ExitEvent = {
        id: nextId('exit_event'),
        cartId,
        method,
        confirmedAt: new Date().toISOString(),
      };
      exitEvents.push(event);
      return event;
    },

    async addDispute({ cartId, reason }) {
      const dispute: Dispute = {
        id: nextId('dispute'),
        cartId,
        reason,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      disputes.push(dispute);
      return dispute;
    },

    async listCartsDueForCapture(nowIso) {
      return [...carts.values()].filter(
        (c) => c.status === 'pending_capture' && c.captureDueAt !== null && c.captureDueAt <= nowIso
      );
    },
  };
}
