// No auth/session model exists in this app (self-checkout kiosk, not a
// logged-in-user product — see CLAUDE.md), so these functions are deployed
// with verify_jwt = false (supabase/config.toml) and called with just the
// anon key. CORS is wide open for the same reason: there's no per-user
// credential to scope it to. A real multi-kiosk deployment would want a
// shared kiosk secret or mTLS in front of this — out of scope here.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  });
}

export function errorResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return jsonResponse({ error: message }, { status: 400 });
}
