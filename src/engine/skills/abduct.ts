import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';
import { powerEffectScale } from '../stats.ts';

/**
 * 거미 거미줄 납치 (abduct): the spider flings a web at the nearest racer *just
 * ahead* (larger progress, in the `minRange`..`range` band), excluding teammates /
 * finished / waiting, and YANKS it back behind the spider — a single-target
 * *positional* demotion (the spider's distinct role: others stun/shove/slow in
 * place, the spider drags the leader back into the pack). The yanked racer also
 * lands tangled in web: a brief speed slow (`tangleMul` for `tangleMs`).
 *
 * Mechanic mirrors divebomb's targeting (same minRange..range band, id tie-break,
 * no RNG during the sort) but is fully DETERMINISTIC — no gamble, no rng draw at
 * all (substream untouched). Resistance is consistent with the rest of the engine:
 *   - the pull *distance* is eased by the target's power (powerEffectScale), like
 *     bristle's shove,
 *   - the tangle *slow magnitude* is eased centrally at the speed-application site
 *     (RaceEngine, via powerEaseSlow on slowMul), like bristle/lightning/fart.
 *
 * - No target ahead in range (spider leading, or next racer too far / too close)
 *     → hold: emit NOTHING so the engine reads 'declined to fire' and retries on
 *     RETRY_COOLDOWN_MS (no FX/bubble, no wasted cooldown, no rng draw).
 * - ⭐ star on the target → 'dodge' (the web glances off), no effect.
 * - catwalk dodge window (ctx.tryDodge) → 'dodge', no effect.
 * - otherwise → 'activate', then drag the target to `self.progress - pullGap`
 *     (clamped ≥ 0, eased by the target's power), apply the tangle slow, and emit
 *     'hit' (targetId = target).
 *
 * Anti-stack: like banana, a grabbed target gets brief immunity to *further*
 * abducts (`abductImmuneUntil` = end of tangle + `immuneMs`) so a relay spider team
 * can't chain-yank one victim leg after leg.
 */
export const abductHandler: SkillHandler = (ctx) => {
  const { self, all, params, frame } = ctx;
  const range = Number(params.range);
  const minRange = Number(params.minRange ?? 0);

  const candidates = all
    .filter(
      (r) =>
        r.id !== self.id &&
        r.phase !== 'finished' &&
        r.phase !== 'waiting' &&
        r.phase !== 'eliminated' &&
        frame >= (Number(r.skill.abductImmuneUntil ?? 0)) && // still web-immune from a recent grab
        (self.teamId === undefined || r.teamId !== self.teamId) &&
        r.progress > self.progress &&
        r.progress - self.progress >= minRange &&
        r.progress - self.progress <= range,
    )
    // Nearest ahead first; id tie-break (stable, draw-order independent, no RNG).
    .sort((a, b) => a.progress - b.progress || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const target = candidates[0];
  // Nobody to grab → hold (emit nothing → engine retries on RETRY_COOLDOWN_MS).
  if (!target) return;

  ctx.emit({ variant: 'activate', line: ctx.lines.skill });

  if ((target.skill.starUntil ?? 0) > frame) { // ⭐ star deflects the web
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if ((target.skill.skillInvulnUntil ?? 0) > frame) { // skill i-frames: the web glances off
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDodge(target)) { // catwalk slips the web — dodge gag
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  // Yank the target back behind the spider. High-power targets resist some of the
  // pull distance (consistent with bristle's shove resistance).
  const resist = powerEffectScale(target.power);
  const desired = self.progress - Number(params.pullGap) * resist;
  // Only ever pull BACKWARD (the target is ahead, so desired < target.progress;
  // clamp ≥ 0 so a near-start grab can't send it negative).
  target.progress = Math.max(0, Math.min(target.progress, desired));

  // Web tangle: a brief speed slow (same field the engine multiplies into speed
  // and that bristle/lightning/fart use; magnitude eased by power centrally).
  const tangleFrames = Math.round(Number(params.tangleMs) / DT_MS);
  target.skill.slowUntil = frame + tangleFrames;
  target.skill.slowMul = Number(params.tangleMul);

  // Anti-stack: no further abduct until the tangle lifts + a buffer.
  const immuneFrames = Math.round(Number(params.immuneMs ?? 0) / DT_MS);
  target.skill.abductImmuneUntil = frame + tangleFrames + immuneFrames;

  ctx.emit({ variant: 'hit', targetId: target.id });
};
