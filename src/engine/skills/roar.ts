import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 곰 포효 (광역 방해): a roar that briefly staggers every nearby racer — ahead OR
 * behind, any lane, within range. Distinct from the monkey's single ranged stun:
 * it hits many at once by proximity. Excludes teammates and finished racers. A
 * catwalk cat in its dodge window may individually slip the stagger
 * (ctx.tryDodge). Short stagger so it differs from the longer banana stun.
 *
 * Anti-stack (군집 감쇠): a roared victim gets brief immunity to *further* roars
 * (`roarImmuneUntil` = end of stagger + `immuneMs`), mirroring banana's
 * bananaImmuneUntil / abduct's abductImmuneUntil. Without this, a dense pack (or
 * two bears) can chain-restagger the same racers before they recover, locking
 * down most of the field indefinitely while the (roar-immune-to-self) bears
 * cruise unopposed — a laps=1 dense-field breakaway that previously forced
 * staggerMs/cooldown to be tuned weak across ALL lap counts. Immunity caps that
 * cumulative field-wide lockup so the per-hit numbers can be tuned stronger
 * again for long races without re-breaking short ones.
 *
 * Self-propulsion (자기 반동, laps-gated): roar is a pure debuff — it slows the field but
 * never speeds the bear itself up, so its only edge over a long race is the (netted-to-
 * zero) cornering stat, leaving it with no sustained pace advantage as coordinate losses
 * compound over many laps. A landed roar (≥1 real hit), once the bear has BEATEN at least
 * one full lap (`lapsDone = max(0, floor(progress/lapDistance) - 1) > 0`), grants a self
 * speed burst (`selfBurst` for `selfBurstMs`, same burst/effectUntil field advance()
 * already reads — mirrors hedgehog's bristle recoil) scaled by that lap count: `selfBurst
 * × (1 + lapsDone × selfBurstGrowth)`. Gated to 0 rather than merely small at lapsDone=0
 * so a laps=1 race (and the early laps of any race) gets NO extra edge at all — the
 * mechanic stays fully dormant until the field's other, thinner-margin characters
 * (fox in particular) are no longer at stake. The `-1` matters even with the gate: a
 * laps=1 race's finishing stretch still crosses one `lapDistance` (goal = trackLength ×
 * 1.25), so a naive `floor(progress/lapDistance)` flips to 1 right at the finish line
 * scramble — exactly when it would decide the winner. Subtracting 1 keeps a laps=1 race
 * at lapsDone=0 (gate closed) throughout, while a laps=10 race still reaches 8 growth-laps
 * by its final stretch. `lapDistance` defaults to the engine's trackLength (1000, same
 * absolute-progress convention as abduct/mimic's range params).
 */
export const roarHandler: SkillHandler = (ctx) => {
  const { self, all, params, frame } = ctx;
  ctx.emit({ variant: 'activate' });

  const range = Number(params.range);
  const stagger = Math.round(Number(params.staggerMs) / DT_MS);
  const immuneFrames = Math.round(Number(params.immuneMs ?? 0) / DT_MS);
  let hits = 0;
  for (const r of all) {
    if (
      r.id === self.id ||
      r.phase === 'finished' ||
      r.phase === 'waiting' ||
      r.phase === 'stunned' ||
      r.phase === 'eliminated'
    )
      continue;
    if (self.teamId !== undefined && r.teamId === self.teamId) continue;
    if (Math.abs(r.progress - self.progress) > range) continue;
    if (r.aoeImmune) { ctx.emit({ variant: 'dodge', targetId: r.id }); continue; } // 👽 AOE-immune (alien)
    if ((r.skill.starUntil ?? 0) > frame) { ctx.emit({ variant: 'dodge', targetId: r.id }); continue; } // ⭐ star
    if ((r.skill.skillInvulnUntil ?? 0) > frame) { ctx.emit({ variant: 'dodge', targetId: r.id }); continue; } // skill i-frames
    if (frame < Number(r.skill.roarImmuneUntil ?? 0)) { ctx.emit({ variant: 'dodge', targetId: r.id }); continue; } // 군집 감쇠: recently roared
    if (ctx.tryDecoyGuard(r)) { ctx.emit({ variant: 'dodge', targetId: r.id }); continue; } // gumiho decoy absorbs (퐁!)
    if (ctx.tryDodge(r)) {
      // catwalk slips the roar — dodge gag (renderer shows the target's line).
      ctx.emit({ variant: 'dodge', targetId: r.id });
      continue;
    }
    r.phase = 'stunned';
    r.speed = 0;
    r.skill.burst = 0;
    r.skill.effectUntil = frame + stagger;
    r.skill.roarImmuneUntil = frame + stagger + immuneFrames;
    hits++;
    // Per-victim event so the renderer can show a roar-specific stagger FX
    // (distinct from the banana single-target stun).
    ctx.emit({ variant: 'hit', targetId: r.id });
  }

  const selfBurst = Number(params.selfBurst ?? 0);
  if (hits > 0 && selfBurst > 0) {
    const lapDistance = Number(params.lapDistance ?? 1000);
    // -1: see file header — a laps=1 race's finish stretch still crosses one lapDistance,
    // so this keeps lapsDone at 0 there instead of leaking in right at the finish line.
    const lapsDone = Math.max(0, Math.floor(self.progress / lapDistance) - 1);
    // Gated (not just growth=0 at lapsDone=0): a laps=1 race gets NO self-burst at all —
    // the mechanic is dormant until the bear has genuinely beaten a full lap, so it never
    // touches the short-race field (where other characters' floors run razor-thin).
    if (lapsDone > 0) {
      const growth = Number(params.selfBurstGrowth ?? 0);
      self.skill.burst = selfBurst * (1 + lapsDone * growth);
      self.skill.effectUntil = frame + Math.round(Number(params.selfBurstMs ?? 0) / DT_MS);
    }
  }
};
