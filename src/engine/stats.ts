/**
 * Per-character speed/power stats wired into the sim (spec: fair-flavor A-plan).
 *
 * Stats are an integer 1..5 scale, median 3, with each character's speed+power ≈ 6
 * (so they trade off). We map a stat to a small signed deviation d = (stat-3)/2 in
 * [-1, +1] and apply *small* deltas — the catch-up term + cooldown gates keep win
 * rates fair, so this is flavor, not a power ladder.
 *
 *   speed → a small baseSpeed bias (fast animals surge early; catch-up reins it).
 *   power → resistance to incoming negative effects (slow / pushback / stun length)
 *           and less deceleration when boxed in (shoulders through traffic).
 *
 * Stats are optional; a missing stat reads as the neutral median (3 → d = 0 → no
 * effect), so characters without stats behave exactly as before (back-compat).
 *
 * Pure: no DOM/RNG. Lane is never touched here — power is a contact stat, not a
 * lane stat (the "lane never affects speed" invariant stands).
 */

/** Neutral stat → no bias/resistance. */
const NEUTRAL = 3;

/** Signed deviation of a 1..5 stat from the median, in [-1, +1]. */
export function statDev(stat: number | undefined): number {
  return ((stat ?? NEUTRAL) - NEUTRAL) / 2;
}

/** Tuning coefficients — kept small so the fairness gates still hold. */
export const STATS = {
  /**
   * baseSpeed bias at full speed deviation. The fair jitter band is 0.2 wide
   * (1.3..1.5); this is kept to a *fraction* of that (≈±0.018 = under 10% of the
   * band) so a fast animal surges early but the catch-up term reins it — flavor,
   * not a ladder. Larger values (e.g. 0.05) break the fairness floor.
   */
  speedGain: 0.018,
  /** Fraction by which a full power deviation scales an incoming effect's magnitude. */
  powerResist: 0.15,
  /** Fraction by which a full power deviation eases block deceleration toward 1. */
  powerBlockEase: 0.2,
} as const;

/**
 * Multiplier (~1) for an incoming negative effect's *magnitude* given the target's
 * power. High power → < 1 (effect weakened); low power → > 1 (effect amplified).
 * Used for slow strength, pushback distance, and stun duration.
 */
export function powerEffectScale(power: number | undefined): number {
  return 1 - STATS.powerResist * statDev(power);
}

/**
 * Block-deceleration multiplier for a boxed-in racer, eased toward 1 by power.
 * `base` is OVERTAKE.blockDecel. High power decelerates less in traffic.
 */
export function powerBlockDecel(base: number, power: number | undefined): number {
  const eased = base + (1 - base) * STATS.powerBlockEase * statDev(power);
  return eased;
}

/** baseSpeed bias (engine units) from the speed stat. */
export function speedBias(speed: number | undefined): number {
  return STATS.speedGain * statDev(speed);
}

/**
 * Ease a sub-1 slow multiplier toward 1 (less slow) for high-power racers. Used
 * at the speed-application sites for slowMul (bristle/lightning/fart) and ice
 * slowFactor. `mul` in (0,1]; high power → closer to 1, low power → slightly lower.
 */
export function powerEaseSlow(mul: number, power: number | undefined): number {
  return mul + (1 - mul) * STATS.powerResist * statDev(power);
}
