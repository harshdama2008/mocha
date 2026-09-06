import { cartService, store } from '../_shared/backend.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { cartId, barcode } = await req.json();
    const cartItem = await cartService.scanItem(cartId, barcode);
    const item = await store.getItemByBarcode(barcode);
    return jsonResponse({ cartItemId: cartItem.id, itemName: item.name });
  } catch (err) {
    return errorResponse(err);
  }
});
