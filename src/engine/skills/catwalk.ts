import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 고양이 캣워크 (확률 회피 + 슬립): for a short window the cat gains a *chance* to
 * dodge incoming direct disruption (banana / roar / divebomb stun) — not
 * guaranteed immunity; each incoming hit is avoided only with probability
 * `dodgeChance` (resolved by the disruption source via ctx.tryDodge,
 * deterministic per (cat id, frame); a successful dodge emits a 'dodge' event
 * with targetId = the cat). During the window the cat also gets a small forward
 * slip (`slipBoost`) — a still-running, blockable burst, so it never plows ahead
 * like the dog's zoomies.
 */
export const catwalkHandler: SkillHandler = (ctx) => {
  const { self, params, frame } = ctx;
  const frames = Math.round(Number(params.windowMs) / DT_MS);
  self.skill.dodgeUntil = frame + frames;
  self.skill.dodgeChance = Number(params.dodgeChance);
  self.skill.burst = Number(params.slipBoost);
  self.skill.effectUntil = frame + frames;
  ctx.emit({ variant: 'activate', line: ctx.lines.skill });
};
