import type { AuthorizeParams, PaymentGateway } from '../paymentGateway';

export type FakeIntentStatus = 'requires_capture' | 'captured' | 'canceled';

export interface FakeIntent {
  id: string;
  amountCents: number;
  status: FakeIntentStatus;
  metadata: Record<string, string>;
}

let counter = 0;

/**
 * In-process stand-in for Stripe used by unit tests and the replayer. Mimics
 * just enough of manual-capture PaymentIntent semantics to catch state-
 * machine bugs: capturing or canceling twice, or capturing something already
 * canceled, throws the way a real Stripe call would (a card_error/
 * StripeInvalidRequestError from an intent no longer in `requires_capture`).
 */
export function createFakePaymentGateway(): PaymentGateway & { intents: Map<string, FakeIntent> } {
  const intents = new Map<string, FakeIntent>();

  return {
    intents,

    async authorize(params: AuthorizeParams) {
      counter += 1;
      const id = `pi_fake_${counter}`;
      intents.set(id, {
        id,
        amountCents: params.amountCents,
        status: 'requires_capture',
        metadata: params.metadata,
      });
      return { id };
    },

    async capture(paymentIntentId: string) {
      const intent = intents.get(paymentIntentId);
      if (!intent) throw new Error(`capture: unknown PaymentIntent ${paymentIntentId}`);
      if (intent.status !== 'requires_capture') {
        throw new Error(`capture: PaymentIntent ${paymentIntentId} is ${intent.status}, not capturable`);
      }
      intent.status = 'captured';
    },

    async cancel(paymentIntentId: string) {
      const intent = intents.get(paymentIntentId);
      if (!intent) throw new Error(`cancel: unknown PaymentIntent ${paymentIntentId}`);
      if (intent.status !== 'requires_capture') {
        throw new Error(`cancel: PaymentIntent ${paymentIntentId} is ${intent.status}, not cancelable`);
      }
      intent.status = 'canceled';
    },
  };
}
