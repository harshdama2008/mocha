// Single source of truth for the correction-window duration (hard invariant
// #3 in CLAUDE.md: configurable via one constant, not hardcoded in multiple
// places). Everything that needs the window imports this.
export const CORRECTION_WINDOW_MS = 10 * 60 * 1000;

// Placeholder perimeter for the single unattended micro-store this project
// targets. Replace with the real store's coordinates/radius at deploy time —
// this is the one place that needs to change.
export const STORE_EXIT_GEOFENCE = {
  latitude: 0,
  longitude: 0,
  radius: 50, // meters
};
