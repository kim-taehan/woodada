import type { SkillDef } from './types.ts';

/**
 * 고양이 캣워크 (REACTIVE just-dodge). Catwalk has NO self-activation tick and NO
 * overtake reaction — it is resolved entirely inside the engine's `tryDodge`
 * (RaceEngine), the instant a direct disruption (banana / roar / abduct / bristle /
 * item) actually targets the cat:
 *
 *   - if the cat's catwalk cooldown is ready, it rolls `dodgeChance`
 *     (deterministic per (cat id, frame) via skills/dodge#rollDodge);
 *   - on success the engine spends the cooldown, gives the cat a small forward
 *     slip (`slipBoost`, a still-blockable burst), and emits `activate` + `dodge`
 *     so the renderer plays catwalk + the attacker's whiff (the legacy dodge event,
 *     targetId = cat, is preserved for the 냥펀치/캣워크 commentary).
 *
 * The old model pre-armed a dodge *window* on a cooldown tick (it appeared to flick
 * on for no reason). This reactive model only ever reacts to a real incoming hit,
 * so there is nothing to "see" until a dodge actually happens. params: { dodgeChance,
 * slipBoost }. The ice-jump exemption (applyIce) reads `dodgeChance` directly and is
 * unchanged. Registered as an empty SkillDef so `skills.has('catwalk')` stays true.
 */
export const catwalkHandler: SkillDef = {};
