import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { backendClient } from './backendClient';

export const EXIT_GEOFENCE_TASK = 'mocha-exit-geofence';

export interface GeofenceRegion {
  /** Cart id — becomes the region identifier so the callback can report it straight back. */
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/**
 * Maps a raw OS geofencing callback to a backend exit event. No custom
 * GPS-drift or standard-deviation filtering here by design — CLAUDE.md is
 * explicit that this project trusts CLCircularRegion / Android's
 * Geofencing API's own exit-confidence logic rather than second-guessing
 * it with app-level smoothing.
 */
export async function handleGeofenceEvent(
  eventType: Location.GeofencingEventType,
  region: Pick<Location.LocationRegion, 'identifier'>
): Promise<void> {
  const cartId = region.identifier;
  if (!cartId) return;

  if (eventType === Location.GeofencingEventType.Exit) {
    await backendClient.recordExit(cartId, 'geofence_exit');
  } else if (eventType === Location.GeofencingEventType.Enter) {
    await backendClient.recordExit(cartId, 'geofence_enter');
  }
}

TaskManager.defineTask(EXIT_GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  await handleGeofenceEvent(eventType, region);
});

export async function startExitGeofence(region: GeofenceRegion): Promise<void> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Foreground location permission not granted');
  }
  // Exiting a store perimeter has to be detected while the app is
  // backgrounded (the phone is in a pocket on the way out), so this needs
  // background permission too.
  await Location.requestBackgroundPermissionsAsync();

  await Location.startGeofencingAsync(EXIT_GEOFENCE_TASK, [
    {
      identifier: region.identifier,
      latitude: region.latitude,
      longitude: region.longitude,
      radius: region.radius,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
}

export async function stopExitGeofence(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(EXIT_GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(EXIT_GEOFENCE_TASK);
  }
}
