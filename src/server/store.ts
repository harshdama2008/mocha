import type { Cart, CartItem, Dispute, ExitEvent, ExitMethod, Item } from './types';

// Data-access seam over the tables in supabase/migrations/0001_init.sql.
// cartService depends on this interface, not on Supabase directly, so the
// replayer and unit tests can run the real state machine against an
// in-memory fake (src/server/testing/inMemoryStore.ts) with no network.
export interface CartStore {
  createCart(input: { stripeCustomerId: string; stripePaymentMethodId: string }): Promise<Cart>;
  getCart(cartId: string): Promise<Cart>;
  updateCart(cartId: string, patch: Partial<Cart>): Promise<Cart>;

  getItemByBarcode(barcode: string): Promise<Item>;

  addCartItem(input: {
    cartId: string;
    itemId: string;
    stripePaymentIntentId: string;
  }): Promise<CartItem>;
  voidCartItem(cartItemId: string, voidedAt: string): Promise<CartItem>;
  listCartItems(cartId: string, opts?: { includeVoided?: boolean }): Promise<CartItem[]>;

  addExitEvent(input: { cartId: string; method: ExitMethod }): Promise<ExitEvent>;

  addDispute(input: { cartId: string; reason: string }): Promise<Dispute>;

  /** Carts in pending_capture whose capture_due_at has passed as of `nowIso`. */
  listCartsDueForCapture(nowIso: string): Promise<Cart[]>;
}
