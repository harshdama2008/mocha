import { runScenario } from '../engine';
import { ALL_SCENARIOS, goodwinHallScenario } from '../scenarios';

describe('replayer: scenario registry', () => {
  it('runs every registered scenario to completion without throwing', async () => {
    for (const scenario of ALL_SCENARIOS) {
      await expect(runScenario(scenario)).resolves.toBeDefined();
    }
  });

  it('never loses the permanent Goodwin Hall regression test from the registry', () => {
    expect(ALL_SCENARIOS).toContain(goodwinHallScenario);
  });
});
