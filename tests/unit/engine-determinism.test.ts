import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { makeConfig, allThree } from './helpers.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

function hashFrames(frames: { racers: { id: string; progress: number; lane: number }[] }[]): string {
  return frames
    .map((f) => f.racers.map((r) => `${r.id}:${r.progress.toFixed(4)}:${r.lane.toFixed(4)}`).join('|'))
    .join('\n');
}

describe('engine determinism', () => {
  it('same (config, seed) replays identically', () => {
    const cfg = makeConfig({ characterIds: [...allThree, ...allThree], seed: 2024 });
    const a = simulateRace(makeConfig({ characterIds: cfg.participants.map((p) => p.characterId), seed: 2024 }), skills, scoring);
    const b = simulateRace(makeConfig({ characterIds: cfg.participants.map((p) => p.characterId), seed: 2024 }), skills, scoring);
    expect(a.result.order).toEqual(b.result.order);
    expect(hashFrames(a.frames)).toEqual(hashFrames(b.frames));
  });

  it('different seeds usually give different orders', () => {
    const ids = [...allThree, ...allThree];
    const orders = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const { result } = simulateRace(makeConfig({ characterIds: ids, seed: s }), skills, scoring);
      orders.add(result.order.join(','));
    }
    // With 6 racers and skills, seeds should produce variety.
    expect(orders.size).toBeGreaterThan(5);
  });

  it('more laps make a proportionally longer race', () => {
    const one = simulateRace(makeConfig({ characterIds: allThree, seed: 3, laps: 1 }), skills, scoring);
    const three = simulateRace(makeConfig({ characterIds: allThree, seed: 3, laps: 3 }), skills, scoring);
    expect(three.frames.length).toBeGreaterThan(one.frames.length * 2.4);
  });

  it('every racer finishes with a unique rank', () => {
    const ids = [...allThree, ...allThree];
    const { frames, result } = simulateRace(makeConfig({ characterIds: ids, seed: 5 }), skills, scoring);
    expect(result.order.length).toBe(ids.length);
    expect(new Set(result.order).size).toBe(ids.length);
    expect(frames[frames.length - 1].finished).toBe(true);
  });
});
