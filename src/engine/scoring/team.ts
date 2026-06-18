import type { RaceConfig, RacerId } from '../types.ts';
import type { ScoringStrategy } from './types.ts';

interface TeamRanks {
  teamId: string;
  /** Member ranks, ascending. */
  ranks: number[];
  sum: number;
}

function teamRanks(order: RacerId[], config: RaceConfig): TeamRanks[] {
  const rankOf: Record<RacerId, number> = {};
  order.forEach((id, i) => (rankOf[id] = i + 1));

  const byTeam = new Map<string, number[]>();
  for (const p of config.participants) {
    const team = p.teamId ?? p.id;
    const arr = byTeam.get(team) ?? [];
    arr.push(rankOf[p.id]);
    byTeam.set(team, arr);
  }

  return [...byTeam.entries()].map(([teamId, ranks]) => {
    const sorted = [...ranks].sort((a, b) => a - b);
    return { teamId, ranks: sorted, sum: sorted.reduce((s, r) => s + r, 0) };
  });
}

/** Lexicographic compare of two ascending rank arrays (smaller first wins). */
function lexCompare(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? Infinity;
    const bv = b[i] ?? Infinity;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Rank-sum (spec §4-a, default): team with the smallest sum of member ranks
 * wins. Tie broken by better top placements (lexicographic on sorted ranks).
 */
export const teamRankSum: ScoringStrategy = (order, config) => {
  const teams = teamRanks(order, config);
  teams.sort((a, b) => a.sum - b.sum || lexCompare(a.ranks, b.ranks));
  const detail: Record<string, number> = {};
  teams.forEach((t) => (detail[t.teamId] = t.sum));
  return { type: 'team', order: teams.map((t) => t.teamId), detail };
};

/**
 * Ace (spec §4-b): compare each team's fastest member; ties resolved by the
 * next member, and so on (lexicographic on sorted ranks).
 */
export const teamAce: ScoringStrategy = (order, config) => {
  const teams = teamRanks(order, config);
  teams.sort((a, b) => lexCompare(a.ranks, b.ranks));
  const detail: Record<string, number> = {};
  teams.forEach((t) => (detail[t.teamId] = t.ranks[0]));
  return { type: 'team', order: teams.map((t) => t.teamId), detail };
};
