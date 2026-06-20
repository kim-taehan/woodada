import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { makeConfig, allThree } from './helpers.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

/**
 * Spec §3 / §14: no character or start-slot should be heavily advantaged.
 *
 * NOTE: precise win-rate balance is intentionally DEFERRED while we iterate on
 * gameplay feel (skill numbers/behaviour may still change). These are loose
 * sanity checks — every character/slot must be able to win and none may
 * dominate — not the final ±tolerance balance gate.
 */
describe('engine fairness (loose sanity — balance tuned later)', () => {
  const ids = [...allThree, ...allThree]; // full roster ×2
  const charOfSlot = ids;

  // Fairness must hold across lap counts, not just single-lap. Multi-lap races run
  // ~Lx more frames, so N shrinks with laps to keep the suite fast. Thresholds are
  // LOOSE sanity (can-win floor / no-dominance ceiling), and widen a little at high
  // lap counts where skill effects compound (e.g. ice over many laps) — this is the
  // deferred-balance gate, not a ±tolerance target.
  const LAP_CASES = [
    { laps: 1, N: 1200, charFloor: 0.07, charCeil: 0.45, slotFloorMul: 0.3, slotCeilMul: 2.2 },
    { laps: 3, N: 400, charFloor: 0.05, charCeil: 0.45, slotFloorMul: 0.25, slotCeilMul: 2.4 },
    { laps: 10, N: 200, charFloor: 0.04, charCeil: 0.45, slotFloorMul: 0.2, slotCeilMul: 2.6 },
  ];

  for (const { laps, N, charFloor, charCeil, slotFloorMul, slotCeilMul } of LAP_CASES) {
    it(`every character can win and none dominates (laps=${laps})`, () => {
      const wins: Record<string, number> = Object.fromEntries(allThree.map((c) => [c, 0]));
      for (let s = 0; s < N; s++) {
        const { result } = simulateRace(makeConfig({ characterIds: ids, seed: s, laps }), skills, scoring);
        wins[charOfSlot[Number(result.order[0].slice(1))]]++;
      }
      for (const cid of allThree) {
        const rate = wins[cid] / N;
        expect(rate).toBeGreaterThan(charFloor); // can win
        expect(rate).toBeLessThan(charCeil); // does not dominate
      }
    });

    it(`every start slot can win and none dominates (laps=${laps})`, () => {
      const slotWins = new Array(ids.length).fill(0);
      for (let s = 0; s < N; s++) {
        const { result } = simulateRace(makeConfig({ characterIds: ids, seed: s, laps }), skills, scoring);
        slotWins[Number(result.order[0].slice(1))]++;
      }
      const expected = N / ids.length;
      for (let i = 0; i < ids.length; i++) {
        expect(slotWins[i]).toBeGreaterThan(expected * slotFloorMul);
        expect(slotWins[i]).toBeLessThan(expected * slotCeilMul);
      }
    });
  }

  // Anti-runaway guard (catch-up / rubberbanding in RaceEngine#catchupFactor):
  // nobody should pull away wire-to-wire. Loose bounds — they verify the pack
  // stays bunched and the lead changes hands, not a precise gap target.
  it('no runaway — pack stays bunched and the lead changes hands', () => {
    const M = 400;
    let sumPeakGapLaps = 0;
    let sumLeadChanges = 0;
    for (let s = 0; s < M; s++) {
      const cfg = makeConfig({ characterIds: ids, seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      let leader = '';
      let peakGap = 0;
      for (const f of frames) {
        const byProg = [...f.racers].sort((a, b) => b.progress - a.progress);
        if (byProg[0].id !== leader) { sumLeadChanges++; leader = byProg[0].id; }
        const gap = (byProg[0].progress - byProg[1].progress) / cfg.trackLength;
        if (gap > peakGap) peakGap = gap;
      }
      sumPeakGapLaps += peakGap;
    }
    // The leader's peak lead over 2nd averages well under a quarter-lap.
    expect(sumPeakGapLaps / M).toBeLessThan(0.2);
    // The lead changes hands several times per race on average.
    expect(sumLeadChanges / M).toBeGreaterThan(3);
  });
});
