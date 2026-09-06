// Nothing else calls captureIfDue on a schedule — in production this needs
// a periodic trigger (Supabase Dashboard Cron, or pg_cron + pg_net calling
// this function's URL) which is a deploy-time infra step, not code, and
// out of scope here. Exposed as its own callable function so it can also
// be invoked directly for verification (see scripts/replay-live.ts).
import { cartService } from '../_shared/backend.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const results = await cartService.sweepDueCaptures();
    return jsonResponse({ settled: results.filter((c) => c.status === 'settled').map((c) => c.id) });
  } catch (err) {
    return errorResponse(err);
  }
});
