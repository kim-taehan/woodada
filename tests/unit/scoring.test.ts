import { describe, it, expect } from 'vitest';
import { individual } from '../../src/engine/scoring/individual.ts';
import { teamRankSum, teamAce } from '../../src/engine/scoring/team.ts';
import { makeConfig } from './helpers.ts';

describe('scoring strategies', () => {
  const cfg = makeConfig({
    characterIds: ['dog', 'cat', 'monkey', 'dog'],
    seed: 1,
    teamMode: true,
    teamIds: ['A', 'B', 'A', 'B'],
  });
  // p0 A, p1 B, p2 A, p3 B

  it('individual: order maps to ranks', () => {
    const r = individual(['p2', 'p0', 'p3', 'p1'], cfg);
    expect(r.type).toBe('individual');
    expect(r.order).toEqual(['p2', 'p0', 'p3', 'p1']);
    expect(r.detail).toEqual({ p2: 1, p0: 2, p3: 3, p1: 4 });
  });

  it('teamRankSum: lower sum wins', () => {
    // order p0(1) p1(2) p2(3) p3(4) → A = 1+3 = 4, B = 2+4 = 6 → A wins
    const r = teamRankSum(['p0', 'p1', 'p2', 'p3'], cfg);
    expect(r.order[0]).toBe('A');
    expect(r.detail).toEqual({ A: 4, B: 6 });
  });

  it('teamRankSum: tie broken by better top placements', () => {
    // Construct a tie in sum: A ranks {1,4}=5, B ranks {2,3}=5. A has the 1st → wins.
    const r = teamRankSum(['p0', 'p1', 'p3', 'p2'], cfg); // p0=1(A) p1=2(B) p3=3(B) p2=4(A)
    expect(r.detail).toEqual({ A: 5, B: 5 });
    expect(r.order[0]).toBe('A');
  });

  it('teamAce: compares fastest member', () => {
    // p1=1(B) p0=2(A) ... B's ace rank 1 beats A's ace rank 2
    const r = teamAce(['p1', 'p0', 'p2', 'p3'], cfg);
    expect(r.order[0]).toBe('B');
    expect(r.detail.B).toBe(1);
  });

  it('teamRankSum: generalizes over 4 arbitrary team ids (red/blue/white/black)', () => {
    // Two members per team; team ids are the relay palette, not 'A'/'B'.
    const cfg4 = makeConfig({
      characterIds: ['dog', 'cat', 'monkey', 'eagle', 'bear', 'dog', 'cat', 'monkey'],
      seed: 7,
      teamMode: true,
      teamIds: ['red', 'blue', 'white', 'black', 'red', 'blue', 'white', 'black'],
    });
    // p0 red, p1 blue, p2 white, p3 black, p4 red, p5 blue, p6 white, p7 black
    // finish order = p0..p7 → ranks: red{1,5}=6 blue{2,6}=8 white{3,7}=10 black{4,8}=12
    const r = teamRankSum(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], cfg4);
    expect(r.type).toBe('team');
    expect(r.order).toEqual(['red', 'blue', 'white', 'black']);
    expect(r.detail).toEqual({ red: 6, blue: 8, white: 10, black: 12 });
  });
});
