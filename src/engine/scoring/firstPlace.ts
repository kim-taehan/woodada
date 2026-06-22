import type { RacerId } from '../types.ts';
import type { ScoringStrategy } from './types.ts';

/**
 * First-place (1등 보유, spec §4-c): the team that owns the racer who finished
 * 1st overall wins. Remaining teams are ordered by their own best (lowest-rank)
 * member, ties broken by the next-best member — i.e. a lexicographic compare on
 * each team's ascending member ranks. This is the same winner rule as `teamAce`;
 * it is split out so the team-mode selector (1등보유 / 등수합 / 릴레이) maps a mode
 * straight to a scoring id. `detail[teamId]` is the team's top finishing rank.
 *
 * Teamless participants form a one-member team (`?? p.id`), matching team.ts.
 */
export const teamFirstPlace: ScoringStrategy = (order, config) => {
  const rankOf: Record<RacerId, number> = {};
  order.forEach((id, i) => (rankOf[id] = i + 1));

  const byTeam = new Map<string, number[]>();
  for (const p of config.participants) {
    const team = p.teamId ?? p.id;
    const arr = byTeam.get(team) ?? [];
    arr.push(rankOf[p.id] ?? Infinity);
    byTeam.set(team, arr);
  }

  const teams = [...byTeam.entries()].map(([teamId, ranks]) => ({
    teamId,
    ranks: [...ranks].sort((a, b) => a - b),
  }));
  teams.sort((a, b) => lexCompare(a.ranks, b.ranks));

  const detail: Record<string, number> = {};
  teams.forEach((t) => (detail[t.teamId] = t.ranks[0]));
  return { type: 'team', order: teams.map((t) => t.teamId), detail };
};

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
