import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 독수리 급강하 (도박 급강하): the eagle plunges at the nearest racer *just ahead*
 * (larger progress, within `range`), excluding teammates / finished / waiting.
 *
 * - No target ahead in range → empty whiff ('activate' only, no effect).
 * - Target found → 'activate', then a 50/50 gamble (`selfRiskChance`):
 *     win  → the target is stunned (`stunMs`) AND the dive's momentum carries the
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

  ctx.emit({ variant: 'activate', line: ctx.lines.skill });
  const target = candidates[0];
  if (!target) return; // nobody ahead in range — empty whiff

  // Catwalk target may slip the dive entirely (probabilistic).
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
  victim.skill.effectUntil = frame + stunFrames;

  if (success) {
    // Dive momentum: a short forward burst (in 'straying', blockable) — the
    // gamble's upside that gives the eagle a real shot at winning.
    self.skill.burst = Number(params.diveBurst);
    self.skill.effectUntil = frame + Math.round(Number(params.diveBurstMs) / DT_MS);
    self.phase = 'straying';
  }
  ctx.emit({ variant: 'hit', targetId: victim.id });
};
