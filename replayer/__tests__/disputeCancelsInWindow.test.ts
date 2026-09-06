import { runScenario } from '../engine';
import { disputeCancelsInWindowScenario } from '../scenarios/disputeCancelsInWindow';

describe('replayer: dispute-cancels-in-window', () => {
  it('ends disputed with the PaymentIntent canceled, and the later window elapsing does not capture it', async () => {
    const result = await runScenario(disputeCancelsInWindowScenario);

    expect(result.cart.status).toBe('disputed');
    const intent = result.intents.get(result.cartItems[0].stripePaymentIntentId!);
    expect(intent?.status).toBe('canceled');
  });
});
