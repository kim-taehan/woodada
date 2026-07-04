import { describe, it, expect } from 'vitest';
import { laneIntroOrder, podiumTeamMembers } from '../../src/renderer/renderUtils.ts';
import type { TeamId } from '../../src/data/teams.ts';

// Pure ordering logic behind the renderer's lane-intro reel (effects/LaneIntro)
// and victory podium (ui/PodiumScene). The Pixi rendering around them is covered
// by the e2e podium specs; these lock the reorder contracts that could silently
// break a group's intro sequence or a team's podium cluster.

type P = { id: string; teamId?: TeamId };
const present = (ids: string[]) => (id: string) => ids.includes(id);
const all = (ps: P[]) => present(ps.map((p) => p.id));

describe('laneIntroOrder', () => {
  it('individual mode keeps slot order untouched', () => {
    const ps: P[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(laneIntroOrder(ps, all(ps), false)).toEqual(['a', 'b', 'c']);
  });

  it('drops racers not present in the scene (both modes)', () => {
    const ps: P[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(laneIntroOrder(ps, present(['a', 'c']), false)).toEqual(['a', 'c']);
  });

  it('team mode groups teammates back-to-back by first appearance', () => {
    // Slot order interleaves teams; intro should cluster each team.
    const ps: P[] = [
      { id: 'r1', teamId: 'red' },
      { id: 'b1', teamId: 'blue' },
      { id: 'r2', teamId: 'red' },
      { id: 'b2', teamId: 'blue' },
    ];
    // red first appears at slot 0, blue at slot 1 → red cluster then blue cluster.
    expect(laneIntroOrder(ps, all(ps), true)).toEqual(['r1', 'r2', 'b1', 'b2']);
  });

  it('team mode preserves slot order WITHIN a team (stable sort)', () => {
    const ps: P[] = [
      { id: 'b1', teamId: 'blue' },
      { id: 'r1', teamId: 'red' },
      { id: 'b2', teamId: 'blue' },
      { id: 'r2', teamId: 'red' },
      { id: 'b3', teamId: 'blue' },
    ];
    // blue appears first → blue cluster in slot order, then red in slot order.
    expect(laneIntroOrder(ps, all(ps), true)).toEqual(['b1', 'b2', 'b3', 'r1', 'r2']);
  });

  it('never drops or duplicates — output is a permutation of the present set', () => {
    const ps: P[] = [
      { id: 'r1', teamId: 'red' },
      { id: 'w1', teamId: 'white' },
      { id: 'b1', teamId: 'blue' },
      { id: 'r2', teamId: 'red' },
      { id: 'b2', teamId: 'blue' },
      { id: 'w2', teamId: 'white' },
    ];
    const out = laneIntroOrder(ps, all(ps), true);
    expect(out).toHaveLength(ps.length);
    expect(new Set(out)).toEqual(new Set(ps.map((p) => p.id)));
  });
});

describe('podiumTeamMembers', () => {
  const finish = (order: string[]) => new Map(order.map((id, i) => [id, i] as const));

  it('returns a team\'s present members ordered by finish (best first)', () => {
    const ps: P[] = [
      { id: 'r1', teamId: 'red' },
      { id: 'b1', teamId: 'blue' },
      { id: 'r2', teamId: 'red' },
    ];
    // r2 finished ahead of r1.
    const rank = finish(['b1', 'r2', 'r1']);
    expect(podiumTeamMembers(ps, 'red', all(ps), rank)).toEqual(['r2', 'r1']);
  });

  it('excludes members of other teams and absent racers', () => {
    const ps: P[] = [
      { id: 'r1', teamId: 'red' },
      { id: 'r2', teamId: 'red' },
      { id: 'b1', teamId: 'blue' },
    ];
    const rank = finish(['r1', 'r2', 'b1']);
    // r2 absent from the scene → dropped even though it's on red.
    expect(podiumTeamMembers(ps, 'red', present(['r1', 'b1']), rank)).toEqual(['r1']);
  });

  it('members missing from finishRank sort last (1e9 sentinel)', () => {
    const ps: P[] = [
      { id: 'r1', teamId: 'red' },
      { id: 'r2', teamId: 'red' },
    ];
    const rank = finish(['r2']); // r1 never finished (eliminated)
    expect(podiumTeamMembers(ps, 'red', all(ps), rank)).toEqual(['r2', 'r1']);
  });

  it('individual entries key on id when teamId is absent', () => {
    const ps: P[] = [{ id: 'solo' }, { id: 'other' }];
    const rank = finish(['solo', 'other']);
    // teamId undefined → key falls back to the participant id.
    expect(podiumTeamMembers(ps, 'solo', all(ps), rank)).toEqual(['solo']);
  });
});
