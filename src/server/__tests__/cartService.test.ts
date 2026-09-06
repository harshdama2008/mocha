import { createCartService } from '../cartService';
import { createInMemoryStore } from '../testing/inMemoryStore';
import { createFakePaymentGateway } from '../testing/fakePaymentGateway';
import type { Item } from '../types';

const ENERGY_DRINK: Item = {
  id: 'item_energy_drink',
  barcode: '049000028911',
  name: 'Energy Drink',
  priceCents: 500,
  createdAt: new Date(0).toISOString(),
};

function setUp(correctionWindowMs = 10 * 60 * 1000) {
  const store = createInMemoryStore([ENERGY_DRINK]);
  const gateway = createFakePaymentGateway();
  const cartService = createCartService(store, gateway, { correctionWindowMs });
  return { store, gateway, cartService };
}

describe('cartService', () => {
  it('authorizes a PaymentIntent with capture_method-manual semantics on every scan', async () => {
    const { cartService, gateway } = setUp();
    const cart = await cartService.openCart({
      stripeCustomerId: 'cus_1',
      stripePaymentMethodId: 'pm_1',
    });

    const cartItem = await cartService.scanItem(cart.id, ENERGY_DRINK.barcode);

    expect(cartItem.stripePaymentIntentId).toBeTruthy();
    const intent = gateway.intents.get(cartItem.stripePaymentIntentId!);
    expect(intent?.status).toBe('requires_capture');
    expect(intent?.amountCents).toBe(ENERGY_DRINK.priceCents);
  });

  it('refuses to scan into a cart that is not open', async () => {
    const { cartService } = setUp();
    const cart = await cartService.openCart({ stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1' });
    await cartService.recordExitEvent(cart.id, 'geofence_exit');

    await expect(cartService.scanItem(cart.id, ENERGY_DRINK.barcode)).rejects.toThrow(/pending_capture/);
  });

  it('moves open -> pending_capture on the exit event and never skips it', async () => {
    const { cartService } = setUp();
    const cart = await cartService.openCart({ stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1' });
    await cartService.scanItem(cart.id, ENERGY_DRINK.barcode);

    const afterExit = await cartService.captureIfDue(cart.id, new Date(0));
    expect(afterExit.status).toBe('open'); // no exit event yet — must not jump straight to settled

    await cartService.recordExitEvent(cart.id, 'geofence_exit', new Date(0));
    const pending = await cartService.captureIfDue(cart.id, new Date(0));
    expect(pending.status).toBe('pending_capture');
  });

  it('captures exactly once after the correction window closes clean', async () => {
    const { cartService, gateway } = setUp(1000);
    const cart = await cartService.openCart({ stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1' });
    const cartItem = await cartService.scanItem(cart.id, ENERGY_DRINK.barcode);
    const exitTime = new Date(0);
    await cartService.recordExitEvent(cart.id, 'geofence_exit', exitTime);

    const tooEarly = await cartService.captureIfDue(cart.id, new Date(500));
    expect(tooEarly.status).toBe('pending_capture');
    expect(gateway.intents.get(cartItem.stripePaymentIntentId!)?.status).toBe('requires_capture');

    const settled = await cartService.captureIfDue(cart.id, new Date(1000));
    expect(settled.status).toBe('settled');
    expect(gateway.intents.get(cartItem.stripePaymentIntentId!)?.status).toBe('captured');

    // Calling again (e.g. a duplicate sweep tick) must not re-capture.
    const again = await cartService.captureIfDue(cart.id, new Date(2000));
    expect(again.status).toBe('settled');
  });

  it('cancels the PaymentIntent instead of capturing when a dispute is flagged in the window', async () => {
    const { cartService, gateway } = setUp(1000);
    const cart = await cartService.openCart({ stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1' });
    const cartItem = await cartService.scanItem(cart.id, ENERGY_DRINK.barcode);
    await cartService.recordExitEvent(cart.id, 'geofence_exit', new Date(0));

    const disputed = await cartService.flagDispute(cart.id, 'never scanned this', new Date(200));
    expect(disputed.reason).toBe('never scanned this');
    expect(gateway.intents.get(cartItem.stripePaymentIntentId!)?.status).toBe('canceled');

    // The window elapsing afterward must not capture a disputed cart.
    const swept = await cartService.captureIfDue(cart.id, new Date(5000));
    expect(swept.status).toBe('disputed');
  });

  it('never lets status move backwards: a settled cart cannot be disputed', async () => {
    const { cartService } = setUp(1000);
    const cart = await cartService.openCart({ stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1' });
    await cartService.scanItem(cart.id, ENERGY_DRINK.barcode);
    await cartService.recordExitEvent(cart.id, 'geofence_exit', new Date(0));
    await cartService.captureIfDue(cart.id, new Date(1000));

    await expect(cartService.flagDispute(cart.id, 'too late', new Date(2000))).rejects.toThrow(/settled/);
  });

  it('a re-entry during the correction window does not reopen the cart', async () => {
    const { cartService } = setUp(1000);
    const cart = await cartService.openCart({ stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1' });
    await cartService.scanItem(cart.id, ENERGY_DRINK.barcode);
    await cartService.recordExitEvent(cart.id, 'geofence_exit', new Date(0));

    await cartService.recordExitEvent(cart.id, 'geofence_enter', new Date(100));
    const stillPending = await cartService.captureIfDue(cart.id, new Date(100));
    expect(stillPending.status).toBe('pending_capture');
  });
});
