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
}

export type SkillHandler = (ctx: SkillContext) => void;

export interface SkillRegistry {
  register(type: string, handler: SkillHandler): void;
  get(type: string): SkillHandler | undefined;
  has(type: string): boolean;
}
