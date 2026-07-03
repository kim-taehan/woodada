/**
 * SkillContext assembly, extracted from RaceEngine.ts's `fireSkill` (P5) — same
 * ~100-line ctx object, now a standalone builder over a narrow deps object
 * instead of closure capture. Lets a skill handler be driven directly in tests
 * via `createSkillTestContext` (tests/unit/skillTestContext.ts), which wraps
 * this SAME function with stub deps — no separate hand-rolled mock to drift
 * from the real engine's contract.
 */

import type { CharacterData } from '../../data/schema.ts';
import type { Rng } from '../prng.ts';
import { DT_MS, type DecoyState, type RaceParticipant, type RacerId, type RacerState, type SkillEvent } from '../types.ts';
import type { IceZone } from '../ice.ts';
import type { SkillContext, SkillHandler } from './types.ts';

/** Mutable ice/decoy state slice (a subset of RaceEngine's `Internals`, passed by reference). */
export interface SkillContextState {
  iceZones: IceZone[];
  iceCounter: number;
  decoys: DecoyState[];
  decoyCounter: number;
}

export interface SkillContextDeps {
  frame: number;
  trackLength: number;
  racers: RacerState[];
  participants: Record<RacerId, RaceParticipant>;
  characters: Record<string, CharacterData>;
  /** `self`'s own character data (lines/hitLines/skill.type/skill.params come from here). */
  character: CharacterData;
  /** `self`'s own skill sub-stream (already forked per (racer, skill) by the caller). */
  rng: Rng;
  /** The registered self-activation handler for a skill type, if any (skills.get). */
  getTick: (type: string) => SkillHandler | undefined;
  tryDodge: (target: RacerState) => boolean;
  tryRangedEvade: (target: RacerState) => boolean;
  state: SkillContextState;
}

/**
 * Build the SkillContext for `self` activating (or reacting with) its skill this
 * frame. Bits shared by `self`'s OWN skill and any skill the alien copies through
 * `invokeSkill` (the actor `self` is the same in both — only params/rng/type-
 * stamping differ for a copied skill) live in `shared`; `ctx` layers the per-
 * activation rng/params/emit/invokeSkill on top.
 */
export function buildSkillContext(self: RacerState, events: SkillEvent[], deps: SkillContextDeps): SkillContext {
  const { frame, trackLength, racers, participants, characters, character, rng, getTick, tryDodge, tryRangedEvade, state } = deps;

  const shared = {
    self,
    all: racers,
    byId: (id: RacerId) => racers.find((r) => r.id === id),
    participants,
    frame,
    lines: character.lines,
    hitLines: character.hitLines,
    skillTypeOf: (id: RacerId) => {
      const cid = participants[id]?.characterId;
      return cid ? characters[cid]?.skill.type : undefined;
    },
    skillParamsOf: (id: RacerId) => {
      const cid = participants[id]?.characterId;
      return cid ? characters[cid]?.skill.params : undefined;
    },
    // Pure check (no dispatch / RNG): copyable = registered tick handler, not mimic.
    // illusionClone is banned from being mimicked (the decoy kit is too strong to
    // hand the alien) — treated like 'mimic' itself (uncopyable).
    canCopySkill: (copiedType: string) =>
      copiedType !== 'mimic' && copiedType !== 'illusionClone' && getTick(copiedType) !== undefined,
    tryDodge,
    tryRangedEvade,
    addIceZone: (z: Parameters<SkillContext['addIceZone']>[0]) => {
      const start = ((z.startProgress % trackLength) + trackLength) % trackLength;
      state.iceZones.push({
        id: `ice${state.iceCounter++}`,
        startProgress: start,
        length: z.length,
        expire: frame + z.durationFrames,
        ownerId: self.id,
        boostFactor: z.boostFactor,
        slowFactor: z.slowFactor,
      });
    },
    // Gumiho illusionClone: register non-scoring decoys for `self`. One set per
    // owner at a time — refuse (return 0) while live decoys remain.
    spawnDecoys: (specs: { offset: number; laneOffset: number; lead: boolean }[], durationMs: number) => {
      if (state.decoys.some((d) => d.ownerId === self.id && d.alive)) return 0;
      const expireFrame = frame + Math.round(durationMs / DT_MS);
      for (const s of specs) {
        state.decoys.push({
          id: `decoy:${self.id}:${state.decoyCounter++}`,
          ownerId: self.id,
          offset: s.offset,
          laneOffset: s.laneOffset,
          progress: Math.max(0, self.progress + s.offset),
          lane: Math.max(0, Math.min(1, self.lane + s.laneOffset)), // inline (0) or fanned
          spawnedAt: frame,
          expireFrame,
          lead: s.lead,
          alive: true,
        });
      }
      return specs.length;
    },
    // Gumiho illusionClone defence: a live decoy of `target` intercepts an
    // incoming disruption (pops, emitting clonepop) instead of the owner.
    tryDecoyGuard: (target: RacerState) => {
      const shield = state.decoys.find((d) => d.ownerId === target.id && d.alive);
      if (!shield) return false;
      shield.alive = false;
      events.push({ frame, racerId: target.id, type: 'illusionClone', variant: 'clonepop', line: '퐁!' });
      return true;
    },
  };

  const ctx: SkillContext = {
    ...shared,
    rng,
    params: character.skill.params,
    emit: (e) => events.push({ frame, racerId: self.id, type: character.skill.type, ...e }),
    // Alien mimic dispatch: run another skill's handler with `self` (the alien)
    // as the actor, the scanned racer's params, and an alien-only stable rng fork.
    // Refuses 'mimic' (recursion) and reaction-only skills (no tick handler);
    // returns whether the copied handler actually fired (emitted an event).
    invokeSkill: (copiedType, paramsOverride) => {
      if (copiedType === 'mimic') return false; // recursion guard
      if (copiedType === 'illusionClone') return false; // banned: too strong to mimic
      const copiedTick = getTick(copiedType);
      if (!copiedTick) return false; // reaction-only (e.g. 'bristle') or unknown → uncopyable
      const copiedBefore = events.length;
      const copiedCtx: SkillContext = {
        ...shared,
        // Alien-only sub-stream per copied type: isolates the copied skill's draws
        // from the scanned racer's stream and keeps the order stable/deterministic.
        rng: rng.fork(`mimic:${copiedType}`),
        params: paramsOverride,
        // Stamp the COPIED type so commentary/renderer read it as the alien using
        // that skill (actor stays the alien via racerId = self.id).
        emit: (e) => events.push({ frame, racerId: self.id, type: copiedType, ...e }),
        // A copied skill may not itself copy again (defence in depth; the registry
        // refusal above already blocks 'mimic', this also blocks nested chains).
        invokeSkill: () => false,
        canCopySkill: () => false,
      };
      copiedTick(copiedCtx);
      return events.length > copiedBefore;
    },
  };
  return ctx;
}
