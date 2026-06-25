import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 펭귄 빙판 (icefield): the penguin lays a slick patch on the track *ahead* of
 * itself. While active, any racer whose lap-position falls inside the zone is
 * affected by SPECIES, not team:
 *   - characterId === 'penguin'  → speeds up (boostFactor): glides on home ice.
 *   - everyone else              → slows down (slowFactor): slips and skids.
 *   - everyone else (sinkChance) → 확률로 '물에 빠짐' (eliminated).
 * This is purely environmental (team-agnostic, identical in solo / team / relay)
 * and is NOT a "direct disruption", so catwalk's dodge does not apply to it.
 *
 * The zone position is derived from the penguin's progress (start =
 * progress + aheadOffset), so it's fully deterministic — no RNG. The engine owns
 * trackLength and wraps the absolute start into lap-space; it also applies the
 * per-frame speed multipliers and exposes the zone on EngineFrame.iceZones.
 */
export const icefieldHandler: SkillHandler = (ctx) => {
  const { self, params, rng } = ctx;
  const durationFrames = Math.round(Number(params.durationMs) / DT_MS);
  
  self.skill.skillInvulnUntil = Math.max(self.skill.skillInvulnUntil ?? 0, (ctx as any).frame + durationFrames);
  
  ctx.addIceZone({
    startProgress: self.progress + Number(params.aheadOffset),
    length: Number(params.zoneLength),
    durationFrames,
    boostFactor: Number(params.boostFactor),
    slowFactor: Number(params.slowFactor),
    sinkChance: Number(params.sinkChance ?? 0),
  });
  ctx.emit({ variant: 'activate' });
};
