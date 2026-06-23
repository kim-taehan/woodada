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

/**
 * Per-lap "condition" (form). Each time a racer crosses the lap line it rolls a fresh
 * condition 1..`steps` from its own seeded sub-stream (deterministic — replays identically),
 * which scales its cruise speed for that lap: `× (1 + (roll − mid) · gain)`. Centred on `mid`
 * so it nets out (good laps and bad laps, no average inflation → win-rate fairness holds), it
 * gives every racer a luck-of-the-lap swing — so a field of the SAME animal still trades the
 * lead, and the race has the draw-game randomness. Tunable: raise `gain` for wilder form swings.
 */
export const CONDITION = {
  steps: 10, // roll 1..10
  mid: 5.5, // centre (roll 5/6 ≈ neutral)
  gain: 0.03, // speed swing per step from centre (±~13.5% at the 1/10 extremes)
} as const;

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
  perRacer: 0.05,
  /** Hard cap on the multiplier. */
  maxFactor: 1.5,
} as const;

/** Intrinsic cruise speed band (engine units/frame); tight band keeps it fair. */
export const BASE_SPEED = {
  min: 1.3,
  max: 1.5,
} as const;

/**
 * Lane → DISTANCE model (인코스 우위). The inner rail (lane 0) is the short arc; the
 * outer rail (lane 1) is longer, so the SAME speed converts to LESS forward progress
 * out wide. `distLoss` is the fraction of progress an outer-rail racer forfeits per
 * frame vs the inner rail: progress += speed * (1 - distLoss*lane). This makes
 * `progress` itself a *corrected* distance metric (distance actually travelled), so
 * ranking / finish / death-match read it directly and stay fair across lanes.
 * Reverses the old "lane never affects speed" rule → "lane affects distance, not
 * speed". Deterministic (pure function of lane).
 */
export const LANE = {
  distLoss: 0.12, // outer rail covers 12% less distance per frame than the inner
} as const;

/**
 * homeLane spread across the track (0 inside .. 1 outside). Per-slot deterministic:
 * `lo + pow(i/(n-1), exp) * span`, then clamped with a small ± jitter. Lane never
 * affects speed — this is purely positional.
 *
 * `exp` was 1.6 (inside-weighted), which crowded the first ~5 of a 10-racer field
 * into lanes 0.10–0.32 (slot gaps 0.024–0.094, all under OVERTAKE.laneNear 0.16) so
 * the pack read as a single inside line. `exp = 1` gives an even spread (flat ~0.089
 * slot gaps across the full span); the jitter is widened a touch to decorrelate the
 * remaining sub-band slot overlaps that the lateral-separation push then resolves.
 */
export const HOME_LANE = {
  lo: 0.1,
  span: 0.8,
  exp: 1.0,
  clampMin: 0.08,
  clampMax: 0.92,
  jitter: 0.07,
} as const;

/**
 * Catch-up / rubberbanding (anti-runaway). Deterministic, lane- and
 * character-agnostic: each frame a racer's speed is scaled purely by how far it
 * is from the field's mean progress. Trailers get a gentle tailwind, runaway
 * leaders a gentle drag — so the pack stays bunched and lead changes happen
 * without overriding skills (the band is small, a boosted leader still leads).
 * Gap is measured in laps (gap / trackLength) so it scales with track size.
 *
 * FIELD-SIZE SPREAD (see `spread`): the symmetric tailwind/drag above bunches a
 * big field onto the same progress point (everyone gets yanked to the mean), so
 * 16 racers read as a single blob. To let a crowd string out front-to-back
 * WITHOUT a runaway, the correction is reshaped (not removed) as the active-racer
 * count grows past a knee:
 *   - the trailer tailwind (`behindGain`) is *weakened* → trailers aren't pulled
 *     back to the pack, so the field stretches naturally; and
 *   - the leader drag (`aheadDrag`) is *strengthened* → a front-runner is reined
 *     in (a soft "leader rubber-band"), which holds the ceiling that the weaker
 *     tailwind no longer does.
 * Small fields (≤ `spread.kneeAt`) keep the tuned symmetric feel (factor 1).
 * Pure function of a deterministic count — determinism holds.
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
  /**
   * Field-size reshaping (front-to-back spread for crowded races). Per active
   * racer above `kneeAt`, the trailer tailwind is scaled by (1 − `behindFade`),
   * clamped to `behindMin`. ≤ kneeAt racers → scale 1 (unchanged small-field
   * feel). The over-knee count is the field-cooldown knee's sibling.
   *
   * The leader drag is deliberately NOT amplified here: measurement showed that
   * reining the front-runner harder in a crowd both re-bunches the field (less
   * spread) AND over-rewards the favoured inside start slots (it breaks the
   * slot-fairness ceiling). The base `aheadDrag` is already a sufficient
   * anti-runaway rein (the no-runaway gate holds), so spreading is done purely
   * by fading the trailer tailwind — less catch-up pull, no extra leader brake.
   */
  spread: {
    /** Active-racer count at/below which there is no reshaping. */
    kneeAt: 6,
    /** Trailer-tailwind fade per active racer above the knee. */
    behindFade: 0.06,
    /** Floor on the faded tailwind scale (keep *some* catch-up so trailers aren't lapped). */
    behindMin: 0.4,
  },
} as const;

