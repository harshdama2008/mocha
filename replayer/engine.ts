// The synthetic event replayer required by CLAUDE.md's testing section:
// fake scan -> exit -> capture/dispute sequences hitting the backend
// (cartService) directly, no phone or beacon required. It runs the real
// state machine from src/server/cartService.ts against the in-memory
// fakes from src/server/testing/, so a scenario here exercises exactly
// the same code path a deployed backend would.
import { createCartService, type CartService } from '../src/server/cartService';
import { createFakePaymentGateway, type FakeIntent } from '../src/server/testing/fakePaymentGateway';
import { createInMemoryStore } from '../src/server/testing/inMemoryStore';
import type { Cart, CartItem, ExitMethod, Item } from '../src/server/types';

export type ReplayEvent =
  | { type: 'scan'; barcode: string; at: number }
  | { type: 'correctLastScan'; at: number }
  | { type: 'exit'; method?: ExitMethod; at: number }
  | { type: 'dispute'; reason: string; at: number }
  | { type: 'tick'; at: number };

export interface ReplayScenario {
  name: string;
  description: string;
  items: Item[];
  customer: { stripeCustomerId: string; stripePaymentMethodId: string };
  correctionWindowMs?: number;
  events: ReplayEvent[];
}

export interface ReplayResult {
  cart: Cart;
  /** Every cart_item including voided ones, in scan order. */
  cartItems: CartItem[];
  intents: Map<string, FakeIntent>;
  /** The live cartService bound to this run's store/gateway, for scenarios that assert a call after the scripted events is rejected (e.g. capture-then-dispute). */
  cartService: CartService;
}

export async function runScenario(scenario: ReplayScenario): Promise<ReplayResult> {
  const store = createInMemoryStore(scenario.items);
  const gateway = createFakePaymentGateway();
  const cartService = createCartService(store, gateway, {
    correctionWindowMs: scenario.correctionWindowMs,
  });

  const cart = await cartService.openCart(scenario.customer);
  const scannedItems: CartItem[] = [];

  for (const event of scenario.events) {
    const now = new Date(event.at);
    switch (event.type) {
      case 'scan': {
        const cartItem = await cartService.scanItem(cart.id, event.barcode);
        scannedItems.push(cartItem);
        break;
      }
      case 'correctLastScan': {
        const last = scannedItems[scannedItems.length - 1];
        if (!last) throw new Error('replayer: correctLastScan with no prior scan');
        await cartService.correctScan(cart.id, last.id, now);
        break;
      }
      case 'exit': {
        await cartService.recordExitEvent(cart.id, event.method ?? 'geofence_exit', now);
        break;
      }
      case 'dispute': {
        await cartService.flagDispute(cart.id, event.reason, now);
        break;
      }
      case 'tick': {
        await cartService.captureIfDue(cart.id, now);
        break;
      }
      default: {
        const exhaustive: never = event;
        throw new Error(`replayer: unhandled event ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  const finalCart = await store.getCart(cart.id);
  const finalItems = await store.listCartItems(cart.id, { includeVoided: true });
  return { cart: finalCart, cartItems: finalItems, intents: gateway.intents, cartService };
}
