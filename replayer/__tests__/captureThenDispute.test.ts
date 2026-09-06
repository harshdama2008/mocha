import { runScenario } from '../engine';
import { captureThenDisputeScenario } from '../scenarios/captureThenDispute';

describe('replayer: capture-then-dispute', () => {
  it('rejects a dispute flagged after capture and leaves the cart settled', async () => {
    const result = await runScenario(captureThenDisputeScenario);
    expect(result.cart.status).toBe('settled');

    await expect(result.cartService.flagDispute(result.cart.id, 'too late')).rejects.toThrow(
      /settled/
    );

    // Status must not have moved backwards to disputed after the rejected attempt.
    const stillSettled = await result.cartService.captureIfDue(result.cart.id, new Date(0));
    expect(stillSettled.status).toBe('settled');
  });
});
