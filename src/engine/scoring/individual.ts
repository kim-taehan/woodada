import type { ScoringStrategy } from './types.ts';

/** Individual race: finish order is the result (spec §4). */
export const individual: ScoringStrategy = (order) => {
  const detail: Record<string, number> = {};
  order.forEach((id, i) => (detail[id] = i + 1));
  return { type: 'individual', order: [...order], detail };
};
