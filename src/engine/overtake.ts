/**
 * L1 overtake / blocking model (spec §8). No physics — game rules + PRNG over
 * abstract `progress` (forward) and `lane` (0 inside .. 1 outside).
 *
 * Each racer cruises in its own `homeLane` (the field stays spread across the
 * track) with a gentle wander. When blocked by someone directly ahead it weaves
 * into an open neighbouring lane to pass, then drifts back home; if both sides
 * are blocked it decelerates until a gap opens. Lane no longer affects speed, so
 * nobody has a reason to crowd the inside.
 */

import type { Rng } from './prng.ts';
import type { RacerState } from './types.ts';

export const OVERTAKE = {
  /** Forward proximity window that counts as "blocked by" / "occupied". */
  nearAhead: 4.0,
  /** Lateral closeness (lane units) that counts as the same lane band. */
  laneNear: 0.16,
  /** How far sideways to step when attempting a pass. */
  laneStep: 0.3,
  /** Per-frame lane drift speed. */
  laneDrift: 0.05,
  /** Chance to commit to a pass when a side is open. */
  switchChance: 0.7,
  /** Speed multiplier while boxed in. */
  blockDecel: 0.5,
  /** Gentle lane wander amplitude + frequency. */
  wanderAmp: 0.07,
  wanderFreq: 0.05,
} as const;

/** Lane no longer affects speed (kept for API compatibility). */
export function laneSpeedFactor(_lane: number): number {
  return 1;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function moveToward(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return value;
}

/**
 * Adjust `self`'s lane/speed/phase for this frame given the field. Mutates self.
 * Assumes self.speed already holds its intrinsic + burst speed for the frame.
 */
export function applyOvertake(self: RacerState, all: RacerState[], rng: Rng, frame: number): void {
  // Out-of-control bursts (zoomies / nap-dash) plow ahead — readable, not blocked.
  if (self.phase === 'straying') return;

  const wander = Math.sin(frame * OVERTAKE.wanderFreq + self.homeLane * 23.1) * OVERTAKE.wanderAmp;
  let target = clamp(self.homeLane + wander, 0.05, 0.95);

  const blocker = nearestAhead(all, self, self.lane, OVERTAKE.laneNear);
  if (blocker) {
    const outer = self.lane + OVERTAKE.laneStep;
    const inner = self.lane - OVERTAKE.laneStep;
    const outerClear = outer <= 0.97 && !nearestAhead(all, self, outer, OVERTAKE.laneNear);
    const innerClear = inner >= 0.03 && !nearestAhead(all, self, inner, OVERTAKE.laneNear);

    if ((outerClear || innerClear) && rng.bool(OVERTAKE.switchChance)) {
      const side = outerClear && innerClear ? (rng.bool(0.5) ? 1 : -1) : outerClear ? 1 : -1;
      target = clamp(self.lane + side * OVERTAKE.laneStep, 0.05, 0.95);
      self.phase = 'running';
      self.facing = side;
    } else {
      // Boxed in — decelerate behind the blocker.
      self.speed = Math.min(self.speed, blocker.speed) * OVERTAKE.blockDecel;
      self.phase = 'blocked';
      self.facing = 0;
    }
  } else {
    self.phase = 'running';
    self.facing = target > self.lane ? 1 : target < self.lane ? -1 : 0;
  }

  self.lane = moveToward(self.lane, target, OVERTAKE.laneDrift);
}

function nearestAhead(
  all: RacerState[],
  self: RacerState,
  lane: number,
  laneBand: number,
): RacerState | undefined {
  let best: RacerState | undefined;
  let bestGap = Infinity;
  for (const r of all) {
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting') continue;
    const gap = r.progress - self.progress;
    if (gap <= 0 || gap > OVERTAKE.nearAhead) continue;
    if (Math.abs(r.lane - lane) > laneBand) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = r;
    }
  }
  return best;
}
