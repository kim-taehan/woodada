/**
 * L1 overtake / blocking model (spec §8). No physics — game rules + PRNG over
 * abstract `progress` (forward) and `lane` (0 inside .. 1 outside).
 *
 * Each racer cruises in its own `homeLane` (the field stays spread across the
 * track) with a gentle wander. When blocked by someone directly ahead it weaves
 * into an open neighbouring lane to pass and *commits to that side* (hysteresis)
 * until the pass clears or the side gets blocked — it does not flip sides every
 * frame. Then it drifts back home; if both sides are blocked it decelerates until
 * a gap opens. Lane no longer affects speed, so nobody has a reason to crowd the
 * inside.
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
  switchChance: 0.78,
  /** Speed multiplier while boxed in. */
  blockDecel: 0.5,
  /** Gentle lane wander amplitude + frequency. */
  wanderAmp: 0.1,
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
    const clearOn = (side: -1 | 1): boolean => {
      const lane = self.lane + side * OVERTAKE.laneStep;
      const inBounds = side === 1 ? lane <= 0.97 : lane >= 0.03;
      return inBounds && !nearestAhead(all, self, lane, OVERTAKE.laneNear);
    };

    // Hysteresis: if already committed to a weave side that is still open, KEEP
    // weaving that way — don't re-roll or re-randomise the side each frame (that
    // was the lane wobble). Only pick a side when starting a fresh weave, and
    // draw rng exactly once then (stable per-racer substream).
    let side: -1 | 1 | 0 = 0;
    const committed = self.weaveSide ?? 0;
    if (committed !== 0 && clearOn(committed)) {
      side = committed; // stay the course — no rng draw
    } else if (rng.bool(OVERTAKE.switchChance)) {
      const outerClear = clearOn(1);
      const innerClear = clearOn(-1);
      side = outerClear && innerClear ? (rng.bool(0.5) ? 1 : -1) : outerClear ? 1 : innerClear ? -1 : 0;
    }

    if (side !== 0) {
      target = clamp(self.lane + side * OVERTAKE.laneStep, 0.05, 0.95);
      self.phase = 'running';
      self.facing = side;
      self.weaveSide = side;
    } else {
      // Boxed in — decelerate behind the blocker. Drop any stale commitment.
      self.speed = Math.min(self.speed, blocker.speed) * OVERTAKE.blockDecel;
      self.phase = 'blocked';
      self.facing = 0;
      self.weaveSide = 0;
    }
  } else {
    // Clear of traffic — release any weave commitment and drift home.
    self.weaveSide = 0;
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
