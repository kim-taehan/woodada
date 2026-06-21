/**
 * Skill handler contract (spec §2.4). The engine loop decides *when* a skill
 * fires (cooldown gating, team-target filtering); the handler decides *what
 * happens* by mutating RacerState(s) and emitting events. New skill = one
 * handler registered under its `type`.
 */

import type { Rng } from '../prng.ts';
import type { RacerId, RacerState, SkillEvent, RaceParticipant } from '../types.ts';

export interface SkillContext {
  /** The racer activating the skill (mutable). */
  self: RacerState;
  /** All live racer states this frame (mutable). */
  all: RacerState[];
  byId(id: RacerId): RacerState | undefined;
  participants: Record<RacerId, RaceParticipant>;
  /** Pre-forked sub-stream isolated per (racer, skill type). */
  rng: Rng;
  frame: number;
  params: Record<string, number | string | boolean>;
  /** Emit a renderer-facing event (frame/racerId/type filled by the engine). */
  emit(e: Pick<SkillEvent, 'variant'> & Partial<Omit<SkillEvent, 'variant'>>): void;
  /** Character lines for speech bubbles. */
  lines: { skill: string; win: string; lose: string; dodge?: string };
  /** The skill type of another racer's character — for situational activation. */
  skillTypeOf(id: RacerId): string | undefined;
  /** The skill params of another racer's character (for mimic copy). */
  skillParamsOf(id: RacerId): Record<string, number | string | boolean> | undefined;
  /**
   * Resolve catwalk's probabilistic dodge for `target` against an incoming
   * *direct* disruption (banana/roar/divebomb). Returns true if the target
   * avoids it. Deterministic per (target id, frame): every attacker in the same
   * frame gets the same answer regardless of order (engine memoises the roll).
   * Returns false when the target has no open dodge window.
   */
  tryDodge(target: RacerState): boolean;
  /**
   * Lay an ice zone on the track (penguin icefield). `startProgress` is absolute
   * (the engine wraps it into lap-space). The engine tracks the zone and applies
   * its per-frame speed multipliers + exposes it on EngineFrame.iceZones.
   */
  addIceZone(zone: {
    startProgress: number;
    length: number;
    durationFrames: number;
    boostFactor: number;
    slowFactor: number;
  }): void;
  /**
   * Alien mimic: dispatch the registered handler for `copiedType` with `self` (the
   * alien) as the actor, using `paramsOverride` (the scanned racer's skill params)
   * instead of the alien's own. The engine owns the registry, so it builds the
   * sub-context: ctx{ self:alien, all, frame, emit, lines, tryDodge, addIceZone }
   * with params = paramsOverride and rng = an alien-only stable fork
   * (`mimic:<copiedType>`) — the scanned racer's stream is never polluted and the
   * draw order stays stable/deterministic.
   *
   * Returns false when `copiedType` is UNCOPYABLE — reactive-only (no
   * self-activation tick, e.g. hedgehog 'bristle') or 'mimic' itself (recursion
   * guard) — OR when the copied handler ran but HELD (emitted nothing). Returns
   * true when the copied handler fired (emitted ≥1 event). Copied events are
   * stamped with `copiedType`, so commentary / the renderer read them as "the alien
   * used <that skill>" (actor = the alien). mimic can never dispatch mimic → no
   * infinite recursion / chain.
   */
  invokeSkill(copiedType: string, paramsOverride: Record<string, number | string | boolean>): boolean;
  /**
   * Pure registry check (no dispatch, no RNG): is `copiedType` something the alien
   * could mimic? False for 'mimic' (recursion guard) and reaction-only skills (no
   * self-activation tick, e.g. 'bristle'). Lets mimic emit its "copying X" marker
   * BEFORE running the copied handler, only for a target it can actually copy.
   */
  canCopySkill(copiedType: string): boolean;
}

export type SkillHandler = (ctx: SkillContext) => void;

/**
 * Reactive context for the single event-driven hook `onOvertaken` (TODO #7).
 * Same mutate/emit powers as a tick `SkillContext`, plus the racer that just
 * overtook `self` this frame (the representative passer when several pass at
 * once — see RaceEngine overtake detection). `self` is the racer that was
 * overtaken (= the skill owner).
 */
export interface SkillReactContext extends SkillContext {
  /** The racer that just overtook `self` this frame (representative, nearest). */
  passer: RacerState;
}

export type ReactionHandler = (ctx: SkillReactContext) => void;

/**
 * A skill is either a plain tick handler (cooldown-gated self-activation, the
 * existing model) or an object that bundles an optional tick handler with
 * optional reactive hooks. Both forms are accepted by the registry so the seven
 * legacy skills keep registering as bare functions (full back-compat).
 */
export interface SkillDef {
  /** Cooldown-gated self-activation, called every frame the cooldown allows. */
  tick?: SkillHandler;
  /** Fires the frame `self` is overtaken (event-driven, cooldown-shared). */
  onOvertaken?: ReactionHandler;
}

export type SkillEntry = SkillHandler | SkillDef;

export interface SkillRegistry {
  register(type: string, handler: SkillEntry): void;
  /** The cooldown-gated self-activation handler, if any. */
  get(type: string): SkillHandler | undefined;
  /** The `onOvertaken` reaction handler, if any. */
  getReaction(type: string): ReactionHandler | undefined;
  has(type: string): boolean;
}
