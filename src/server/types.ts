// Mirrors supabase/migrations/0001_init.sql. Keep these in sync by hand —
// there is no live database in this sandbox to generate them from.

export type CartStatus = 'open' | 'pending_capture' | 'settled' | 'disputed';

export interface Item {
  id: string;
  barcode: string;
  name: string;
  priceCents: number;
  createdAt: string;
}

export interface Cart {
  id: string;
  status: CartStatus;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  openedAt: string;
  pendingCaptureAt: string | null;
  captureDueAt: string | null;
  settledAt: string | null;
  disputedAt: string | null;
}

export interface CartItem {
  id: string;
  cartId: string;
  itemId: string;
  scannedAt: string;
  stripePaymentIntentId: string | null;
  voidedAt: string | null;
}

export type ExitMethod = 'geofence_exit' | 'geofence_enter' | 'manual';

export interface ExitEvent {
  id: string;
  cartId: string;
  method: ExitMethod;
  confirmedAt: string;
}

export interface Dispute {
  id: string;
  cartId: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}
