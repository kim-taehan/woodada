import type { RacerState } from '../types.ts';
import type { Rng } from '../prng.ts';

/**
 * Catwalk REACTIVE just-dodge. There is no pre-opened window any more (the old
 * tick that "pre-armed" a dodge window is gone — it made the skill flick on for no
 * visible reason). Instead, the dodge is resolved the instant a direct disruption
 * (banana / roar / abduct / bristle / item) actually targets the cat, gated on the
 * cat's catwalk cooldown:
 *
 *   - cooldown not ready  → no dodge (returns false; the hit lands).
 *   - cooldown ready      → roll `dodgeChance`. On success the engine consumes the
 *                           cooldown, awards a small forward slip, and emits
 *                           activate + dodge (so the renderer plays catwalk + the
 *                           attacker's whiff). On failure the cooldown is NOT spent.
 *
 * The roll must be deterministic per (cat id, frame): if several attacks land on
 * the same cat in one frame they must all see the same outcome, independent of
 * attacker processing order. We fork the cat's own stable skill sub-stream by
 * frame and memoise the result onto its skill runtime (`dodgeFrame`/`dodgeRoll`),
 * so the decision depends only on (seed, cat id, frame) — never on draw order.
 *
 * `cooldownReady` is supplied by the engine (it owns skillCooldownUntil); we keep
 * the roll + memo here so the (cat, frame) determinism contract lives in one place.
 * Environmental effects (the penguin ice slow) are NOT direct disruptions and do
 * not go through here.
 */
export function rollDodge(
  cat: RacerState,
  frame: number,
  catRng: Rng,
  dodgeChance: number,
): boolean {
  if (cat.skill.dodgeFrame === frame) return cat.skill.dodgeRoll === true;
  const roll = catRng.fork(`dodge:${frame}`).bool(dodgeChance);
  cat.skill.dodgeFrame = frame;
  cat.skill.dodgeRoll = roll;
  return roll;
}
