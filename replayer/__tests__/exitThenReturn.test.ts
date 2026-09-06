import { runScenario } from '../engine';
import { exitThenReturnScenario } from '../scenarios/exitThenReturn';

describe('replayer: exit-then-return', () => {
  it('stays pending_capture through the re-entry, then settles once the original window elapses', async () => {
    const result = await runScenario(exitThenReturnScenario);

    expect(result.cart.status).toBe('settled');
    expect(result.cartItems).toHaveLength(1);
    const intent = result.intents.get(result.cartItems[0].stripePaymentIntentId!);
    expect(intent?.status).toBe('captured');
  });
});
