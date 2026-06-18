import { describe, it, expect } from 'vitest';
import { applyOvertake, OVERTAKE } from '../../src/engine/overtake.ts';
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
