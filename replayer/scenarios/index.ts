import type { ReplayScenario } from '../engine';
import { captureThenDisputeScenario } from './captureThenDispute';
import { disputeCancelsInWindowScenario } from './disputeCancelsInWindow';
import { exitThenReturnScenario } from './exitThenReturn';
import { goodwinHallScenario } from './goodwinHall';
import { scanSmallItemSetScenario } from './scanSmallItemSet';

// Every scenario the replayer knows about, in the order CLAUDE.md's build
// order introduced their underlying feature. goodwinHallScenario must
// always be in this list — see its own file for why.
export const ALL_SCENARIOS: ReplayScenario[] = [
  scanSmallItemSetScenario,
  exitThenReturnScenario,
  goodwinHallScenario,
  disputeCancelsInWindowScenario,
  captureThenDisputeScenario,
];

export {
  captureThenDisputeScenario,
  disputeCancelsInWindowScenario,
  exitThenReturnScenario,
  goodwinHallScenario,
  scanSmallItemSetScenario,
};
