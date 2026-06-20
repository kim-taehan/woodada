import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';
import { powerEffectScale } from '../stats.ts';

/**
 * 고슴도치 가시 밀치기 (bristle): a reactive counter-shove. The hedgehog flares its
 * spines at whoever is *closing in from just behind* and (probabilistically)
 * shoves them back + briefly slows them, and gets a small forward "spine recoil"
 * kick for itself. Defensive identity preserved — the recoil pays out only when
 * it actually blocks an overtake (on a successful shove), never on a whiff.
 *
 * The skill loop is cooldown-gated self-activation (there is no "I am being
 * overtaken" event), so the reactive feel is reconstructed at activation time:
 *   target = nearest racer that is, all of:
 *     - just behind   (0 < self.progress - r.progress <= range)
 *     - closing        (r.speed > self.speed)
 *     - not a teammate / finished / waiting / stunned
 *   Lane is intentionally NOT checked: passing happens by weaving into a *different*
 *   lane, so a same-lane requirement would mean the skill never fires when racers
 *   hold their own lines. We counter the nearest closing chaser regardless of lane.
 *   tie-break on equal gap by racer id (stable, draw-order independent — no RNG).
 *
 * Two "hold" exits emit NOTHING so the engine reads 'declined to fire' and retries
 * on RETRY_COOLDOWN_MS (not the full cooldown) — so the hedgehog never whiffs FX
 * when nobody is on its tail, and a failed roll feels like "the pass slipped past
 * the spines this time" rather than burning the whole cooldown:
 *   1. No qualifying chaser → hold.
 *   2. Chaser present but rng.bool(triggerChance) fails → hold.
 * RNG is only drawn once a chaser exists, so the substream draw order is stable
 * regardless of how many frames pass with nobody behind.
 *
 * On a successful trigger: 'activate', then (consistent with divebomb)
 *   - ⭐ star on the chaser → 'dodge' (the shove glances off), no effect.
 *   - catwalk dodge window (ctx.tryDodge) → 'dodge', no effect.
 *   - otherwise → shove the chaser back (progress -= pushBack, clamped ≥ 0) and
 *     slow it (slowUntil/slowMul, the same field the engine multiplies into speed
 *     and that the lightning item uses); emit 'hit' (targetId = chaser).
 */
export const bristleHandler: SkillHandler = (ctx) => {
  const { self, all, rng, params, frame } = ctx;
  const range = Number(params.range);

  const candidates = all
    .filter(
      (r) =>
        r.id !== self.id &&
        r.phase !== 'finished' &&
        r.phase !== 'waiting' &&
        r.phase !== 'stunned' &&
        (self.teamId === undefined || r.teamId !== self.teamId) &&
        self.progress - r.progress > 0 &&
        self.progress - r.progress <= range &&
        r.speed > self.speed,
    )
    // Nearest chaser first; stable id tie-break (no RNG in the sort).
    .sort((a, b) => b.progress - a.progress || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const target = candidates[0];
  if (!target) return; // nobody closing in from behind → hold, no activation

  // Probabilistic counter: only roll once a chaser exists (stable draw order).
  if (!rng.bool(Number(params.triggerChance))) return; // the pass slipped by — hold

  ctx.emit({ variant: 'activate', line: ctx.lines.skill });

  if ((target.skill.starUntil ?? 0) > frame) { // ⭐ star shrugs off the spines
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDodge(target)) { // catwalk slips past the spines
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  // Shove the chaser back + briefly slow it. High-power chasers resist the shove
  // distance here; the slow's *magnitude* is eased by power centrally at the
  // speed-application site (RaceEngine), so all slowMul effects resist uniformly.
  target.progress = Math.max(0, target.progress - Number(params.pushBack) * powerEffectScale(target.power));
  const slowFrames = Math.round(Number(params.slowMs) / DT_MS);
  target.skill.slowUntil = frame + slowFrames;
  target.skill.slowMul = Number(params.slowMul);

  // Spine recoil: a small forward kick for the hedgehog, ON A SUCCESSFUL SHOVE
  // ONLY (not on whiff/dodge/hold). Same burst mechanism as divebomb's dive
  // momentum — keeps the defensive identity (only profits when actually blocking
  // an overtake) while giving it enough forward edge to clear the win-rate floor.
  self.skill.burst = Number(params.recoilBurst);
  self.skill.effectUntil = frame + Math.round(Number(params.recoilMs) / DT_MS);
  self.phase = 'straying';

  ctx.emit({ variant: 'hit', targetId: target.id });
};
