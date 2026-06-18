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
/** Disruptors catwalk is worth dodging — banana(monkey)/roar(bear)/divebomb(eagle). */
const DISRUPTORS = new Set(['banana', 'roar', 'divebomb']);

export const catwalkHandler: SkillHandler = (ctx) => {
  const { self, all, params, frame } = ctx;
  // Situational: only go nimble if a non-teammate disruptor is in the race —
  // no point catwalking when nobody can stun you (e.g. a cats-only race).
  const threatened = all.some((r) => {
    if (r.id === self.id || r.phase === 'finished') return false;
    if (self.teamId !== undefined && r.teamId === self.teamId) return false;
    const type = ctx.skillTypeOf(r.id);
    return type !== undefined && DISRUPTORS.has(type);
  });
  if (!threatened) return; // no emit ⇒ skill stays on retry-cooldown, never fires

  const frames = Math.round(Number(params.windowMs) / DT_MS);
  self.skill.dodgeUntil = frame + frames;
  self.skill.dodgeChance = Number(params.dodgeChance);
  self.skill.burst = Number(params.slipBoost);
  self.skill.effectUntil = frame + frames;
  ctx.emit({ variant: 'activate', line: ctx.lines.skill });
};
