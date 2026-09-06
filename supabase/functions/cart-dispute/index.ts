import { cartService } from '../_shared/backend.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { cartId, reason } = await req.json();
    await cartService.flagDispute(cartId, reason);
    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
});
