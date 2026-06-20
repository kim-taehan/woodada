import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';
import { powerEffectScale } from '../stats.ts';

/**
 * 독수리 박치기 (도박 박치기, type 이름은 'divebomb' 유지): the eagle hops up and
 * headbutts the nearest racer *just ahead* (larger progress, within `range`),
 * excluding teammates / finished / waiting. (Mechanic unchanged from the old
 * sky-dive flavor; only the narrative is now a ground hop + headbutt.)
 *
 * - No target ahead in range → empty whiff ('activate' only, no effect).
 * - Target found → 'activate', then a 50/50 gamble (`selfRiskChance`):
 *     win  → the target is stunned (`stunMs`) AND the hop's momentum carries the
 *            eagle forward with a short burst (`diveBurst` for `diveBurstMs`) —
 *            the gamble's payoff, which lets the eagle actually win races; emit
 *            'hit' (targetId = target).
 *     lose → the eagle face-plants itself with the same stun; emit 'self-botch'
 *            (variant 'hit', targetId = self) so the renderer shows the crash on
 *            the eagle rather than the target.
 * - If the target is a catwalk cat that dodges (ctx.tryDodge), the stun is voided
 *     and a 'dodge' (targetId = cat) is emitted instead — no self-risk roll is
 *     even taken in that case.
 *
 * Disruptive skill → never targets a teammate. Tie-break on equal progress is by
 * racer id (stable, draw-order independent) — no RNG during the sort.
 */
export const divebombHandler: SkillHandler = (ctx) => {
  const { self, all, rng, params, frame } = ctx;
  const range = Number(params.range);
  const stunFrames = Math.round(Number(params.stunMs) / DT_MS);

  const candidates = all
    .filter(
      (r) =>
        r.id !== self.id &&
        r.phase !== 'finished' &&
        r.phase !== 'waiting' &&
        (self.teamId === undefined || r.teamId !== self.teamId) &&
        r.progress > self.progress &&
        r.progress - self.progress <= range,
    )
    .sort((a, b) => a.progress - b.progress || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const target = candidates[0];
  // No target ahead in range (e.g. the eagle is leading, or the next racer is
  // too far) → hold: emit NOTHING so the engine reads this as 'declined to fire'
  // (RaceEngine retries on RETRY_COOLDOWN_MS instead of the full cooldown). No
  // FX/bubble, no wasted cooldown — and no rng.bool roll either, so the substream
  // draw order is unchanged from the old whiff.
  if (!target) return;
  ctx.emit({ variant: 'activate', line: ctx.lines.skill });

  if ((target.skill.starUntil ?? 0) > frame) { // ⭐ star deflects the headbutt
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  // Catwalk target may slip the headbutt entirely (probabilistic).
  if (ctx.tryDodge(target)) {
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  // 50/50 gamble: success stuns the target (and carries the eagle forward),
  // failure stuns the eagle itself.
  const success = rng.bool(1 - Number(params.selfRiskChance));
  const victim = success ? target : self;
  victim.phase = 'stunned';
  victim.speed = 0;
  victim.skill.burst = 0;
  // High-power victims shrug off some of the stun (resistance).
  victim.skill.effectUntil = frame + Math.round(stunFrames * powerEffectScale(victim.power));

  if (success) {
    // Hop momentum: a short forward burst (in 'straying', blockable) — the
    // gamble's upside that gives the eagle a real shot at winning.
    self.skill.burst = Number(params.diveBurst);
    self.skill.effectUntil = frame + Math.round(Number(params.diveBurstMs) / DT_MS);
    self.phase = 'straying';
  }
  ctx.emit({ variant: 'hit', targetId: victim.id });
};
