import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { backendClient, type CartReceipt } from '@/lib/backendClient';

// Frequent enough that a shopper isn't left wondering for long after their
// charge actually settles, without polling the cart-status Edge Function
// on every render.
const POLL_INTERVAL_MS = 4000;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// The screen this whole feature was missing: reachable after exit (from
// the Scan screen) or from the correction screen, it polls cart-status
// (service-role read, since RLS denies the anon key on carts directly)
// until the cart leaves pending_capture, then shows what actually happened.
export default function StatusScreen() {
  const { cartId } = useLocalSearchParams<{ cartId: string }>();
  const [receipt, setReceipt] = useState<CartReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSettledRef = useRef(false);

  useEffect(() => {
    if (!cartId) return;
    isSettledRef.current = false;

    async function poll() {
      try {
        const result = await backendClient.getCartStatus(cartId);
        setReceipt(result);
        setError(null);
        if (result.status === 'settled' || result.status === 'disputed') {
          isSettledRef.current = true;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not check charge status.');
      }
    }

    poll();
    const interval = setInterval(() => {
      if (!isSettledRef.current) poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cartId]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle">Charge status</ThemedText>

        {!receipt && !error && <ThemedText type="small">Checking your charge…</ThemedText>}
        {error && <ThemedText type="small">{error}</ThemedText>}

        {receipt?.status === 'open' && (
          <ThemedText type="small">Waiting for you to leave the store…</ThemedText>
        )}

        {receipt?.status === 'pending_capture' && (
          <ThemedText type="small">
            Still inside the correction window. Checking again shortly.
          </ThemedText>
        )}

        {receipt?.status === 'settled' && (
          <ThemedView type="backgroundElement" style={styles.receipt}>
            <ThemedText type="smallBold">Charged {formatCents(receipt.totalCents)}</ThemedText>
            {receipt.lines.map((line, index) => (
              <ThemedText key={index} type="small">
                {line.name} — {formatCents(line.priceCents)}
              </ThemedText>
            ))}
          </ThemedView>
        )}

        {receipt?.status === 'disputed' && (
          <ThemedText type="small">This charge was flagged and will not be captured.</ThemedText>
        )}

        <Pressable onPress={() => router.back()}>
          <ThemedText type="link">Back</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  receipt: {
    gap: Spacing.one,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
});
