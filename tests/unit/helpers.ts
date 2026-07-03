import { characterCatalog, defaultCharacterIds } from '../../src/data/characters/index.ts';
import type { EngineFrame, RaceConfig, RaceParticipant, SkillEvent } from '../../src/engine/types.ts';

export function makeConfig(opts: {
  characterIds: string[];
  seed: number;
  teamMode?: boolean;
  scoringId?: string;
  teamIds?: (string | undefined)[];
  trackLength?: number;
  laps?: number;
  relay?: boolean;
  elimination?: 'first' | 'last';
}): RaceConfig {
  const participants: RaceParticipant[] = opts.characterIds.map((cid, i) => ({
    id: `p${i}`,
    name: `${characterCatalog[cid].name}${i}`,
    characterId: cid,
    teamId: opts.teamIds?.[i],
  }));
  return {
    participants,
    characters: characterCatalog,
    seed: opts.seed,
    laps: opts.laps ?? 1,
    trackLength: opts.trackLength ?? 1000,
    modeId: opts.teamMode ? 'team' : 'individual',
    scoringId: opts.scoringId ?? 'individual',
    teamMode: opts.teamMode ?? false,
    relay: opts.relay ?? false,
    elimination: opts.elimination,
  };
}

export const allThree = [...defaultCharacterIds];

/** First event across all frames matching the predicate (or undefined). */
export function findEvent(
  frames: EngineFrame[],
  pred: (e: SkillEvent) => boolean,
): SkillEvent | undefined {
  for (const f of frames) for (const e of f.events) if (pred(e)) return e;
  return undefined;
}

/** All events across all frames matching the predicate, tagged with their frame number. */
export function collectEvents(
  frames: EngineFrame[],
  pred: (e: SkillEvent) => boolean,
): Array<{ frame: number; event: SkillEvent }> {
  const out: Array<{ frame: number; event: SkillEvent }> = [];
  for (const f of frames) for (const e of f.events) if (pred(e)) out.push({ frame: f.frame, event: e });
  return out;
}
