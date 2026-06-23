/**
 * Track SECTION contract (straight vs curve), in abstract lap-phase only.
 *
 * The engine still knows nothing about pixels or shape — this is a pure lap-phase
 * partition that BOTH the sim (curve-only inside advantage + cornering speed) and the
 * renderer's oval agree on. Lap-phase u ∈ [0,1) starts at the bottom-straight LEFT end
 * (the start/lap line) and runs anticlockwise, matching renderer `OvalTrack.pointAt`:
 *
 *   [0.00, 0.28)  bottom straight   (start line → right corner)
 *   [0.28, 0.50)  right curve
 *   [0.50, 0.78)  top straight
 *   [0.78, 1.00)  left curve         (→ back to start)
 *
 * Fractions are FIXED constants (canvas-independent) so the simulation is deterministic;
 * the renderer's stadium proportions are tuned to land close to these (straights ≈0.56 of
 * the lap, curves ≈0.44 at the default 1280×800). Pure, no DOM/RNG.
 */

/** Lap-phase boundaries [bottomStraightEnd, rightCurveEnd, topStraightEnd]; left curve runs to 1. */
export const SECTION = {
  bottomStraightEnd: 0.28,
  rightCurveEnd: 0.5,
  topStraightEnd: 0.78,
  /** Share of a lap that is straight / curve (for fairness weighting of cornering stats). */
  straightFrac: 0.56,
  curveFrac: 0.44,
} as const;

/** Wrap progress to lap-phase u ∈ [0,1). */
export function lapPhase(progress: number, trackLength: number): number {
  return (((progress % trackLength) + trackLength) % trackLength) / trackLength;
}

/** True if the given lap-phase is on a CURVE (right or left), false on a straight. */
export function isCurve(u: number): boolean {
  return (u >= SECTION.bottomStraightEnd && u < SECTION.rightCurveEnd) || u >= SECTION.topStraightEnd;
}
