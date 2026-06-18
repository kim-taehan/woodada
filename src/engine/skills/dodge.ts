import type { RacerState } from '../types.ts';
import type { Rng } from '../prng.ts';

/**
 * Catwalk probabilistic dodge (replaces the old unconditional immunity). While a
 * cat's `dodgeUntil` window is open, an incoming *direct* disruption (banana /
 * roar / divebomb stun) is avoided with probability `dodgeChance` — not for free.
 *
 * The roll must be deterministic per (cat id, frame): if several attacks land on
 * the same cat in one frame they must all see the same outcome, independent of
 * attacker processing order. We achieve this by forking the cat's own stable
 * skill sub-stream by frame and memoising the result onto its skill runtime
 * (`dodgeFrame`/`dodgeRoll`). The cat's sub-stream is `skill:cat:<id>`, so the
 * decision depends only on (seed, cat id, frame) — never on draw order.
 *
 * Environmental effects (the penguin ice slow) are NOT direct disruptions and do
 * not go through here — they apply regardless of the dodge window.
 */
export function isInDodgeWindow(racer: RacerState, frame: number): boolean {
  return (racer.skill.dodgeUntil ?? 0) > frame;
}

/**
 * Resolve (and cache) the cat's dodge roll for `frame`. `catRng` must be the
 * cat's own per-(racer, skill) sub-stream. Returns true if the disruption is
 * avoided. Callers should first gate on `isInDodgeWindow`.
 */
export function resolveDodge(racer: RacerState, frame: number, catRng: Rng): boolean {
  if (!isInDodgeWindow(racer, frame)) return false;
  if (racer.skill.dodgeFrame === frame) return racer.skill.dodgeRoll === true;
  const chance = Number(racer.skill.dodgeChance ?? 0);
  const roll = catRng.fork(`dodge:${frame}`).bool(chance);
  racer.skill.dodgeFrame = frame;
  racer.skill.dodgeRoll = roll;
  return roll;
}
