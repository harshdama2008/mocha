import { buildCartReceipt } from '../../src/server/cartReceipt';
import { runScenario } from '../engine';
import { disputeCancelsInWindowScenario } from '../scenarios/disputeCancelsInWindow';
import { goodwinHallScenario } from '../scenarios/goodwinHall';

// The cart-status Edge Function is buildCartReceipt fed from the real
// store at the end of a replay — this exercises it against the same
// scenarios the rest of the replayer already runs, rather than adding a
// parallel synthetic path.
describe('cart-status receipt (via the replayer)', () => {
  it('shows the settled total and excludes the voided duplicate (Goodwin Hall)', async () => {
    const result = await runScenario(goodwinHallScenario);
    const receipt = buildCartReceipt(result.cart, result.cartItems, goodwinHallScenario.items);

    expect(receipt.status).toBe('settled');
    expect(receipt.totalCents).toBe(500); // one Energy Drink, not two
    expect(receipt.lines).toEqual([{ name: 'Energy Drink', priceCents: 500 }]);
  });

  it('reports disputed without needing the client to compute anything from raw table rows', async () => {
    const result = await runScenario(disputeCancelsInWindowScenario);
    const receipt = buildCartReceipt(result.cart, result.cartItems, disputeCancelsInWindowScenario.items);

    expect(receipt.status).toBe('disputed');
  });
});
