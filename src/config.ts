// Single source of truth for the correction-window duration (hard invariant
// #3 in CLAUDE.md: configurable via one constant, not hardcoded in multiple
// places). Everything that needs the window imports this.
export const CORRECTION_WINDOW_MS = 10 * 60 * 1000;
