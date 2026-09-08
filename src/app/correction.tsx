import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { backendClient } from '@/lib/backendClient';

interface Line {
  cartItemId: string;
  name: string;
}

// The correction-window UI: the shopper's one chance to catch a mistake
// (like scanning the same item twice — the Goodwin Hall case) before the
// charge settles. Flagging here cancels the PaymentIntent(s) instead of
// letting them capture; see cartService.flagDispute.
export default function CorrectionScreen() {
  const { cartId, linesJson } = useLocalSearchParams<{ cartId: string; linesJson?: string }>();
  const lines: Line[] = linesJson ? JSON.parse(linesJson) : [];
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFlag() {
    if (!cartId || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await backendClient.flagDispute(cartId, reason.trim() || 'flagged from the correction screen');
      setStatus('Charge flagged. It will not be captured.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not flag this charge.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle">Review your charge</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You have a few minutes after leaving to catch a mistake before the charge settles.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.receipt}>
          {lines.length === 0 && <ThemedText type="small">No items on this cart.</ThemedText>}
          {lines.map((line) => (
            <ThemedText key={line.cartItemId}>{line.name}</ThemedText>
          ))}
        </ThemedView>

        <TextInput
          style={styles.input}
          placeholder="What's wrong? (optional)"
          value={reason}
          onChangeText={setReason}
        />

        <Pressable onPress={handleFlag} disabled={submitting || !cartId}>
          <ThemedView type="backgroundSelected" style={styles.flagButton}>
            <ThemedText type="smallBold">
              {submitting ? 'Flagging…' : 'Flag this charge'}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {status && <ThemedText type="small">{status}</ThemedText>}

        {cartId && (
          <Pressable onPress={() => router.push({ pathname: '/status', params: { cartId } })}>
            <ThemedText type="link">View charge status</ThemedText>
          </Pressable>
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
  input: {
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
  },
  flagButton: {
    alignItems: 'center',
    borderRadius: Spacing.five,
    paddingVertical: Spacing.three,
  },
});
