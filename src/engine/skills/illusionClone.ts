import type { SkillHandler } from './types.ts';

/**
 * 구미호 분신술 (illusionClone): the gumiho conjures `cloneCount` non-scoring
 * decoys — one ~1 body-length AHEAD, one ~1 body-length BEHIND — then keeps
 * running itself. The decoys are NOT racers (no rank/score/overtake): the engine
 * owns them as a separate light list (see RaceEngine + DecoyState). They:
 *   - bump rivals they touch (a brief `collisionStun`, "어?"),
 *   - absorb disruptions aimed at the gumiho (each decoy = one block, "퐁!"),
 *   - despawn after `cloneDuration`; on expiry, if the LEAD (front) decoy is
 *     ahead of the body, the gumiho teleports up to it (a gentle forward hop).
 *
 * Inline placement (사용자 요구: 본체와 같은 직선/레인 위 앞·뒤): the decoys sit on the
 * SAME lane as the body, fanned only along progress — one ~1 body-length AHEAD, one
 * ~1 body-length BEHIND. `bodyLenUnits` is the screen body-length expressed in engine
 * progress units (renderer-derived ≈ 57); a small random extra (`gapJitter`) is added
 * on TOP of that floor, never below it, so no tail touches the next head.
 *
 * Teleport (inline): the lead decoy sits ~1 body-length ahead, and the expiry teleport
 * hops the body up TO that lead decoy. With inline placement the visual gap and the
 * teleport distance are one and the same — the body advances ~1 body-length (≈57u ≈ 7
 * 마디), the confirmed forward jump.
 *
 * Collision trade-off (measured): inline (body-lane) decoys collide with the racers
 * the body is chasing / being chased by on the SAME lane (the lead decoy hits the
 * leader ahead, the rear decoy hits the chaser behind). `laneSpread` defaults to 0
 * (pure inline). A small >0 value can be set in data to re-fan decoys laterally onto
 * other lanes' traffic if collisions need raising — collision-reach (lane) and the
 * teleport distance (progress) tune independently.
 *
 * Determinism / purity: the gap jitter (and any lane jitter) is drawn ONLY from
 * `ctx.rng` (the engine's pre-forked `skill:<id>` sub-stream), forked once more by
 * a stable label so the draw order never depends on other skills. The handler just
 * declares the decoys via `ctx.spawnDecoys`; all movement/collision/expiry lives in
 * the engine. Holds (emits nothing) when decoys are already live, so the cooldown
 * re-arms on RETRY and only one decoy set exists at a time.
 */
export const illusionCloneHandler: SkillHandler = (ctx) => {
  const { params } = ctx;
  const count = Math.max(1, Math.round(Number(params.cloneCount ?? 2)));
  const durationMs = Number(params.cloneDuration ?? 3000);
  // 1 fox body-length in engine progress units (renderer-derived ≈ 57; corrected
  // from an earlier 15). Adjacent foxes are spaced AT LEAST this far apart so a tail
  // never touches the next head.
  const bodyLen = Number(params.bodyLenUnits ?? 57);
  // Extra random spacing added on top of the 1-body-length floor (in body-lengths).
  const gapJitter = Number(params.gapJitter ?? 0.6);
  // Lateral push off the body's lane. 0 = pure inline (same lane, the default the
  // user asked for); >0 re-fans decoys onto side-traffic to raise collisions.
  const laneSpread = Number(params.laneSpread ?? 0);

  // Stable sub-stream so the offset draws don't shift if other skills change.
  const rng = ctx.rng.fork('illusionClone');

  // Rank-from-body for a decoy: the 1st ahead-decoy is rank 1, 2nd ahead rank 2,
  // etc. Its center sits `rank` body-lengths from the body + a little jitter, so
  // EVERY adjacent pair (body↔1st, 1st↔2nd, …) stays ≥ ~1 body-length apart.
  const gapFor = (rank: number) => bodyLen * (rank + rng.range(0, gapJitter));
  // Decoy LANE OFFSET from the body (the engine re-anchors lane = owner.lane +
  // this each frame, so the decoy follows the body's lane drift). 0 = pure inline
  // (same line as the body). When laneSpread > 0, alternate sides; the engine
  // clamps the final lane into the [0,1] band.
  const laneOffsetFor = (i: number) => {
    if (laneSpread <= 0) return 0; // inline — directly in front/behind the body
    const dir = i % 2 === 0 ? 1 : -1; // even → outward, odd → inward
    return dir * laneSpread + rng.range(-0.06, 0.06);
  };

  // Alternate ahead / behind, stepping one body-length further out each time, so
  // with the default cloneCount 2 → one ~1 body-length ahead (lead = teleport
  // anchor) + one ~1 body-length behind, inline on the body's lane, never
  // overlapping the body.
  const specs = Array.from({ length: count }, (_, i) => {
    const ahead = i % 2 === 0; // even → ahead, odd → behind
    const rank = Math.floor(i / 2) + 1; // 1, 1, 2, 2, 3, 3, …
    const gap = gapFor(rank);
    return { offset: ahead ? gap : -gap, laneOffset: laneOffsetFor(i), lead: i === 0 };
  });

  const made = ctx.spawnDecoys(specs, durationMs);
  if (made <= 0) return; // already had live decoys → hold (emit nothing)

  ctx.emit({ variant: 'activate', line: ctx.lines.skill });
  ctx.emit({ variant: 'clone' });
};
