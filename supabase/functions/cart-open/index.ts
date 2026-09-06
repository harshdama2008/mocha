import { cartService, getKioskPaymentProfile } from '../_shared/backend.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const cart = await cartService.openCart(getKioskPaymentProfile());
    return jsonResponse({ cartId: cart.id });
  } catch (err) {
    return errorResponse(err);
  }
});
