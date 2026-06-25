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
 * Lane → distance conversion factor (인코스 우위). A racer's per-frame `speed` is
 * multiplied by this when accumulating `progress`: both on CURVES and STRAIGHTS the
 * outer rail is longer than the inner rail, so the outer rail gets less forward
 * distance for the same speed. Lane clamped to [0,1]. Pure / deterministic — lane
 * affects DISTANCE, never speed.
 *
 * 벽타기 (`outerGrip` 0..1): a gripper shrugs off that fraction of the distance penalty,
 * so its effective distLoss is `LANE.distLoss * (1 - outerGrip)` — it loses less ground
 * out wide.
 */
export function laneDistanceFactor(lane: number, _onCurve: boolean, outerGrip = 0): number {
  const distLoss = LANE.distLoss * (1 - clamp(outerGrip, 0, 1));
  // Both curves and straights have longer outer lanes → always apply distLoss
  return 1 - distLoss * clamp(lane, 0, 1);
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
// `boxLane` (optional) is the lane of the nearest reachable item box ahead, precomputed by the
// engine (which knows trackLength) — used for the gentle box-seek lean (적극 획득).
// `holdLane`: during the opening start straight (before the first curve, set by the engine which
// knows the track sections) racers KEEP their start-grid lane — no weaving/scrambling — for a
// clean staggered launch, so the race doesn't look chaotic the instant it begins (출발 직선 유지).
export function applyOvertake(
  self: RacerState,
  all: RacerState[],
  _rng: Rng,
  frame: number,
  boxLane?: number,
  holdLane = false,
): void {
  // Out-of-control bursts (zoomies / nap-dash) plow ahead — readable, not blocked.
  if (self.phase === 'straying') return;

  // 출발 직선 라인 유지: on the opening straight, hold the start lane (no lane change at all) so
  // the field launches cleanly in formation; the scramble/overtake begins only at the first curve.
  if (holdLane) {
    self.phase = 'running';
    self.facing = 0;
    self.weaveSide = 0;
    return; // lane left untouched — stays in the start-grid lane
  }

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

  // 빈 라인 찾기: probe a side for the FIRST open lane, scanning outward at `weaveSteps`
  // multiples of laneStep (one lane over, then two, …). Returns that multiplier (0 = the side
  // is blocked at every scanned distance, or out of bounds). Speed-AGNOSTIC: a blocked racer
  // looks for room whether or not it's faster — so it actively threads a gap instead of dozing
  // nose-to-tail behind an equal/faster rival (the old "어리버리" stack-up).
  const openStep = (side: -1 | 1): number => {
    for (const m of OVERTAKE.weaveSteps) {
      const lane = self.lane + side * OVERTAKE.laneStep * m;
      const inBounds = side === 1 ? lane <= 0.97 : lane >= 0.03;
      if (inBounds && !nearestAhead(all, self, lane, OVERTAKE.laneNear)) return m;
    }
    return 0;
  };

  if (blocker || holding) {
    // Blocked by someone ahead (ANY speed) — steer into the nearest OPEN lane: keep a committed
    // side while it stays open (weave-hold hysteresis); on a fresh weave try the INSIDE (−) first,
    // then the OUTSIDE (+), each scanned outward for room. Fully deterministic — no rng.
    let side: -1 | 1 | 0 = 0;
    let mult = 1;
    const heldStep = committed !== 0 ? openStep(committed) : 0;
    if (committed !== 0 && (holding || heldStep)) {
      side = committed;
      mult = heldStep || 1;
    } else {
      const inM = openStep(-1);
      const outM = inM ? 0 : openStep(1); // inside-first: only look outside if inside is jammed
      if (inM) { side = -1; mult = inM; }
      else if (outM) { side = 1; mult = outM; }
    }

    if (side !== 0) {
      // Excursion is a FIXED step off the inner rail (target = innerGoal + side·mult·laneStep),
      // not off the current lane — so a blocked passer swings out to the open lane and HOLDS
      // there (the inside pull brings it back after the pass), instead of cascading lane-by-lane
      // to the outer wall when the field is dense.
      offset += side * OVERTAKE.laneStep * mult;
      self.phase = 'running';
      self.facing = side;
      self.weaveSide = side;
      self.skill.weaveHold = frame + OVERTAKE.weaveHoldFrames; // (re)arm the hold
    } else if (blocker) {
      // Genuinely boxed — no open lane on either side at any scanned width → decelerate behind it.
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

  // 🎁 Box-seek (적극 획득): if a reachable item box is ahead, lean the lane target toward its
  // lane so the box isn't auto-grabbed by whoever rides the inner rail (usually the leader) —
  // a trailer steers out to claim a wide box. Gentle (a side influence in the additive sum, not
  // an override): target moves a `boxSeekGain` fraction from `base` toward the box lane.
  if (boxLane !== undefined) offset += (boxLane - base) * OVERTAKE.boxSeekGain;

  // Sum → clamp → single rate-limited drift. All influences composed additively above.
  const target = clamp(base + offset, 0.05, 0.95);
  // 🐱 고양이 — 민첩한 발: 라인 변경 속도가 남들보다 70% 빠름
  const laneDrift = self.characterId === 'cat' ? OVERTAKE.laneDrift * 1.7 : OVERTAKE.laneDrift;
  self.lane = moveToward(self.lane, target, laneDrift);
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
