import { createScoringRegistry, type ScoringRegistry } from './types.ts';
import { individual } from './individual.ts';
import { teamRankSum, teamAce } from './team.ts';
import { teamRelay } from './relay.ts';

export function createDefaultScoringRegistry(): ScoringRegistry {
  const r = createScoringRegistry();
  r.register('individual', individual);
  r.register('teamRankSum', teamRankSum);
  r.register('teamAce', teamAce);
  r.register('teamRelay', teamRelay);
  return r;
}

export { createScoringRegistry } from './types.ts';
export type { ScoringRegistry, ScoringStrategy } from './types.ts';
