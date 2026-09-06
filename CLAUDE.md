# Mocha

A self-scan checkout sandbox — named for the drink the founder never got to
buy the day this whole idea started.

## Origin

Built after being charged $35 for a $5 energy drink at an Amazon Just Walk
Out location, on a billing error that took real effort to get reversed. This
project is a smaller, honest alternative for a single unattended
campus micro-store: the user scans what they take, the charge settles a few
minutes after they leave, and there's a real window to catch a mistake
*before* money moves — not after.

## Non-goals — do not "improve" toward these

- This is **not** a computer-vision loss-prevention system. It does not
  detect an unscanned item, a ticket-switch, or someone taking more than
  they scanned.
- If a future prompt asks for loss-prevention features, treat that as a
  new, separate system (weight sensors, RFID, audits) — do not bolt it onto
  this settlement pipeline.

## Stack

- **App:** React Native (Expo) — required for camera barcode scanning and
  background geofencing; a web app cannot do either reliably.
- **Backend/DB:** Supabase (Postgres).
- **Payments:** Stripe, **test mode only, always.** Never introduce a live
  key anywhere in this repo, in `.env`, or in a commit.
- **Exit signal:** OS-level geofencing (`CLCircularRegion` on iOS, the
  Geofencing API on Android). No custom GPS-drift/standard-deviation
  filtering — trust the platform's own exit-confidence logic.

## Data model

- `items` — barcode, name, price
- `carts` — status: `open` / `pending_capture` / `settled` / `disputed`
- `cart_items` — cart_id, item_id, scanned_at
- `exit_events` — cart_id, method, confirmed_at
- `disputes` — cart_id, reason, resolved_at

## Hard invariants — never violate these

1. Cart status only ever moves `open` → `pending_capture` → `settled` **or**
   `disputed`. Never backwards. Never skips `pending_capture`.
2. Stripe: authorize (`capture_method: manual`) on every scan. Capture
   fires **exactly once**, only after the correction window closes clean.
   A flagged dispute during the window cancels or adjusts the
   PaymentIntent instead of capturing.
3. Correction window default: 10 minutes after the exit event, configurable
   via one constant, not hardcoded in multiple places.
4. The Goodwin Hall scenario (accidental double-scan, caught and corrected
   before capture) is a **permanent regression test**. It must never be
   deleted, skipped, or weakened to make a build pass.

## Testing requirement

Every feature ships with a corresponding scenario in the synthetic event
replayer (fake scan → exit → capture/dispute sequences hitting the backend
directly, no phone or beacon required). No feature is done without one.

## Build order (six phases)

Work through these in order. A phase is only "done" once its tests and
replayer scenarios pass — then commit, then push.

1. **Schema** — the tables above, in Supabase.
2. **Stripe** — authorize on scan, capture on confirmed exit, cancel on
   dispute. All test mode.
3. **Scan flow** — React Native camera barcode scanning against a small set
   of test items.
4. **Exit signal** — OS geofencing exit callback, no custom filtering.
5. **Correction window** — `pending_capture` hold, the "flag this charge"
   UI, and the Goodwin Hall regression test.
6. **Replayer** — synthetic scan/exit/capture/dispute sequences, including
   double-scan, exit-then-return, and capture-then-dispute.

## Autonomy operating rules

This project runs with auto-approved permissions and pushes straight to
main after tests pass. Given that, these rules are load-bearing, not
suggestions:

- **Never edit anything under `tests/`.** If a test fails, the bug is in
  the implementation — fix that, not the assertion. (This is enforced by a
  hook, not just this instruction — see `.claude/settings.json`.)
- **Never use a non-test-mode credential.** Stripe and Supabase keys in
  this project are sandbox/test only, always.
- **Never rewrite git history** (no force-push, no interactive rebase on
  `main`). This is enforced by `.githooks/pre-push`, which also blocks any
  push where the test suite doesn't pass — that check runs no matter which
  tool or subagent issued the push.
- Commit after each phase, not just at the end of the run.