/**
 * L1 overtake / blocking model (spec §8). Racers cruise in their homeLane, weave
 * into an open neighbouring lane to pass (committing to a side), and decelerate
 * when boxed in. Lane no longer affects speed.
 */
export const OVERTAKE = {
  /**
   * Forward proximity window that counts as "blocked by" / "occupied" (triggers weave /
   * decel). Kept ≥ ZONE.minGap so a racer held one personal-zone behind another still
   * registers it as a blocker and weaves out to pass, instead of single-filing nose-to-tail.
   * Sized a few units past minGap so there's an approach zone (decelerate/weave) before the
   * hard collision floor — gives a readable "bumping" feel rather than a snap.
   */
  nearAhead: 16.0,
  /** Lateral closeness (lane units) that counts as the same lane band. */
  laneNear: 0.16,
  /** How far sideways to step when attempting a pass. */
  laneStep: 0.3,
  /** Per-frame lane drift speed. */
  laneDrift: 0.05,
  /** Chance to commit to a pass when a side is open. */
  switchChance: 0.78,
  /**
   * Weave-hold latch length (frames). Once a racer commits to a weave side, it keeps
   * weaving that way for this many frames even if the immediate blocker momentarily
   * clears — so it completes the pass instead of snapping back home and re-blocking
   * every frame (the ±laneDrift square-wave jitter). ≈0.2s at 60fps.
   */
  weaveHoldFrames: 12,
  /** Speed multiplier while boxed in. */
  blockDecel: 0.5,
  /**
   * Inner rail the whole field seeks (rule 2: close the distance). The `base` lane target for
   * every racer that has no one to pass — replaces the old per-racer `homeLane` cruise anchor,
   * so an outer-starting racer actually migrates to the rail instead of settling at the
   * homeLane/(1+inPull) equilibrium (which pinned it outside and locked the inside). Everyone
   * scrambles for this rail; the no-pass clamp + inside-first weave turn that into the jostle.
   */
  innerGoal: 0.05,
  /**
   * Scramble fan-out (난투 분산). Everyone seeks the inner rail (innerGoal), so without this the
   * field stacks into one or two lines. This fans a racer OUTWARD in proportion to how packed the
   * field is AHEAD of it and on/inside its own line — the more rivals queued ahead-inside, the
   * wider it spreads to find racing room. Result: a graded pack across the ~3-lane width (leaders
   * inside, the pack fanning back-and-out), constant jostling, and an open lane to swing into when
   * a rival ahead stalls/stuns. Continuous congestion sum → no toggle/jitter; deterministic.
   * Tunable by eye: raise to spread wider / more chaotic, lower to bunch toward the rail.
   */
  scrambleGain: 0.25,
  /** Gentle lane wander amplitude + frequency (small — decorrelates the pack, not an anchor). */
  wanderAmp: 0.04,
  wanderFreq: 0.05,
} as const;

/**
 * Forward personal-zone spacing (정면 통과 불가). After everyone advances, a racer may not
 * pass THROUGH another on the same lane band — overtaking must go around (a different lane,
 * paying the distLoss). Each frame, a racer that started the frame BEHIND another on its lane
 * is clamped to sit at most `minGap` behind it (and never shoved back past where it began the
 * frame, so it just halts rather than reversing). Kept below `OVERTAKE.nearAhead` so a clamped
 * trailer still registers the blocker and weaves out to pass instead of single-filing. Pure
 * position math, no RNG → deterministic. Tunable by eye in dev: raise for wider nose-to-tail
 * gaps, lower to let racers run closer.
 */
export const ZONE = {
  // ≈ one body-length (engine body ≈ 15 progress units; cf. DECOY.collideDist 10 ≈ ⅔ body),
  // so each racer keeps a clear personal bubble and can't be overlapped — a solid collision
  // feel rather than nose-on-nose. Raise for wider gaps, lower to pack tighter.
  minGap: 12,
} as const;

/**
 * Per-character `cornering` stat coefficient (see engine/stats.ts for the map).
 * Kept so the fairness gates still hold — flavor, not a power ladder.
 */
export const STATS = {
  /**
   * Cornering speed swing at full `cornering` deviation (engine units). This is the
   * deliberately VISIBLE per-section pace split that trades the lead every straight↔curve
   * transition. Applied distance-weighted (curve boost × straightFrac, straight boost ×
   * curveFrac) so the lap-average nets to zero and win-rate fairness holds. Tunable by eye:
   * raise for more dramatic sprint/corner swings & lead changes.
   */
  corneringGain: 0.35,
} as const;

/**
 * Bear-only passive "몸통 밀치기" (body shove). When the bear is in contact with another
 * racer (same lane band + just ahead, within the personal-zone clamp window), the bear
 * nudges that rival OUTWARD (lane += `lanePush`, clamped) while keeping its own pace — a
 * small ever-present advantage in a brawl pack, the live opposite of the (nearly-dead)
 * block-decel mechanic. Pure position math, no RNG → deterministic. Small by design.
 */
export const BEAR_SHOVE = {
  /** Lateral nudge applied to a shoved rival, per contact frame (lane units, outward). */
  lanePush: 0.03,
} as const;
