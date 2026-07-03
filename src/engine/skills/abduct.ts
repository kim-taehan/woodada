import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

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
 * all (substream untouched).
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
 *
 * Self-propulsion (자기 추진, laps-gated, engine-dev): abduct only demotes the TARGET's
 * position — the spider itself never gets faster, so over a long race its slow body (no
 * speed mechanic of its own) falls behind even while successfully yanking rivals back
 * (structural laps=10 floor gap). A successful grab, once the spider has BEATEN at least
 * one full lap (`lapsDone = max(0, floor(progress/lapDistance) - 1) > 0`), gives it a self
 * speed burst (`selfBurst` for `selfBurstMs`, the same burst/effectUntil field
 * advance() already reads — mirrors hedgehog's bristle recoil / bear's roar self-burst),
 * scaled by that lap count (see roar.ts's header for why the `-1` — without it a laps=1
 * race's finish stretch still crosses one lapDistance and leaks in right at the finish
 * line). Gated to 0 (not just small) at lapsDone=0 so a laps=1 race gets no extra edge at
 * all — a flat burst would also buff the spider's already-sufficient laps=1 share and
 * squeeze the field's other thin-margin characters. `lapDistance` defaults to 1000 (same absolute-progress
 * convention as `range`/`minRange`/`pullGap` above). Optional (`selfBurst` defaults to 0
 * → no-op) so it is purely additive to the existing yank/tangle effect.
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

  ctx.emit({ variant: 'activate' });

  if ((target.skill.starUntil ?? 0) > frame) { // ⭐ star deflects the web
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if ((target.skill.skillInvulnUntil ?? 0) > frame) { // skill i-frames: the web glances off
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDecoyGuard(target)) { // gumiho decoy takes the web instead (퐁!)
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDodge(target)) { // catwalk slips the web — dodge gag
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryRangedEvade(target)) { // 🦔 작은 표적: the web sails over the small low hedgehog
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  // Yank the target back behind the spider.
  const desired = self.progress - Number(params.pullGap);
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

  // 자기 추진 (see file header): a successful grab also gives the spider itself a
  // laps-gated speed burst — its only source of raw pace, since the yank/tangle above
  // affects only the target.
  const selfBurst = Number(params.selfBurst ?? 0);
  if (selfBurst > 0) {
    const lapDistance = Number(params.lapDistance ?? 1000);
    // -1: see file header — a laps=1 race's finish stretch still crosses one lapDistance,
    // so this keeps lapsDone at 0 there instead of leaking in right at the finish line.
    const lapsDone = Math.max(0, Math.floor(self.progress / lapDistance) - 1);
    // Gated: a laps=1 race gets NO self-burst at all until a full lap is genuinely beaten.
    if (lapsDone > 0) {
      const growth = Number(params.selfBurstGrowth ?? 0);
      self.skill.burst = selfBurst * (1 + lapsDone * growth);
      self.skill.effectUntil = frame + Math.round(Number(params.selfBurstMs ?? 0) / DT_MS);
    }
  }

  ctx.emit({ variant: 'hit', targetId: target.id });
};
