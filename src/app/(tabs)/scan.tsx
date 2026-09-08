import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { STORE_EXIT_GEOFENCE } from '@/config';
import { backendClient } from '@/lib/backendClient';
import { startExitGeofence } from '@/lib/geofencing';
import { resolveItemByBarcode } from '@/lib/testItems';

interface ScannedLine {
  cartItemId: string;
  name: string;
}

// Scans stop reaching onScan while a lookup is in flight, and the same
// barcode is ignored until the shopper moves the camera off it — otherwise
// one item sitting in frame fires dozens of scans a second.
const RESCAN_COOLDOWN_MS = 1500;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cartId, setCartId] = useState<string | null>(null);
  const [lines, setLines] = useState<ScannedLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const busyRef = useRef(false);
  const lastBarcodeRef = useRef<{ data: string; at: number } | null>(null);

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    const now = Date.now();
    if (busyRef.current) return;
    if (lastBarcodeRef.current?.data === data && now - lastBarcodeRef.current.at < RESCAN_COOLDOWN_MS) {
      return;
    }
    lastBarcodeRef.current = { data, at: now };

    const knownItem = resolveItemByBarcode(data);
    if (!knownItem) {
      setStatus(`Unrecognized barcode: ${data}`);
      return;
    }

    busyRef.current = true;
    setStatus(`Adding ${knownItem.name}…`);

    (async () => {
      try {
        let activeCartId = cartId;
        if (!activeCartId) {
          const opened = await backendClient.openCart();
          activeCartId = opened.cartId;
          setCartId(activeCartId);
          // Arm the exit geofence as soon as there's a cart to close out —
          // the OS callback (src/lib/geofencing.ts) fires recordExit
          // whenever the shopper actually leaves, no polling from here.
          startExitGeofence({ identifier: activeCartId, ...STORE_EXIT_GEOFENCE }).catch(() => {
            setStatus('Could not arm exit detection — grant location access to finish checkout.');
          });
        }
        const result = await backendClient.scanItem(activeCartId, data);
        setLines((prev) => [...prev, { cartItemId: result.cartItemId, name: result.itemName }]);
        setStatus(`Added ${knownItem.name}`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not authorize that scan');
      } finally {
        busyRef.current = false;
      }
    })();
  }, [cartId]);

  if (!permission) {
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="subtitle" style={styles.centerText}>
            Camera access needed
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Mocha needs the camera to scan item barcodes.
          </ThemedText>
          <Pressable onPress={requestPermission}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText type="link">Grant permission</ThemedText>
            </ThemedView>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={styles.receipt} edges={['bottom']}>
        {status && (
          <ThemedText type="small" style={styles.status}>
            {status}
          </ThemedText>
        )}
        {lines.map((line) => (
          <ThemedText key={line.cartItemId} type="default">
            {line.name}
          </ThemedText>
        ))}
        {cartId && lines.length > 0 && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/correction',
                params: { cartId, linesJson: JSON.stringify(lines) },
              })
            }>
            <ThemedText type="link">Review &amp; flag this charge</ThemedText>
          </Pressable>
        )}
        {cartId && lines.length > 0 && (
          <Pressable onPress={() => router.push({ pathname: '/status', params: { cartId } })}>
            <ThemedText type="link">Check charge status</ThemedText>
          </Pressable>
        )}
        {/* __DEV__ is a React Native global that's always false in a
            production/release bundle — this can never ship visible.
            Real exits come from the OS geofence callback (src/lib/geofencing.ts)
            firing on an actual location change; the Android emulator's
            Geofencer has been refusing to arm that at all ("registration
            not permitted"), so there's currently no way to reach the exit
            step on-device without this. It calls the exact same
            backendClient.recordExit the real callback calls — same
            Edge Function, same cartService.recordExitEvent, same
            open -> pending_capture transition and capture-window math.
            This only substitutes for the OS trigger, not anything
            downstream of it. */}
        {__DEV__ && cartId && (
          <Pressable
            onPress={async () => {
              try {
                await backendClient.recordExit(cartId, 'geofence_exit');
                setStatus('Simulated exit recorded (dev only — not real exit detection).');
              } catch (err) {
                setStatus(err instanceof Error ? err.message : 'Could not simulate exit.');
              }
            }}>
            <ThemedText type="link">Simulate exit (dev only)</ThemedText>
          </Pressable>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  receipt: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  status: {
    opacity: 0.7,
  },
});
