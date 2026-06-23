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
// OVERTAKE constants live in the central tuning module; re-exported here so the
// existing `import { OVERTAKE } from './overtake.ts'` sites keep working.
import { OVERTAKE, LANE } from './tuning.ts';
export { OVERTAKE } from './tuning.ts';

/**
 * Lane → distance conversion factor (인코스 우위), CURVE-ONLY. A racer's per-frame `speed` is
 * multiplied by this when accumulating `progress`: through a CURVE the inner rail (lane 0) keeps
 * the full step (1.0) and the outer rail (lane 1) only `1 - LANE.distLoss` (the longer arc → less
 * forward distance for the same speed); on a STRAIGHT every lane is the same length so the factor
 * is 1 (passing out wide is free — a natural overtaking zone). Lane clamped to [0,1]. Pure /
 * deterministic — lane affects DISTANCE, never speed.
 */
export function laneDistanceFactor(lane: number, onCurve: boolean): number {
  return 1 - (onCurve ? LANE.distLoss : 0) * clamp(lane, 0, 1);
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
// `_rng` is kept for call-site/signature compatibility; the lane rules are now fully
// deterministic (inside-first preference, no coin-flip), so no random draw is taken here.
export function applyOvertake(self: RacerState, all: RacerState[], _rng: Rng, frame: number): void {
  // Out-of-control bursts (zoomies / nap-dash) plow ahead — readable, not blocked.
  if (self.phase === 'straying') return;

  // SINGLE-AUTHORITY lane pipeline (난투 스크램블 모델). Every influence is an additive
  // OFFSET to one base target; they SUM, then a single rate-limited drift moves toward the
  // clamped result. No subsystem overwrites another's target, so opposing influences cancel
  // instead of fighting frame-to-frame — the ±laneDrift square-wave jitter is structurally
  // impossible. Two lane-change rules (spec):
  //   (1) OVERTAKE — blocked by a racer ahead I'm FASTER than → pass on the INSIDE if it's
  //       open (shorter arc), else go AROUND the OUTSIDE (paying the distLoss). The side is a
  //       deterministic inside-first preference, NOT an rng coin-flip.
  //   (2) CLOSE THE DISTANCE — leading or no traffic → drift to the inner rail (short arc).
  // homeLane is now only the start-grid position; it is NEVER a cruise anchor, so an
  // outer-starting racer genuinely migrates inward and the field scrambles for the rail.
  const wander = Math.sin(frame * OVERTAKE.wanderFreq + self.homeLane * 23.1) * OVERTAKE.wanderAmp;
  const base = OVERTAKE.innerGoal + wander; // everyone seeks the inside (rule 2)
  let offset = 0;

  const blocker = nearestAhead(all, self, self.lane, OVERTAKE.laneNear);
  const committed = self.weaveSide ?? 0;
  // Weave-hold latch: once a side is committed, keep it for `weaveHoldFrames` even if the
  // immediate blocker momentarily clears, so the racer completes the pass instead of snapping
  // back and re-blocking every frame (the old ±laneDrift jitter). Frame counter in the
  // serializable skill bag — deterministic, no RNG.
  const holding = committed !== 0 && Number(self.skill.weaveHold ?? 0) > frame;
  // Rule 1 only fires against a racer we can actually out-run; a slower/equal racer just
  // queues behind it (decelerates) instead of swinging out pointlessly.
  const canPass = !!blocker && self.speed > blocker.speed;

  const clearOn = (side: -1 | 1): boolean => {
    const lane = self.lane + side * OVERTAKE.laneStep;
    const inBounds = side === 1 ? lane <= 0.97 : lane >= 0.03;
    return inBounds && !nearestAhead(all, self, lane, OVERTAKE.laneNear);
  };

  if (canPass || holding) {
    // Keep a committed side while it stays open (hysteresis / weave-hold); on a FRESH weave
    // try the INSIDE (−) first, fall back to the OUTSIDE (+). Fully deterministic — no rng.
    let side: -1 | 1 | 0 = 0;
    if (committed !== 0 && (holding || clearOn(committed))) {
      side = committed;
    } else if (canPass) {
      side = clearOn(-1) ? -1 : clearOn(1) ? 1 : 0;
    }

    if (side !== 0) {
      // Excursion is a FIXED step off the inner rail (target = innerGoal + side·laneStep), not
      // off the current lane — so a blocked passer swings out ~one lane to go around and HOLDS
      // there (then the inside pull brings it back after the pass), instead of cascading lane-
      // by-lane to the outer wall when the field is dense (which walled the pack inner+outer).
      offset += side * OVERTAKE.laneStep;
      self.phase = 'running';
      self.facing = side;
      self.weaveSide = side;
      self.skill.weaveHold = frame + OVERTAKE.weaveHoldFrames; // (re)arm the hold
    } else if (blocker) {
      // Both sides blocked (or the hold lapsed onto traffic) — decelerate behind the blocker.
      self.speed = Math.min(self.speed, blocker.speed) * OVERTAKE.blockDecel;
      self.phase = 'blocked';
      self.facing = 0;
      self.weaveSide = 0;
      self.skill.weaveHold = 0;
    } else {
      self.weaveSide = 0;
      self.phase = 'running';
      self.facing = 0;
    }
  } else if (blocker) {
    // Blocked by a racer we're NOT faster than — queue behind it (decelerate), don't weave.
    self.speed = Math.min(self.speed, blocker.speed) * OVERTAKE.blockDecel;
    self.phase = 'blocked';
    self.facing = 0;
    self.weaveSide = 0;
  } else {
    // Clear of traffic (rule 2) — drift to the inner rail; `base` already targets the inside.
    self.weaveSide = 0;
    self.phase = 'running';
    self.facing = base < self.lane ? -1 : base > self.lane ? 1 : 0;
  }

  // Scramble fan-out (난투 분산): fan OUTWARD in proportion to how packed the field is ahead of
  // me and on/inside my own line. Everyone wants the rail (base), so this is what stops the pack
  // collapsing into one/two lines — the more rivals queued ahead-inside, the wider I spread, so
  // the field grades across the lane width (leaders inside, the pack fanning back-and-out) and a
  // racer boxed behind a stalled/stunned rival has an open lane to swing into. A smooth congestion
  // SUM (no on/off boundary) added to the single target → can't toggle into jitter. No RNG.
  let pressure = 0;
  for (const r of all) {
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
    const gap = r.progress - self.progress;
    if (gap <= 0 || gap > OVERTAKE.nearAhead) continue;
    if (r.lane > self.lane + OVERTAKE.laneNear) continue; // only rivals on my line or inside of me
    pressure += 1 - gap / OVERTAKE.nearAhead; // closer ahead = more pressure
  }
  offset += OVERTAKE.scrambleGain * pressure;

  // Sum → clamp → single rate-limited drift. All influences composed additively above.
  const target = clamp(base + offset, 0.05, 0.95);
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
