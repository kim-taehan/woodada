/**
 * Per-character `cornering` stat wired into the sim (spec: fair-flavor A-plan).
 *
 * The single remaining stat is an integer 1..5 scale, median 3. We map it to a
 * small signed deviation d = (stat-3)/2 in [-1, +1] and split a racer's pace
 * between track sections (curve specialist vs straight sprinter), distance-weighted
 * so the lap-average nets to zero → win-rate fairness holds.
 *
 * The stat is optional; a missing stat reads as the neutral median (3 → d = 0 → no
 * effect), so characters without it behave exactly as before (back-compat).
 *
 * Pure: no DOM/RNG. Lane is never touched here — the "lane never affects speed"
 * invariant stands.
 */

import { STATS } from './tuning.ts';
import { SECTION } from './track.ts';

/** Neutral stat → no bias. */
const NEUTRAL = 3;

/** Signed deviation of a 1..5 stat from the median, in [-1, +1]. */
export function statDev(stat: number | undefined): number {
  return ((stat ?? NEUTRAL) - NEUTRAL) / 2;
}

// Coefficients live in the central tuning module (engine/tuning.ts).

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
