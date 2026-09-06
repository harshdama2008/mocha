import { getStripeClient } from './stripeClient';
import type { AuthorizedPaymentIntent, AuthorizeParams, PaymentGateway } from './paymentGateway';

/** Real Stripe-backed PaymentGateway. Test mode only, per CLAUDE.md. */
export const stripeGateway: PaymentGateway = {
  async authorize(params: AuthorizeParams): Promise<AuthorizedPaymentIntent> {
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.create({
      amount: params.amountCents,
      currency: 'usd',
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      metadata: params.metadata,
    });
    return { id: intent.id };
  },

  async capture(paymentIntentId: string): Promise<void> {
    const stripe = getStripeClient();
    await stripe.paymentIntents.capture(paymentIntentId);
  },

  async cancel(paymentIntentId: string): Promise<void> {
    const stripe = getStripeClient();
    await stripe.paymentIntents.cancel(paymentIntentId);
  },
};
