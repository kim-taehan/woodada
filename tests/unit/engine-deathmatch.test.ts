import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { makeConfig, allThree } from './helpers.ts';
import type { EngineFrame, RacerState } from '../../src/engine/types.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

// A 6-racer field (mix of skills) for death-match invariants.
const FIELD = [...allThree].slice(0, 6);

function lastRacers(frames: EngineFrame[]): RacerState[] {
  return frames[frames.length - 1].racers;
}

describe('engine death-match (elimination mode)', () => {
  it('same (config, seed) reproduces identical elimination order + ranks', () => {
    const a = simulateRace(makeConfig({ characterIds: FIELD, seed: 77, elimination: 'first' }), skills, scoring);
    const b = simulateRace(makeConfig({ characterIds: FIELD, seed: 77, elimination: 'first' }), skills, scoring);
    expect(a.result.order).toEqual(b.result.order);
    // Per-racer elimination order must match frame-for-frame too.
    const elimOrderA = lastRacers(a.frames).map((r) => `${r.id}:${r.eliminationOrder ?? 'survivor'}`);
    const elimOrderB = lastRacers(b.frames).map((r) => `${r.id}:${r.eliminationOrder ?? 'survivor'}`);
    expect(elimOrderA).toEqual(elimOrderB);
  });

  it('eliminates exactly one racer per lap and ends with a lone survivor', () => {
    const { frames, result } = simulateRace(
      makeConfig({ characterIds: FIELD, seed: 9, elimination: 'last' }),
      skills,
      scoring,
    );
    const racers = lastRacers(frames);

    // Final frame must report finished.
    expect(frames[frames.length - 1].finished).toBe(true);

    // Exactly N-1 eliminated, exactly 1 survivor.
    const eliminated = racers.filter((r) => r.phase === 'eliminated');
    const survivors = racers.filter((r) => r.phase !== 'eliminated');
    expect(eliminated.length).toBe(FIELD.length - 1);
    expect(survivors.length).toBe(1);

    // Elimination orders are a clean 1..N-1 permutation.
    const orders = eliminated.map((r) => r.eliminationOrder!).sort((x, y) => x - y);
    expect(orders).toEqual(Array.from({ length: FIELD.length - 1 }, (_, i) => i + 1));

    // Each elimination frame emits exactly one eliminate:out event, and the count
    // equals N-1 across the whole race.
    let outEvents = 0;
    for (const f of frames) {
      const outs = f.events.filter((e) => e.type === 'eliminate' && e.variant === 'out');
      expect(outs.length).toBeLessThanOrEqual(1);
      for (const e of outs) {
        // racerId is the eliminated racer.
        const r = f.racers.find((x) => x.id === e.racerId)!;
        expect(r.phase).toBe('eliminated');
      }
      outEvents += outs.length;
    }
    expect(outEvents).toBe(FIELD.length - 1);

    // result has a full, unique ranking over all racers.
    expect(result.order.length).toBe(FIELD.length);
    expect(new Set(result.order).size).toBe(FIELD.length);
  });

  it("'first' mode: earlier-eliminated ranks higher; survivor is last", () => {
    const { frames, result } = simulateRace(
      makeConfig({ characterIds: FIELD, seed: 41, elimination: 'first' }),
      skills,
      scoring,
    );
    const racers = lastRacers(frames);
    const byId = new Map(racers.map((r) => [r.id, r]));
    const n = FIELD.length;

    // rank == eliminationOrder for the eliminated; survivor == rank n.
    for (const id of result.order) {
      const r = byId.get(id)!;
      const rank = result.order.indexOf(id) + 1;
      if (r.eliminationOrder === undefined) {
        expect(rank).toBe(n); // survivor is worst
      } else {
        expect(rank).toBe(r.eliminationOrder); // 1st out = rank 1
      }
    }
    // First-out racer is ranked 1 (best).
    const firstOut = racers.find((r) => r.eliminationOrder === 1)!;
    expect(result.order[0]).toBe(firstOut.id);
  });

  it("'last' mode: earlier-eliminated ranks lower; survivor wins", () => {
    const { frames, result } = simulateRace(
      makeConfig({ characterIds: FIELD, seed: 41, elimination: 'last' }),
      skills,
      scoring,
    );
    const racers = lastRacers(frames);
    const byId = new Map(racers.map((r) => [r.id, r]));
    const n = FIELD.length;

    for (const id of result.order) {
      const r = byId.get(id)!;
      const rank = result.order.indexOf(id) + 1;
      if (r.eliminationOrder === undefined) {
        expect(rank).toBe(1); // survivor wins
      } else {
        expect(rank).toBe(n - r.eliminationOrder + 1); // 1st out = rank n (worst)
      }
    }
    // The survivor (no eliminationOrder) is ranked 1.
    const survivor = racers.find((r) => r.eliminationOrder === undefined)!;
    expect(result.order[0]).toBe(survivor.id);
    // First-out racer is last.
    const firstOut = racers.find((r) => r.eliminationOrder === 1)!;
    expect(result.order[n - 1]).toBe(firstOut.id);
  });

  it('an eliminated racer stops advancing (frozen progress after knock-out)', () => {
    const { frames } = simulateRace(
      makeConfig({ characterIds: FIELD, seed: 3, elimination: 'first' }),
      skills,
      scoring,
    );
    // Find the first racer to be eliminated and its eliminatedAt frame.
    const final = lastRacers(frames).find((r) => r.eliminationOrder === 1)!;
    const elimFrame = final.eliminatedAt!;
    const progressAtElim = frames[elimFrame].racers.find((r) => r.id === final.id)!.progress;
    // Its progress must never increase after elimination.
    for (let f = elimFrame + 1; f < frames.length; f++) {
      const r = frames[f].racers.find((x) => x.id === final.id)!;
      expect(r.phase).toBe('eliminated');
      expect(r.progress).toBeCloseTo(progressAtElim, 6);
    }
  });
});
