import { supabase } from './supabaseClient';

// The on-device seam onto the settlement pipeline in src/server/. Scanning
// authorizes a Stripe PaymentIntent, which needs the secret key, so this
// never runs on-device directly — it goes through the Supabase Edge
// Functions under supabase/functions/ (cart-open, cart-scan, cart-correct,
// cart-exit, cart-dispute), which wrap cartService directly.
export type GeofenceExitMethod = 'geofence_exit' | 'geofence_enter';

export type CartStatus = 'open' | 'pending_capture' | 'settled' | 'disputed';

export interface CartReceiptLine {
  name: string;
  priceCents: number;
}

export interface CartReceipt {
  status: CartStatus;
  totalCents: number;
  lines: CartReceiptLine[];
}

export interface CartClient {
  openCart(): Promise<{ cartId: string }>;
  scanItem(cartId: string, barcode: string): Promise<{ cartItemId: string; itemName: string }>;
  correctScan(cartId: string, cartItemId: string): Promise<void>;
  recordExit(cartId: string, method: GeofenceExitMethod): Promise<void>;
  flagDispute(cartId: string, reason: string): Promise<void>;
  getCartStatus(cartId: string): Promise<CartReceipt>;
}

export const backendClient: CartClient = {
  async openCart() {
    const { data, error } = await supabase.functions.invoke('cart-open', {});
    if (error) throw error;
    return data;
  },

  async scanItem(cartId, barcode) {
    const { data, error } = await supabase.functions.invoke('cart-scan', {
      body: { cartId, barcode },
    });
    if (error) throw error;
    return data;
  },

  async correctScan(cartId, cartItemId) {
    const { error } = await supabase.functions.invoke('cart-correct', {
      body: { cartId, cartItemId },
    });
    if (error) throw error;
  },

  async recordExit(cartId, method) {
    const { error } = await supabase.functions.invoke('cart-exit', {
      body: { cartId, method },
    });
    if (error) throw error;
  },

  async flagDispute(cartId, reason) {
    const { error } = await supabase.functions.invoke('cart-dispute', {
      body: { cartId, reason },
    });
    if (error) throw error;
  },

  async getCartStatus(cartId) {
    const { data, error } = await supabase.functions.invoke('cart-status', {
      body: { cartId },
    });
    if (error) throw error;
    return data;
  },
};
