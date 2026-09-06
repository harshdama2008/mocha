import { supabase } from './supabaseClient';

// The on-device seam onto the settlement pipeline in src/server/. Scanning
// authorizes a Stripe PaymentIntent, which needs the secret key, so this
// can never run on-device directly — it goes through a Supabase Edge
// Function that wraps cartService. There is no Supabase project linked in
// this sandbox to deploy that function to, so `scanItem` below is the
// documented call shape a deployed `cart-scan` function would expect;
// wiring it up is a deploy-time step, not a code change.
export interface CartClient {
  openCart(): Promise<{ cartId: string }>;
  scanItem(cartId: string, barcode: string): Promise<{ cartItemId: string; itemName: string }>;
  correctScan(cartId: string, cartItemId: string): Promise<void>;
  flagDispute(cartId: string, reason: string): Promise<void>;
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

  async flagDispute(cartId, reason) {
    const { error } = await supabase.functions.invoke('cart-dispute', {
      body: { cartId, reason },
    });
    if (error) throw error;
  },
};
