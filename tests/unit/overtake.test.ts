import { describe, it, expect } from 'vitest';
import { applyOvertake, OVERTAKE, laneDistanceFactor } from '../../src/engine/overtake.ts';
import { LANE } from '../../src/engine/tuning.ts';
import { createRng } from '../../src/engine/prng.ts';
import type { RacerState } from '../../src/engine/types.ts';

function racer(over: Partial<RacerState>): RacerState {
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

describe('overtake / blocking', () => {
  it('clear ahead → drifts back toward its home lane', () => {
    const self = racer({ lane: 0.8, homeLane: 0.3, progress: 10 });
    applyOvertake(self, [self], createRng(1), 0);
    expect(self.lane).toBeLessThan(0.8); // moving toward home (0.3)
    expect(self.phase).toBe('running');
  });

  it('boxed in (front and both sides blocked) → decelerates', () => {
    const g = OVERTAKE.nearAhead * 0.5;
    const self = racer({ id: 's', lane: 0.5, progress: 10, speed: 3 });
    const front = racer({ id: 'f', lane: 0.5, progress: 10 + g, speed: 1 });
    const out = racer({ id: 'o', lane: 0.5 + OVERTAKE.laneStep, progress: 10 + g, speed: 1 });
    const inn = racer({ id: 'i', lane: 0.5 - OVERTAKE.laneStep, progress: 10 + g, speed: 1 });
    applyOvertake(self, [self, front, out, inn], createRng(1), 0);
    expect(self.phase).toBe('blocked');
    expect(self.speed).toBeLessThan(3);
  });

  it('blocked with an open side → weaves to pass instead of stalling', () => {
    const g = OVERTAKE.nearAhead * 0.5;
    const self = racer({ id: 's', lane: 0.5, homeLane: 0.5, progress: 10, speed: 3 });
    const front = racer({ id: 'f', lane: 0.5, progress: 10 + g, speed: 1 });
    // both neighbours open → should pick a side (lane changes away from 0.5)
    let weaved = false;
    for (let seed = 0; seed < 8; seed++) {
      const s = { ...self };
      applyOvertake(s, [s, front], createRng(seed), 0);
      if (s.phase === 'running' && Math.abs(s.lane - 0.5) > 0.001) weaved = true;
    }
    expect(weaved).toBe(true);
  });

  it('straying racers plow ahead unaffected', () => {
    const self = racer({ id: 's', lane: 0.2, progress: 10, speed: 8, phase: 'straying' });
    const front = racer({ id: 'f', lane: 0.2, progress: 11, speed: 1 });
    applyOvertake(self, [self, front], createRng(1), 0);
    expect(self.phase).toBe('straying');
    expect(self.speed).toBe(8);
  });
});

describe('laneDistanceFactor — 벽타기 (outerGrip)', () => {
  it('on a STRAIGHT, lane (and grip) never cost distance', () => {
    for (const lane of [0, 0.5, 1]) {
      expect(laneDistanceFactor(lane, false, 0)).toBe(1);
      expect(laneDistanceFactor(lane, false, 0.5)).toBe(1);
      expect(laneDistanceFactor(lane, false, 1)).toBe(1);
    }
  });

  it('on a CURVE, outerGrip eases the outer-rail distance penalty (and never reverses it)', () => {
    const lane = 1; // outer rail = full penalty
    const none = laneDistanceFactor(lane, true, 0); // 1 - distLoss
    const half = laneDistanceFactor(lane, true, 0.5); // spider's start value
    const full = laneDistanceFactor(lane, true, 1); // grips fully → no penalty

    expect(none).toBeCloseTo(1 - LANE.distLoss, 10);
    expect(full).toBeCloseTo(1, 10); // outerGrip 1 cancels the whole penalty
    // A gripper covers MORE distance for the same speed out wide than a non-gripper.
    expect(half).toBeGreaterThan(none);
    expect(half).toBeLessThan(full);
    // grip 0.5 cancels exactly half the loss.
    expect(1 - half).toBeCloseTo((1 - none) * 0.5, 10);
    // Default arg (no grip) === explicit 0 (back-compat for existing call sites).
    expect(laneDistanceFactor(lane, true)).toBe(none);
  });
});
