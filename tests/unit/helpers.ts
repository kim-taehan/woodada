import { characterCatalog, defaultCharacterIds } from '../../src/data/characters/index.ts';
import type { RaceConfig, RaceParticipant } from '../../src/engine/types.ts';

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
