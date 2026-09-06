import * as Location from 'expo-location';

const mockRecordExit = jest.fn();

jest.mock('../backendClient', () => ({
  backendClient: {
    recordExit: (...args: unknown[]) => mockRecordExit(...args),
  },
}));

import { handleGeofenceEvent } from '../geofencing';

describe('handleGeofenceEvent', () => {
  beforeEach(() => {
    mockRecordExit.mockReset();
  });

  it('records a geofence_exit on Exit, with no extra smoothing/filtering', async () => {
    await handleGeofenceEvent(Location.GeofencingEventType.Exit, { identifier: 'cart_1' });
    expect(mockRecordExit).toHaveBeenCalledWith('cart_1', 'geofence_exit');
  });

  it('records a geofence_enter on Enter (a return, not a reopen)', async () => {
    await handleGeofenceEvent(Location.GeofencingEventType.Enter, { identifier: 'cart_1' });
    expect(mockRecordExit).toHaveBeenCalledWith('cart_1', 'geofence_enter');
  });

  it('ignores a callback with no region identifier', async () => {
    await handleGeofenceEvent(Location.GeofencingEventType.Exit, { identifier: undefined as any });
    expect(mockRecordExit).not.toHaveBeenCalled();
  });
});
