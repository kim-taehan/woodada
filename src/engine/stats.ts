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

import { STATS } from './tuning.ts';
import { SECTION } from './track.ts';

/** Neutral stat → no bias/resistance. */
const NEUTRAL = 3;

/** Signed deviation of a 1..5 stat from the median, in [-1, +1]. */
export function statDev(stat: number | undefined): number {
  return ((stat ?? NEUTRAL) - NEUTRAL) / 2;
}

// Coefficients live in the central tuning module (engine/tuning.ts).

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
 * Per-section speed bias (engine units) from the `cornering` stat. A curve specialist
 * (cornering > 3 → dev > 0) is faster on curves, slower on straights; a straight sprinter
 * (dev < 0) the reverse. Distance-weighted by the OPPOSITE section's lap-share so the boost
 * and the cut cancel over a full lap (lap-average pace unchanged → win-rate fairness holds):
 *   curve   bias = +gain · dev · straightFrac
 *   straight bias = −gain · dev · curveFrac
 * → curveBias·curveFrac + straightBias·straightFrac = 0. Pure, no RNG.
 */
export function sectionSpeedBias(cornering: number | undefined, onCurve: boolean): number {
  const dev = statDev(cornering);
  return onCurve
    ? STATS.corneringGain * dev * SECTION.straightFrac
    : -STATS.corneringGain * dev * SECTION.curveFrac;
}

/**
 * Ease a sub-1 slow multiplier toward 1 (less slow) for high-power racers. Used
 * at the speed-application sites for slowMul (bristle/lightning/fart) and ice
 * slowFactor. `mul` in (0,1]; high power → closer to 1, low power → slightly lower.
 */
export function powerEaseSlow(mul: number, power: number | undefined): number {
  return mul + (1 - mul) * STATS.powerResist * statDev(power);
}
