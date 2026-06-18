/**
 * Team-winner determination is pure derivation from the finish order (spec §4).
 * The engine produces only per-racer arrival order; strategies turn that into
 * an individual or team result. Adding a strategy (e.g. relay) = one function.
 */

import type { RaceConfig, RacerId, ScoringResult } from '../types.ts';

export type ScoringStrategy = (
  order: RacerId[],
  config: RaceConfig,
) => ScoringResult;

export interface ScoringRegistry {
  register(id: string, strategy: ScoringStrategy): void;
  get(id: string): ScoringStrategy | undefined;
}

export function createScoringRegistry(): ScoringRegistry {
  const map = new Map<string, ScoringStrategy>();
  return {
    register: (id, s) => void map.set(id, s),
    get: (id) => map.get(id),
  };
}
