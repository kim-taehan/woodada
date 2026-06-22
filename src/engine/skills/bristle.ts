import type { SkillDef } from './types.ts';
import { DT_MS } from '../types.ts';
import { powerEffectScale } from '../stats.ts';

/**
 * 고슴도치 가시 밀치기 (bristle): a reactive counter-shove. The hedgehog flares its
 * spines at whoever just OVERTOOK it and (probabilistically) shoves them back +
 * briefly slows them, and gets a small forward "spine recoil" kick for itself.
 * Defensive identity preserved — the recoil pays out only when it actually
 * blocks an overtake (on a successful shove), never on a whiff.
 *
 * TODO #7: this used to reconstruct "I am being overtaken" from a cooldown-gated
 * scan (nearest closing chaser within range). It is now driven by the real
 * `onOvertaken` engine hook — `ctx.passer` IS the racer that just crossed ahead
 * of the hedgehog this frame, so the false-positive (closing but not yet past)
 * and false-negative (passed at equal speed) cases of the old scan are gone. The
 * hook shares bristle's cooldown + `skill:<id>` sub-stream with self-activation
 * (bristle has no tick handler now, so there is no double-fire), and the engine
 * only invokes it while off cooldown — so the rng draw order stays stable.
 *
 *   target = ctx.passer (the overtaker).
 *   Lane is intentionally NOT checked: passing happens by weaving into a *different*
 *   lane, so a same-lane requirement would mean the skill never fires. We counter
 *   whoever just passed, regardless of lane.
 *   Teammates are exempt (team-exclusion preserved): a teammate overtaking → hold.
 *
 * The probabilistic "hold" emits NOTHING so the engine reads 'declined to fire'
 * and retries on RETRY_COOLDOWN_MS (not the full cooldown) — a failed roll feels
 * like "the pass slipped past the spines this time". RNG is only drawn once a
 * (non-teammate) passer exists, so the substream draw order is stable.
 *
 * On a successful trigger: 'activate', then (consistent with divebomb)
 *   - ⭐ star on the passer → 'dodge' (the shove glances off), no effect.
 *   - catwalk dodge window (ctx.tryDodge) → 'dodge', no effect.
 *   - otherwise → shove the passer back (progress -= pushBack, clamped ≥ 0) and
 *     slow it (slowUntil/slowMul, the same field the engine multiplies into speed
 *     and that the lightning item uses); emit 'hit' (targetId = passer).
 */
export const bristleHandler: SkillDef = {
  onOvertaken(ctx) {
    const { self, passer, rng, params, frame } = ctx;

    // Team-exclusion: never counter a teammate that pulls ahead.
    if (self.teamId !== undefined && passer.teamId === self.teamId) return;
    // Inert passers (finished/waiting/stunned) aren't a real threat → hold.
    if (passer.phase === 'finished' || passer.phase === 'waiting' || passer.phase === 'stunned') return;

    // Probabilistic counter: only roll once a real passer exists (stable draw order).
    if (!rng.bool(Number(params.triggerChance))) return; // the pass slipped by — hold

    ctx.emit({ variant: 'activate', line: ctx.lines.skill });

    if ((passer.skill.starUntil ?? 0) > frame) { // ⭐ star shrugs off the spines
      ctx.emit({ variant: 'dodge', targetId: passer.id });
      return;
    }
    if ((passer.skill.skillInvulnUntil ?? 0) > frame) { // skill i-frames: spines glance off
      ctx.emit({ variant: 'dodge', targetId: passer.id });
      return;
    }
    if (ctx.tryDodge(passer)) { // catwalk slips past the spines
      ctx.emit({ variant: 'dodge', targetId: passer.id });
      return;
    }

    // Shove the passer back + briefly slow it. High-power passers resist the shove
    // distance here; the slow's *magnitude* is eased by power centrally at the
    // speed-application site (RaceEngine), so all slowMul effects resist uniformly.
    passer.progress = Math.max(0, passer.progress - Number(params.pushBack) * powerEffectScale(passer.power));
    const slowFrames = Math.round(Number(params.slowMs) / DT_MS);
    passer.skill.slowUntil = frame + slowFrames;
    passer.skill.slowMul = Number(params.slowMul);

    // Spine recoil: a small forward kick for the hedgehog, ON A SUCCESSFUL SHOVE
    // ONLY (not on whiff/dodge/hold). Same burst mechanism as divebomb's dive
    // momentum — keeps the defensive identity (only profits when actually blocking
    // an overtake) while giving it enough forward edge to clear the win-rate floor.
    self.skill.burst = Number(params.recoilBurst);
    self.skill.effectUntil = frame + Math.round(Number(params.recoilMs) / DT_MS);
    self.phase = 'straying';

    ctx.emit({ variant: 'hit', targetId: passer.id });
  },
};
