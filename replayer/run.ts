// Standalone entry point: `npm run replay`. Runs every scenario in
// scenarios/index.ts against the backend directly (cartService + the
// in-memory fakes) and prints a one-line summary each — the "fake scan ->
// exit -> capture/dispute sequences hitting the backend directly, no phone
// or beacon required" replayer CLAUDE.md's testing section asks for. The
// jest suites in __tests__/ are what actually gate CI; this is for a human
// to eyeball a run without launching the app.
import { runScenario } from './engine';
import { ALL_SCENARIOS } from './scenarios';

async function main() {
  let failed = false;

  for (const scenario of ALL_SCENARIOS) {
    try {
      const result = await runScenario(scenario);
      const voided = result.cartItems.filter((ci) => ci.voidedAt !== null).length;
      console.log(
        `[ok] ${scenario.name}: ${scenario.description}\n` +
          `     final status=${result.cart.status} items=${result.cartItems.length} voided=${voided}`
      );
    } catch (err) {
      failed = true;
      console.error(`[FAIL] ${scenario.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (failed) process.exit(1);
}

main();
