import { describe, it, expect } from 'vitest';
import { catchupFactor, spreadBehindFor, monkeyRemapItem } from '../../src/engine/RaceEngine.ts';
import { CATCHUP } from '../../src/engine/tuning.ts';
import { createRng } from '../../src/engine/prng.ts';
import { makeRacer as racer } from './fixtures.ts';

// Behaviour-documenting tests for the pure helpers promoted from RaceEngine's
// closure to module-level exports (P3). No RaceEngine instance needed.

describe('catchupFactor', () => {
  const ctx = { meanProgress: 100, spreadBehind: 1, trackLength: 1000 };

  it('inside the dead zone → no correction (1)', () => {
    const self = racer({ progress: ctx.meanProgress }); // gap 0
    expect(catchupFactor(self, ctx)).toBe(1);
  });

  it('trailing beyond the dead zone → boosted (> 1)', () => {
    const self = racer({ progress: ctx.meanProgress - ctx.trackLength * 0.1 }); // 0.1 lap behind
    expect(catchupFactor(self, ctx)).toBeGreaterThan(1);
  });

  it('leading beyond the dead zone → dragged (< 1)', () => {
    const self = racer({ progress: ctx.meanProgress + ctx.trackLength * 0.1 }); // 0.1 lap ahead
    expect(catchupFactor(self, ctx)).toBeLessThan(1);
  });

  it('clamps to CATCHUP.maxBoost / minBoost for extreme gaps', () => {
    const farBehind = racer({ progress: ctx.meanProgress - ctx.trackLength * 5 });
    const farAhead = racer({ progress: ctx.meanProgress + ctx.trackLength * 5 });
    expect(catchupFactor(farBehind, ctx)).toBe(CATCHUP.maxBoost);
    expect(catchupFactor(farAhead, ctx)).toBe(CATCHUP.minBoost);
  });

  it('spreadBehind scales the trailer tailwind only (leader drag unaffected)', () => {
    // Small gap, clear of the maxBoost clamp, so the proportionality is visible.
    const self = racer({ progress: ctx.meanProgress - ctx.trackLength * 0.02 });
    const full = catchupFactor(self, { ...ctx, spreadBehind: 1 });
    const faded = catchupFactor(self, { ...ctx, spreadBehind: 0.5 });
    expect(faded - 1).toBeCloseTo((full - 1) * 0.5, 10);
  });
});

describe('spreadBehindFor', () => {
  it('at/below the knee → no fade (1)', () => {
    expect(spreadBehindFor(0)).toBe(1);
    expect(spreadBehindFor(CATCHUP.spread.kneeAt)).toBe(1);
  });

  it('above the knee → fades linearly by behindFade per extra racer', () => {
    const over = 3;
    const expected = 1 - over * CATCHUP.spread.behindFade;
    expect(spreadBehindFor(CATCHUP.spread.kneeAt + over)).toBeCloseTo(expected, 10);
  });

  it('floors at behindMin for a very large field', () => {
    expect(spreadBehindFor(1000)).toBe(CATCHUP.spread.behindMin);
  });
});

describe('monkeyRemapItem', () => {
  it('shell while leading → fart (would self-stun otherwise)', () => {
    expect(monkeyRemapItem('shell', true, createRng(1))).toBe('fart');
  });

  it('shell while NOT leading → unchanged', () => {
    expect(monkeyRemapItem('shell', false, createRng(1))).toBe('shell');
  });

  it('fart while NOT leading → shell (snipes the leader instead)', () => {
    expect(monkeyRemapItem('fart', false, createRng(1))).toBe('shell');
  });

  it('fart while leading → unchanged', () => {
    expect(monkeyRemapItem('fart', true, createRng(1))).toBe('fart');
  });

  it('star is never remapped', () => {
    expect(monkeyRemapItem('star', true, createRng(1))).toBe('star');
    expect(monkeyRemapItem('star', false, createRng(1))).toBe('star');
  });

  it('lightning is upgraded to star on some seeds, stays lightning on others (gated roll)', () => {
    const results = new Set<string>();
    for (let seed = 0; seed < 50; seed++) results.add(monkeyRemapItem('lightning', true, createRng(seed)));
    expect(results).toEqual(new Set(['lightning', 'star']));
  });

  it('is deterministic for a given (kind, isLeader, rng state)', () => {
    expect(monkeyRemapItem('lightning', true, createRng(7))).toBe(monkeyRemapItem('lightning', true, createRng(7)));
  });
});
