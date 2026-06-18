import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 곰 포효 (광역 방해): a roar that briefly staggers every nearby racer — ahead OR
 * behind, any lane, within range. Distinct from the monkey's single ranged stun:
 * it hits many at once by proximity. Excludes teammates and finished racers. A
 * catwalk cat in its dodge window may individually slip the stagger
 * (ctx.tryDodge). Short stagger so it differs from the longer banana stun.
 */
export const roarHandler: SkillHandler = (ctx) => {
  const { self, all, params, frame } = ctx;
  ctx.emit({ variant: 'activate', line: ctx.lines.skill });

  const range = Number(params.range);
  const stagger = Math.round(Number(params.staggerMs) / DT_MS);
  for (const r of all) {
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'stunned') continue;
    if (self.teamId !== undefined && r.teamId === self.teamId) continue;
    if (Math.abs(r.progress - self.progress) > range) continue;
    if ((r.skill.starUntil ?? 0) > frame) { ctx.emit({ variant: 'dodge', targetId: r.id }); continue; } // ⭐ star
    if (ctx.tryDodge(r)) {
      // catwalk slips the roar — dodge gag (renderer shows the target's line).
      ctx.emit({ variant: 'dodge', targetId: r.id });
      continue;
    }
    r.phase = 'stunned';
    r.speed = 0;
    r.skill.burst = 0;
    r.skill.effectUntil = frame + stagger;
    // Per-victim event so the renderer can show a roar-specific stagger FX
    // (distinct from the banana single-target stun).
    ctx.emit({ variant: 'hit', targetId: r.id });
  }
};
