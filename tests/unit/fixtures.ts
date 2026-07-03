import type { RacerState } from '../../src/engine/types.ts';

/**
 * Minimal valid RacerState for unit-testing pure engine functions
 * (applyOvertake, laneDistanceFactor, promoted RaceEngine helpers, …)
 * without running simulateRace. Override only what the test cares about.
 */
export function makeRacer(over: Partial<RacerState> = {}): RacerState {
  return {
    id: 'x',
    characterId: 'dog',
    progress: 0,
    lane: 0.5,
    homeLane: 0.5,
    speed: 3,
    baseSpeed: 3,
    phase: 'running',
    facing: 0,
    skillCooldownUntil: 0,
    startHoldUntil: 0,
    skill: {},
    ...over,
  };
}
