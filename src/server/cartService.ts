import { CORRECTION_WINDOW_MS } from '../config';
import type { PaymentGateway } from './paymentGateway';
import type { CartStore } from './store';
import type { Cart, CartItem, Dispute, ExitEvent, ExitMethod } from './types';

export interface CartService {
  openCart(input: { stripeCustomerId: string; stripePaymentMethodId: string }): Promise<Cart>;
  scanItem(cartId: string, barcode: string, now?: Date): Promise<CartItem>;
  correctScan(cartId: string, cartItemId: string, now?: Date): Promise<CartItem>;
  recordExitEvent(cartId: string, method?: ExitMethod, now?: Date): Promise<ExitEvent>;
  flagDispute(cartId: string, reason: string, now?: Date): Promise<Dispute>;
  captureIfDue(cartId: string, now?: Date): Promise<Cart>;
  sweepDueCaptures(now?: Date): Promise<Cart[]>;
}

/**
 * The settlement pipeline's state machine. Cart status only ever moves
 * open -> pending_capture -> settled|disputed (hard invariant #1); every
 * transition here goes through store.updateCart with an explicit status,
 * and every path that could otherwise double-fire a Stripe call
 * (captureIfDue, correctScan, flagDispute) first checks the cart is still
 * in the status that makes that call valid.
 */
export function createCartService(
  store: CartStore,
  gateway: PaymentGateway,
  opts: { correctionWindowMs?: number } = {}
): CartService {
  const correctionWindowMs = opts.correctionWindowMs ?? CORRECTION_WINDOW_MS;

  async function openCart(input: { stripeCustomerId: string; stripePaymentMethodId: string }) {
    return store.createCart(input);
  }

  async function scanItem(cartId: string, barcode: string): Promise<CartItem> {
    const cart = await store.getCart(cartId);
    if (cart.status !== 'open') {
      throw new Error(`cannot scan into a ${cart.status} cart`);
    }

    const item = await store.getItemByBarcode(barcode);
    const intent = await gateway.authorize({
      amountCents: item.priceCents,
      customerId: cart.stripeCustomerId ?? '',
      paymentMethodId: cart.stripePaymentMethodId ?? '',
      metadata: { cartId, itemId: item.id },
    });

    return store.addCartItem({ cartId, itemId: item.id, stripePaymentIntentId: intent.id });
  }

  async function correctScan(cartId: string, cartItemId: string, now = new Date()): Promise<CartItem> {
    const cart = await store.getCart(cartId);
    if (cart.status === 'settled' || cart.status === 'disputed') {
      throw new Error(`cannot correct a ${cart.status} cart`);
    }

    const [cartItem] = await store.listCartItems(cartId).then((all) =>
      all.filter((ci) => ci.id === cartItemId)
    );
    if (!cartItem) throw new Error(`correctScan: no un-voided cart_item ${cartItemId} on cart ${cartId}`);
    if (!cartItem.stripePaymentIntentId) {
      throw new Error(`correctScan: cart_item ${cartItemId} has no PaymentIntent to cancel`);
    }

    await gateway.cancel(cartItem.stripePaymentIntentId);
    return store.voidCartItem(cartItemId, now.toISOString());
  }

  async function recordExitEvent(
    cartId: string,
    method: ExitMethod = 'geofence_exit',
    now = new Date()
  ): Promise<ExitEvent> {
    const event = await store.addExitEvent({ cartId, method });

    if (method === 'geofence_exit') {
      const cart = await store.getCart(cartId);
      // Only the exit that closes an open cart starts the window. A
      // duplicate exit (already pending_capture/settled/disputed) or a
      // re-entry ('geofence_enter') is just logged — CLAUDE.md's invariant
      // #1 forbids ever moving status backwards, so returning to the store
      // mid-window never reopens the cart.
      if (cart.status === 'open') {
        const captureDueAt = new Date(now.getTime() + correctionWindowMs);
        await store.updateCart(cartId, {
          status: 'pending_capture',
          pendingCaptureAt: now.toISOString(),
          captureDueAt: captureDueAt.toISOString(),
        });
      }
    }

    return event;
  }

  async function flagDispute(cartId: string, reason: string, now = new Date()): Promise<Dispute> {
    const cart = await store.getCart(cartId);
    if (cart.status !== 'pending_capture') {
      throw new Error(
        `cannot dispute a ${cart.status} cart; disputes are only accepted during the correction window`
      );
    }

    const openItems = await store.listCartItems(cartId);
    for (const cartItem of openItems) {
      if (cartItem.stripePaymentIntentId) {
        await gateway.cancel(cartItem.stripePaymentIntentId);
      }
    }

    await store.updateCart(cartId, { status: 'disputed', disputedAt: now.toISOString() });
    return store.addDispute({ cartId, reason });
  }

  async function captureIfDue(cartId: string, now = new Date()): Promise<Cart> {
    const cart = await store.getCart(cartId);
    // Idempotency guard: this is what makes "capture fires exactly once"
    // hold even if sweepDueCaptures runs the same cart twice.
    if (cart.status !== 'pending_capture') return cart;
    if (cart.captureDueAt && new Date(cart.captureDueAt) > now) return cart;

    const openItems = await store.listCartItems(cartId);
    for (const cartItem of openItems) {
      if (cartItem.stripePaymentIntentId) {
        await gateway.capture(cartItem.stripePaymentIntentId);
      }
    }

    return store.updateCart(cartId, { status: 'settled', settledAt: now.toISOString() });
  }

  async function sweepDueCaptures(now = new Date()): Promise<Cart[]> {
    const due = await store.listCartsDueForCapture(now.toISOString());
    const results: Cart[] = [];
    for (const cart of due) {
      results.push(await captureIfDue(cart.id, now));
    }
    return results;
  }

  return { openCart, scanItem, correctScan, recordExitEvent, flagDispute, captureIfDue, sweepDueCaptures };
}
