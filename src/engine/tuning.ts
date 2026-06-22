/**
 * Engine tuning knobs — ONE place for every gameplay-feel constant the sim reads.
 *
 * Pure data (no DOM/Pixi/RNG). Behaviour-preserving home for values that were
 * previously scattered across RaceEngine.ts / overtake.ts / stats.ts. Changing a
 * number here changes the race for a given seed (and golden screenshots), so the
 * determinism + engine-bias tests act as the guard rail.
 *
 * NOT moved here (kept at their canonical homes, by design):
 *   - DT_MS / FINISH_OFFSET_FRAC: timebase + finish-distance contract constants in
 *     types.ts, imported by the renderer too (not feel knobs).
 *   - ITEM box weights/effects: a self-contained block local to RaceEngine.ts.
 */

/** ±per-frame speed noise (fraction of baseSpeed). */
export const SPEED_JITTER = 0.08;

/** ms to wait before re-checking a skill that declined to fire (no full cooldown). */
export const RETRY_COOLDOWN_MS = 200;

/**
 * Field-size cooldown scaling (16-racer skill-density relief). Every skill cooldown
 * roll (initial + each re-arm) is multiplied by a gentle factor that grows with the
 * number of racers ACTUALLY ON TRACK (relay `waiting`/`finished` excluded — only
 * concurrently-active runners count). Small fields fire at the tuned rate; big
 * fields fire less often so the screen isn't a constant wall of FX.
 *
 *   factor = clamp( 1 + max(0, active - kneeAt) * perRacer , 1 , maxFactor )
 *
 * Pure function of a deterministic count, so determinism holds. Default curve:
 * ≤6 racers → ×1, 16 racers → 1 + 10*0.10 = ×2 (capped at maxFactor).
 */
export const COOLDOWN_FIELD = {
  /** Active-racer count at/below which there is no slowdown (factor stays 1). */
  kneeAt: 6,
  /** Added to the factor per active racer above the knee. */
  perRacer: 0.1,
  /** Hard cap on the multiplier. */
  maxFactor: 2,
} as const;

/** Intrinsic cruise speed band (engine units/frame); tight band keeps it fair. */
export const BASE_SPEED = {
  min: 1.3,
  max: 1.5,
} as const;

/**
 * homeLane spread across the track (0 inside .. 1 outside). Per-slot deterministic:
 * `lo + pow(i/(n-1), exp) * span`, inside-weighted by `exp` > 1, then clamped with
 * a small ± jitter. Lane never affects speed — this is purely positional.
 */
export const HOME_LANE = {
  lo: 0.1,
  span: 0.8,
  exp: 1.6,
  clampMin: 0.08,
  clampMax: 0.92,
  jitter: 0.05,
} as const;

/**
 * Catch-up / rubberbanding (anti-runaway). Deterministic, lane- and
 * character-agnostic: each frame a racer's speed is scaled purely by how far it
 * is from the field's mean progress. Trailers get a gentle tailwind, runaway
 * leaders a gentle drag — so the pack stays bunched and lead changes happen
 * without overriding skills (the band is small, a boosted leader still leads).
 * Gap is measured in laps (gap / trackLength) so it scales with track size.
 */
export const CATCHUP = {
  /** Speed gain per lap of deficit behind the mean (trailers speed up). */
  behindGain: 2.6,
  /** Speed drag per lap of surplus ahead of the mean (leaders slow). */
  aheadDrag: 2.2,
  /** Clamp on the multiplier so nobody teleports or stalls. */
  maxBoost: 1.2,
  minBoost: 0.8,
  /** Dead-zone (laps) around the mean where no correction applies. */
  deadZone: 0.008,
} as const;

/**
 * L1 overtake / blocking model (spec §8). Racers cruise in their homeLane, weave
 * into an open neighbouring lane to pass (committing to a side), and decelerate
 * when boxed in. Lane no longer affects speed.
 */
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
  /**
   * Jockeying (low-traffic position contest). When not lane-blocked, a racer
   * leans its lane target toward a rival ahead within `jockeyRange` (progress
   * units, wider than nearAhead so the lean engages *before* the rival becomes a
   * lane blocker and the weave/block logic takes over). `jockeyLean` is the max
   * fraction of the way to the rival's lane (at point-blank); it fades linearly to
   * 0 at the edge of the range. Speed-neutral — moves the lane target only.
   */
  jockeyRange: 9.0,
  jockeyLean: 0.6,
} as const;

/**
 * Per-character speed/power stat coefficients (see engine/stats.ts for the maps).
 * Kept small so the fairness gates still hold — flavor, not a power ladder.
 */
export const STATS = {
  /** baseSpeed bias at full speed deviation (band is 0.2 wide; this is <10% of it). */
  speedGain: 0.018,
  /** Fraction by which a full power deviation scales an incoming effect's magnitude. */
  powerResist: 0.15,
  /** Fraction by which a full power deviation eases block deceleration toward 1. */
  powerBlockEase: 0.2,
} as const;
