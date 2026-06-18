import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 원숭이 바나나 던지기 (spec §2.1): targets the nearest racer in front or behind
 * (by progress), excluding same-team and finished/stunned racers. On hit the
 * target slips and freezes (hitStun); the target may dodge (dodgeChance), a
 * visible whiffed-throw gag. A catwalk cat in its dodge window may also avoid it
 * with its own probability (ctx.tryDodge) → dodge gag. Disruptive → never hits a
 * teammate.
 */
export const bananaHandler: SkillHandler = (ctx) => {
  const { self, all, rng, params, frame } = ctx;

  const dir = params.target === 'back' ? -1 : params.target === 'front' ? 1 : rng.bool(0.5) ? 1 : -1;

  const candidates = all
    .filter(
      (r) =>
        r.id !== self.id &&
        r.phase !== 'finished' &&
        r.phase !== 'waiting' &&
        r.phase !== 'stunned' &&
        (self.teamId === undefined || r.teamId !== self.teamId) &&
        (dir === 1 ? r.progress > self.progress : r.progress < self.progress),
    )
    .sort((a, b) =>
      dir === 1 ? a.progress - b.progress : b.progress - a.progress,
    );

  const target = candidates[0];
  ctx.emit({ variant: 'activate', line: ctx.lines.skill });
  if (!target) return; // nobody to throw at — silent whiff

  if (ctx.tryDodge(target)) {
    // catwalk slips the banana — dodge gag (renderer shows the target's line).
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  if (rng.bool(Number(params.dodgeChance))) {
    ctx.emit({ variant: 'dodge', targetId: target.id, line: ctx.lines.dodge ?? '어… 빗나갔네' });
    return;
  }

  const stunFrames = Math.round(Number(params.hitStunMs) / DT_MS);
  target.phase = 'stunned';
  target.speed = 0;
  target.skill.burst = 0;
  target.skill.effectUntil = frame + stunFrames;
  ctx.emit({ variant: 'hit', targetId: target.id });
};
