import type { SupabaseClient } from '@supabase/supabase-js';

import type { Cart, CartItem, Dispute, ExitEvent, ExitMethod, Item } from './types.ts';
import type { CartStore } from './store.ts';

function toCart(row: any): Cart {
  return {
    id: row.id,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripePaymentMethodId: row.stripe_payment_method_id,
    openedAt: row.opened_at,
    pendingCaptureAt: row.pending_capture_at,
    captureDueAt: row.capture_due_at,
    settledAt: row.settled_at,
    disputedAt: row.disputed_at,
  };
}

function toItem(row: any): Item {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    priceCents: row.price_cents,
    createdAt: row.created_at,
  };
}

function toCartItem(row: any): CartItem {
  return {
    id: row.id,
    cartId: row.cart_id,
    itemId: row.item_id,
    scannedAt: row.scanned_at,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    voidedAt: row.voided_at,
  };
}

function toExitEvent(row: any): ExitEvent {
  return { id: row.id, cartId: row.cart_id, method: row.method, confirmedAt: row.confirmed_at };
}

function toDispute(row: any): Dispute {
  return {
    id: row.id,
    cartId: row.cart_id,
    reason: row.reason,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function cartPatchToRow(patch: Partial<Cart>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.stripeCustomerId !== undefined) row.stripe_customer_id = patch.stripeCustomerId;
  if (patch.stripePaymentMethodId !== undefined)
    row.stripe_payment_method_id = patch.stripePaymentMethodId;
  if (patch.pendingCaptureAt !== undefined) row.pending_capture_at = patch.pendingCaptureAt;
  if (patch.captureDueAt !== undefined) row.capture_due_at = patch.captureDueAt;
  if (patch.settledAt !== undefined) row.settled_at = patch.settledAt;
  if (patch.disputedAt !== undefined) row.disputed_at = patch.disputedAt;
  return row;
}

function assertRow<T>(row: T | null, error: { message: string } | null, what: string): T {
  if (error) throw new Error(`${what}: ${error.message}`);
  if (!row) throw new Error(`${what}: not found`);
  return row;
}

/** Real Supabase-backed CartStore, used in production; see src/server/testing/inMemoryStore.ts for tests. */
export function createSupabaseStore(client: SupabaseClient): CartStore {
  return {
    async createCart({ stripeCustomerId, stripePaymentMethodId }) {
      const { data, error } = await client
        .from('carts')
        .insert({
          status: 'open',
          stripe_customer_id: stripeCustomerId,
          stripe_payment_method_id: stripePaymentMethodId,
        })
        .select()
        .single();
      return toCart(assertRow(data, error, 'createCart'));
    },

    async getCart(cartId) {
      const { data, error } = await client.from('carts').select().eq('id', cartId).single();
      return toCart(assertRow(data, error, 'getCart'));
    },

    async updateCart(cartId, patch) {
      const { data, error } = await client
        .from('carts')
        .update(cartPatchToRow(patch))
        .eq('id', cartId)
        .select()
        .single();
      return toCart(assertRow(data, error, 'updateCart'));
    },

    async getItemByBarcode(barcode) {
      const { data, error } = await client
        .from('items')
        .select()
        .eq('barcode', barcode)
        .single();
      return toItem(assertRow(data, error, 'getItemByBarcode'));
    },

    async getItemsByIds(itemIds) {
      if (itemIds.length === 0) return [];
      const { data, error } = await client.from('items').select().in('id', itemIds);
      if (error) throw new Error(`getItemsByIds: ${error.message}`);
      return (data ?? []).map(toItem);
    },

    async addCartItem({ cartId, itemId, stripePaymentIntentId }) {
      const { data, error } = await client
        .from('cart_items')
        .insert({ cart_id: cartId, item_id: itemId, stripe_payment_intent_id: stripePaymentIntentId })
        .select()
        .single();
      return toCartItem(assertRow(data, error, 'addCartItem'));
    },

    async voidCartItem(cartItemId, voidedAt) {
      const { data, error } = await client
        .from('cart_items')
        .update({ voided_at: voidedAt })
        .eq('id', cartItemId)
        .select()
        .single();
      return toCartItem(assertRow(data, error, 'voidCartItem'));
    },

    async listCartItems(cartId, opts) {
      let query = client.from('cart_items').select().eq('cart_id', cartId);
      if (!opts?.includeVoided) query = query.is('voided_at', null);
      const { data, error } = await query;
      if (error) throw new Error(`listCartItems: ${error.message}`);
      return (data ?? []).map(toCartItem);
    },

    async addExitEvent({ cartId, method }: { cartId: string; method: ExitMethod }) {
      const { data, error } = await client
        .from('exit_events')
        .insert({ cart_id: cartId, method })
        .select()
        .single();
      return toExitEvent(assertRow(data, error, 'addExitEvent'));
    },

    async addDispute({ cartId, reason }) {
      const { data, error } = await client
        .from('disputes')
        .insert({ cart_id: cartId, reason })
        .select()
        .single();
      return toDispute(assertRow(data, error, 'addDispute'));
    },

    async listCartsDueForCapture(nowIso) {
      const { data, error } = await client
        .from('carts')
        .select()
        .eq('status', 'pending_capture')
        .lte('capture_due_at', nowIso);
      if (error) throw new Error(`listCartsDueForCapture: ${error.message}`);
      return (data ?? []).map(toCart);
    },
  };
}
