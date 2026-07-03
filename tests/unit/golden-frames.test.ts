import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { makeConfig, allThree } from './helpers.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

/**
 * GOLDEN BASELINE — bit-identical determinism gate for refactoring.
 *
 * Hashes every frame's racer positions AND event stream across representative
 * (mode × seed) configs and snapshots the digests. Any refactor that reorders
 * an RNG draw, renames a `rng.fork` label, changes id numbering, or perturbs
 * iteration order shifts at least one digest and fails here within seconds —
 * long before the 5-minute statistical gates would notice.
 *
 * Events are included in the hash on purpose: progress/lane alone can survive
 * an RNG-order change for many frames, but the (type:variant:target) stream
 * diverges immediately.
 *
 * INTENTIONAL engine/balance changes are ALLOWED to move these digests.
 * After verifying the change is the one you meant (unit tests + balance
 * harness), refresh with:  npx vitest run golden-frames -u
 */

// FNV-1a 32-bit over the frame journal string.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function raceDigest(cfg: ReturnType<typeof makeConfig>): string {
  const { frames, result } = simulateRace(cfg, skills, scoring);
  const parts: string[] = [];
  for (const f of frames) {
    for (const r of f.racers) {
      parts.push(`${f.frame}:${r.id}:${r.progress.toFixed(4)}:${r.lane.toFixed(4)}:${r.phase}`);
    }
    for (const e of f.events) {
      parts.push(`${f.frame}:${e.type}:${e.variant}:${e.racerId}:${e.targetId ?? ''}`);
    }
  }
  parts.push(`order:${result.order.join(',')}`);
  return fnv1a(parts.join('|'));
}

describe('golden frame digests (refactor determinism gate)', () => {
  it('individual, full roster', () => {
    const digests: Record<string, string> = {};
    for (const seed of [0, 1, 2, 3, 4]) {
      digests[`individual laps=1 seed=${seed}`] = raceDigest(
        makeConfig({ characterIds: allThree, seed }),
      );
    }
    digests['individual laps=3 seed=0'] = raceDigest(
      makeConfig({ characterIds: allThree, seed: 0, laps: 3 }),
    );
    expect(digests).toMatchSnapshot();
  });

  it('team rank-sum', () => {
    const ids = ['dog', 'cat', 'monkey', 'bear', 'penguin', 'fox'];
    const teamIds = ['A', 'A', 'A', 'B', 'B', 'B'];
    const digests: Record<string, string> = {};
    for (const seed of [0, 1, 2]) {
      digests[`team laps=1 seed=${seed}`] = raceDigest(
        makeConfig({ characterIds: ids, seed, teamMode: true, scoringId: 'teamRankSum', teamIds }),
      );
    }
    expect(digests).toMatchSnapshot();
  });

  it('relay', () => {
    const ids = ['dog', 'cat', 'monkey', 'bear', 'penguin', 'fox', 'spider', 'hedgehog', 'alien'];
    const teamIds = ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C'];
    const digests: Record<string, string> = {};
    for (const seed of [0, 1, 2]) {
      digests[`relay legs=3 seed=${seed}`] = raceDigest(
        makeConfig({
          characterIds: ids, seed, laps: 3, teamMode: true, scoringId: 'teamRelay', teamIds, relay: true,
        }),
      );
    }
    expect(digests).toMatchSnapshot();
  });

  it('deathmatch (elimination)', () => {
    const digests: Record<string, string> = {};
    for (const seed of [0, 1]) {
      digests[`deathmatch last seed=${seed}`] = raceDigest(
        makeConfig({ characterIds: allThree, seed, laps: 3, elimination: 'last' }),
      );
    }
    expect(digests).toMatchSnapshot();
  });
});
