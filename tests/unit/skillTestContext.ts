import { buildSkillContext, type SkillContextState } from '../../src/engine/skills/context.ts';
import type { SkillContext, SkillHandler } from '../../src/engine/skills/types.ts';
import type { RaceParticipant, RacerState, SkillEvent } from '../../src/engine/types.ts';
import { createRng } from '../../src/engine/prng.ts';
import { characterCatalog } from '../../src/data/characters/index.ts';

/**
 * Test-only factory for a real SkillContext, so a skill handler can be driven
 * directly (`handler(ctx)`) without spinning up a full RaceEngine/simulateRace.
 * Wraps the SAME `buildSkillContext` the engine uses — every field/method a
 * test exercises is the production implementation, not a hand-rolled mock, so
 * the test and engine contracts can't silently drift apart.
 *
 * Defaults: `all` = just `self`; no dodge/evade; no mimic-copyable skills; a
 * fresh seeded rng; empty ice/decoy state. Override any of these per test.
 */
export function createSkillTestContext(opts: {
  self: RacerState;
  all?: RacerState[];
  frame?: number;
  trackLength?: number;
  seed?: number;
  tryDodge?: (target: RacerState) => boolean;
  tryRangedEvade?: (target: RacerState) => boolean;
  getTick?: (type: string) => SkillHandler | undefined;
}): { ctx: SkillContext; events: SkillEvent[]; state: SkillContextState } {
  const all = opts.all ?? [opts.self];
  const character = characterCatalog[opts.self.characterId];
  const events: SkillEvent[] = [];
  const state: SkillContextState = { iceZones: [], iceCounter: 0, decoys: [], decoyCounter: 0 };
  const participants: Record<string, RaceParticipant> = Object.fromEntries(
    all.map((r) => [r.id, { id: r.id, name: r.id, characterId: r.characterId, teamId: r.teamId }]),
  );

  const ctx = buildSkillContext(opts.self, events, {
    frame: opts.frame ?? 0,
    trackLength: opts.trackLength ?? 1000,
    racers: all,
    participants,
    characters: characterCatalog,
    character,
    rng: createRng(opts.seed ?? 1),
    getTick: opts.getTick ?? (() => undefined),
    tryDodge: opts.tryDodge ?? (() => false),
    tryRangedEvade: opts.tryRangedEvade ?? (() => false),
    state,
  });

  return { ctx, events, state };
}
