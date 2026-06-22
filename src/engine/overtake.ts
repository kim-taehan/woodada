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
 *
 * Jockeying (low-traffic dynamics): even when NOT lane-blocked, a racer that is
 * close behind a rival (any lane) leans its lane target toward that rival's lane
 * to "draw alongside" and challenge for position. The lean strength is a smooth
 * function of how close the rival is (1 at point-blank, fading to 0 at the edge of
 * the window) so there is no on/off boundary to wobble against, and it never
 * touches speed — purely a positional drift so 1-on-1 races stop looking parallel.
 *
 * Lateral separation (자리경합): even between racers that aren't passing/jockeying,
 * two that end up shoulder-to-shoulder (small forward gap AND overlapping lane band)
 * push their lane targets apart so a crowd doesn't stack into one line. The push
 * direction is decided by a STABLE per-pair key (racer id order) — the lower-id
 * racer is nudged inside, the higher-id one outside — so it is symmetric and fully
 * deterministic (no RNG, no array-order / draw-order dependence). Speed-neutral:
 * it only moves the lane target; the existing blockDecel still owns the front-to-
 * back "boxed in" slowdown, so the "lane ≠ speed" invariant holds.
 */

import type { Rng } from './prng.ts';
import type { RacerState } from './types.ts';
import { powerBlockDecel } from './stats.ts';
// OVERTAKE constants live in the central tuning module; re-exported here so the
// existing `import { OVERTAKE } from './overtake.ts'` sites keep working.
import { OVERTAKE } from './tuning.ts';
export { OVERTAKE } from './tuning.ts';

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
      // Boxed in — decelerate behind the blocker (high power shoulders through →
      // less deceleration). Drop any stale commitment.
      const decel = powerBlockDecel(OVERTAKE.blockDecel, self.power);
      self.speed = Math.min(self.speed, blocker.speed) * decel;
      self.phase = 'blocked';
      self.facing = 0;
      self.weaveSide = 0;
    }
  } else {
    // Clear of traffic — release any weave commitment and drift home.
    self.weaveSide = 0;
    self.phase = 'running';

    // Jockeying: lean toward the lane of the nearest rival just ahead (any lane,
    // not lane-blocking) to draw alongside and contest position. Strength fades
    // smoothly with distance so there's no boundary to wobble against; this only
    // moves the lane TARGET (speed untouched, inside stays neutral).
    const rival = nearestRival(all, self);
    if (rival) {
      const gap = rival.progress - self.progress;
      const lean = OVERTAKE.jockeyLean * (1 - gap / OVERTAKE.jockeyRange);
      target = clamp(target + (rival.lane - target) * lean, 0.05, 0.95);
    }

    self.facing = target > self.lane ? 1 : target < self.lane ? -1 : 0;
  }

  // Lateral separation: nudge the target away from the nearest shoulder-to-shoulder
  // neighbour so a crowd spreads out instead of stacking. Deterministic direction
  // (stable id-order key), speed-neutral (target only). Applied in every branch so
  // even a weaving/jockeying racer still un-stacks; the weave's own target offset and
  // this push compose into the final lane target before the single drift step.
  const neighbour = nearestNeighbor(all, self);
  if (neighbour) {
    const overlap = Math.abs(neighbour.lane - self.lane);
    if (overlap < OVERTAKE.sepLaneBand) {
      // Stable side: lower id pushed inside (−), higher id outside (+). Tie on lane
      // is impossible to leave undecided — id is unique, so the comparison is total.
      const side = self.id < neighbour.id ? -1 : 1;
      // Strength fades to 0 as the lane overlap reaches the band edge (smooth, no
      // on/off boundary to wobble against).
      const strength = 1 - overlap / OVERTAKE.sepLaneBand;
      target = clamp(target + side * OVERTAKE.sepPush * OVERTAKE.laneStep * strength, 0.05, 0.95);
    }
  }

  self.lane = moveToward(self.lane, target, OVERTAKE.laneDrift);
}

/**
 * Nearest racer running shoulder-to-shoulder with `self`: smallest |forward gap|
 * within `sepRange` AND within `sepLaneBand` of self's lane. Looks both ahead and
 * behind (it's a side-by-side contest, not a pass), ignoring inert racers. Pure
 * scan, no RNG — used only for the deterministic lateral-separation push.
 */
function nearestNeighbor(all: RacerState[], self: RacerState): RacerState | undefined {
  let best: RacerState | undefined;
  let bestGap = Infinity;
  for (const r of all) {
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
    const gap = Math.abs(r.progress - self.progress);
    if (gap > OVERTAKE.sepRange) continue;
    if (Math.abs(r.lane - self.lane) > OVERTAKE.sepLaneBand) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = r;
    }
  }
  return best;
}

/**
 * Nearest racer ahead within the jockey window, IGNORING lane (the rival to
 * contest, not a lane blocker). Used only for the low-traffic lane lean.
 */
function nearestRival(all: RacerState[], self: RacerState): RacerState | undefined {
  let best: RacerState | undefined;
  let bestGap = Infinity;
  for (const r of all) {
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
    const gap = r.progress - self.progress;
    if (gap <= 0 || gap > OVERTAKE.jockeyRange) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = r;
    }
  }
  return best;
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
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
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
