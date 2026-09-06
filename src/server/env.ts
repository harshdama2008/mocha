// cartService and its adapters run in two different JS runtimes: Node (this
// repo's tests) and Deno (the deployed Supabase Edge Function — see
// supabase/functions/). Both expose env vars differently (process.env vs.
// Deno.env.get), so this is the one place that difference is bridged,
// keeping stripeClient.ts/supabaseAdmin.ts identical in both runtimes. No
// ambient `declare const Deno` here on purpose — Deno provides its own
// global type for it, and redeclaring would conflict when Deno type-checks
// this file as part of the deployed function.
export function getEnv(name: string, ...fallbackNames: string[]): string | undefined {
  for (const candidate of [name, ...fallbackNames]) {
    if (typeof process !== 'undefined' && process.env && process.env[candidate] !== undefined) {
      return process.env[candidate];
    }
    const denoEnv = (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno
      ?.env;
    const value = denoEnv?.get(candidate);
    if (value !== undefined) return value;
  }
  return undefined;
}
