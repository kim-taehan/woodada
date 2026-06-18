import type { RacerId } from '../types.ts';
import type { ScoringStrategy } from './types.ts';

/**
 * Relay (이어달리기) team scoring (spec §5/§7, cyclic model): legs per team =
 * config.laps; leg i is run by members[i % size]. A team finishes when its
 * anchor — the runner of the final leg (laps-1), i.e. members[(laps-1) % size] —
 * crosses the line. Team rank = anchor finish order. The engine ranks only the
 * racer that completes each team's anchor leg, so that racer's position in
 * `order` is the team's finishing position.
 *
 * Teamless participants (defensive: a stray racer in a relay) form a one-member
 * team and are their own anchor — same path as `team.ts`'s `?? p.id` fallback.
 */
export const teamRelay: ScoringStrategy = (order, config) => {
  const rankOf: Record<RacerId, number> = {};
  order.forEach((id, i) => (rankOf[id] = i + 1));

  // Member queues per team in participation order, then anchor = leg (laps-1).
  const members = new Map<string, RacerId[]>();
  for (const p of config.participants) {
    const team = p.teamId ?? p.id;
    (members.get(team) ?? members.set(team, []).get(team)!).push(p.id);
  }
  const anchorOf = new Map<string, RacerId>();
  for (const [team, q] of members) {
    const anchorLeg = Math.max(0, config.laps - 1);
    anchorOf.set(team, q[anchorLeg % q.length]);
  }

  const teams = [...anchorOf.entries()].map(([teamId, anchorId]) => ({
    teamId,
    anchorRank: rankOf[anchorId] ?? Infinity,
  }));
  teams.sort((a, b) => a.anchorRank - b.anchorRank);

  const detail: Record<string, number> = {};
  teams.forEach((t) => (detail[t.teamId] = t.anchorRank));
  return { type: 'team', order: teams.map((t) => t.teamId), detail };
};
