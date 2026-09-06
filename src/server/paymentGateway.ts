// Abstraction over Stripe so cartService's state machine can be exercised by
// the replayer and unit tests without a network call or a real test-mode
// key, and so the kiosk's authorize/capture/cancel calls all go through one
// audited seam.

export interface AuthorizeParams {
  amountCents: number;
  customerId: string;
  paymentMethodId: string;
  metadata: Record<string, string>;
}

export interface AuthorizedPaymentIntent {
  id: string;
}

export interface PaymentGateway {
  /** capture_method: manual, confirmed off_session — hard invariant #2. */
  authorize(params: AuthorizeParams): Promise<AuthorizedPaymentIntent>;
  /** Fires at most once per PaymentIntent; callers enforce the "exactly once". */
  capture(paymentIntentId: string): Promise<void>;
  /** Used for pre-capture corrections (Goodwin Hall) and disputes. */
  cancel(paymentIntentId: string): Promise<void>;
}
