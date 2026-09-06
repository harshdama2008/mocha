import { runScenario } from '../engine';
import { goodwinHallScenario } from '../scenarios/goodwinHall';

// PERMANENT REGRESSION TEST — CLAUDE.md hard invariant #4. Do not delete,
// skip, or weaken this test (or goodwinHall.ts) to make a build pass. If
// this fails, the bug is in src/server/cartService.ts, not here.
describe('replayer: Goodwin Hall (permanent regression test)', () => {
  it('captures the one drink actually taken and cancels the accidental duplicate', async () => {
    const result = await runScenario(goodwinHallScenario);

    expect(result.cart.status).toBe('settled');
    expect(result.cartItems).toHaveLength(2);

    const [original, duplicate] = result.cartItems;
    expect(original.voidedAt).toBeNull();
    expect(duplicate.voidedAt).not.toBeNull();

    const originalIntent = result.intents.get(original.stripePaymentIntentId!);
    const duplicateIntent = result.intents.get(duplicate.stripePaymentIntentId!);
    expect(originalIntent?.status).toBe('captured');
    expect(duplicateIntent?.status).toBe('canceled');
  });
});
