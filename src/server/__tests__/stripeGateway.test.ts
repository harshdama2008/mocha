const mockCreate = jest.fn();
const mockCapture = jest.fn();
const mockCancel = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockCreate,
      capture: mockCapture,
      cancel: mockCancel,
    },
  }));
});

describe('stripeGateway', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, STRIPE_SECRET_KEY: 'sk_test_fake' };
    mockCreate.mockReset();
    mockCapture.mockReset();
    mockCancel.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('authorizes with capture_method manual, confirmed off_session', async () => {
    mockCreate.mockResolvedValue({ id: 'pi_123' });
    const { stripeGateway } = require('../stripeGateway');

    const result = await stripeGateway.authorize({
      amountCents: 500,
      customerId: 'cus_1',
      paymentMethodId: 'pm_1',
      metadata: { cartId: 'cart_1', itemId: 'item_1' },
    });

    expect(result.id).toBe('pi_123');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500,
        currency: 'usd',
        customer: 'cus_1',
        payment_method: 'pm_1',
        capture_method: 'manual',
        confirm: true,
        off_session: true,
      })
    );
  });

  it('refuses to build a client with a live secret key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_definitely_real';
    const { getStripeClient } = require('../stripeClient');
    expect(() => getStripeClient()).toThrow(/live/);
  });

  it('captures and cancels by PaymentIntent id', async () => {
    const { stripeGateway } = require('../stripeGateway');
    await stripeGateway.capture('pi_123');
    expect(mockCapture).toHaveBeenCalledWith('pi_123');

    await stripeGateway.cancel('pi_456');
    expect(mockCancel).toHaveBeenCalledWith('pi_456');
  });
});
