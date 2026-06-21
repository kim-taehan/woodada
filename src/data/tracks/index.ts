import type { TrackTheme } from './schema.ts';
import { grassland } from './grassland.ts';
import { desert } from './desert.ts';
import { beach } from './beach.ts';
import { citynight } from './citynight.ts';
import { snow } from './snow.ts';
import { jungle } from './jungle.ts';

/** All track themes, keyed by id. */
export const trackCatalog: Record<string, TrackTheme> = {
  grassland,
  desert,
  beach,
  citynight,
  snow,
  jungle,
};

/** Theme ids available for selection in the shell (grassland first = default). */
export const defaultArenaIds = ['grassland', 'desert', 'beach', 'citynight', 'snow', 'jungle'] as const;

/**
 * Deterministic arena selection from a race seed: same seed → same arena
 * (keeps replays / screenshot hooks consistent). Pure index map over the
 * catalog order — no RNG, no draw-order dependence.
 */
export function pickArena(seed: number): TrackTheme {
  const ids = defaultArenaIds;
  // Normalize to a non-negative integer index. (seed >>> 0 handles negatives.)
  const idx = (seed >>> 0) % ids.length;
  return trackCatalog[ids[idx]];
}

export { grassland, desert, beach, citynight, snow, jungle };
export type { TrackTheme, DecorSpec, Ambient } from './schema.ts';
