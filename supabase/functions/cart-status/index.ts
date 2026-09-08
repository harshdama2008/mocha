import { buildCartReceipt } from '../../../src/server/cartReceipt.ts';
import { store } from '../_shared/backend.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';

// The one read the on-device status screen needs after exit: cart status
// plus, once settled, what it actually charged. Reads through `store`
// (service-role key) instead of a direct client table read because RLS
// denies the anon key on carts/cart_items entirely — this is the only
// door back into that data for the app.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { cartId } = await req.json();
    const cart = await store.getCart(cartId);
    const cartItems = await store.listCartItems(cartId);
    const items = await store.getItemsByIds(cartItems.map((cartItem) => cartItem.itemId));
    return jsonResponse(buildCartReceipt(cart, cartItems, items));
  } catch (err) {
    return errorResponse(err);
  }
});
