import { cartService } from '../_shared/backend.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { cartId, cartItemId } = await req.json();
    await cartService.correctScan(cartId, cartItemId);
    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
});
