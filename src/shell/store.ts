/**
 * Shell-side room state (spec §12.4). Builds the serializable RoomState and
 * derives the engine RaceConfig. Random character assignment + default names
 * (spec §5) happen here so the start path needs zero configuration (spec §0).
 */

import { characterCatalog, defaultCharacterIds } from '../data/characters/index.ts';
import { defaultModeId, gameModes } from '../data/modes.ts';
import { teamOrder, type TeamId } from '../data/teams.ts';
import { createRng } from '../engine/prng.ts';
import { randomName } from '../data/names.ts';
import type { RaceConfig, RaceParticipant } from '../engine/types.ts';
import type { ResultMapping, RoomState } from '../transport/types.ts';

export interface DraftParticipant {
  name: string;
  /** undefined = random assignment at start. */
  characterId?: string;
  teamId?: TeamId;
}

const TRACK_LENGTH = 1000;

let counter = 0;
function nextSeed(): number {
  // Avoid Date.now() in tests; mix a monotonic counter with a fixed base.
  counter = (counter + 0x9e3779b1) >>> 0;
  return counter;
}

export class RoomStore {
  drafts: DraftParticipant[] = [];
  modeId = defaultModeId;
  resultMapping: ResultMapping = { byRank: {}, byTeamRank: {} };
  seed = 1;
  laps = 5;
  /**
   * Selected arena (track theme). 'random' = let the renderer resolve it from
   * the seed at race start (single source = renderer + seed). Purely visual, so
   * it never reaches the engine config — only the renderer seam consumes it.
   */
  arenaId = 'random';
  /** Number of active teams in team mode (range 2~4). */
  teamCount = 2;
  /** Relay (이어달리기) toggle — Phase 2; kept here so config carries it. */
  relay = false;

  addName(name: string, teamId?: TeamId): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (this.drafts.length >= 16) return;
    this.drafts.push({ name: trimmed, teamId });
  }

  addBulk(text: string): void {
    for (const line of text.split(/[\n,]/)) this.addName(line);
  }

  /**
   * Seed the first-launch roster so the setup screen opens ready to start
   * (spec §0). Same shape as "+ 참가자 추가": random name, undefined character
   * (=🎲 random). No-op if drafts already exist, so user clears/edits stick.
   */
  seedDefaults(count = 2): void {
    if (this.drafts.length) return;
    for (let i = 0; i < count; i++) this.addName(randomName());
  }

  remove(index: number): void {
    this.drafts.splice(index, 1);
  }

  setCharacter(index: number, characterId: string | undefined): void {
    if (this.drafts[index]) this.drafts[index].characterId = characterId;
  }

  setName(index: number, name: string): void {
    if (this.drafts[index]) this.drafts[index].name = name;
  }

  /** Active team ids = first `teamCount` of teamOrder. */
  activeTeams(): TeamId[] {
    return teamOrder.slice(0, this.teamCount);
  }

  /** Member count per active team (unassigned drafts excluded). */
  teamCounts(): Map<TeamId, number> {
    const counts = new Map<TeamId, number>(this.activeTeams().map((t) => [t, 0]));
    for (const d of this.drafts) {
      if (d.teamId && counts.has(d.teamId)) counts.set(d.teamId, counts.get(d.teamId)! + 1);
    }
    return counts;
  }

  setTeam(index: number, teamId: TeamId): void {
    if (this.drafts[index]) this.drafts[index].teamId = teamId;
  }

  /** Round-robin even distribution across active teams (i % teamCount). */
  autoAssign(): void {
    const teams = this.activeTeams();
    this.drafts.forEach((d, i) => {
      d.teamId = teams[i % teams.length];
    });
  }

  /** Clamp to 2~4; reassign anyone whose team fell out of the active set. */
  setTeamCount(n: number): void {
    this.teamCount = Math.max(2, Math.min(4, n));
    const teams = this.activeTeams();
    this.drafts.forEach((d, i) => {
      if (!d.teamId || !teams.includes(d.teamId)) d.teamId = teams[i % teams.length];
    });
  }

  /**
   * Top up each active team to a minimum size with random-name members (spec §0:
   * a team mode race is ready to start without manual filling). Same "only if
   * short" spirit as seedDefaults — existing members and user-emptied counts
   * above the floor are never overwritten. Call after entering team mode or
   * raising the team count.
   */
  seedTeamDefaults(min = 2): void {
    const counts = this.teamCounts();
    for (const t of this.activeTeams()) {
      for (let have = counts.get(t) ?? 0; have < min && this.drafts.length < 16; have++) {
        this.addName(randomName(), t);
      }
    }
  }

  clear(): void {
    this.drafts = [];
    this.resultMapping = { byRank: {}, byTeamRank: {} };
  }

  /** Resolve drafts into participants with names + characters assigned (spec §5). */
  private resolveParticipants(seed: number): RaceParticipant[] {
    const rng = createRng(seed ^ 0x5bd1e995);
    return this.drafts.map((d, i) => {
      const characterId = d.characterId ?? rng.pick(defaultCharacterIds);
      const name = d.name || `${characterCatalog[characterId].name}${i + 1}`;
      return { id: `p${i}`, name, characterId, teamId: d.teamId };
    });
  }

  newSeed(): void {
    this.seed = nextSeed();
  }

  buildRoomState(): RoomState {
    const mode = gameModes[this.modeId];
    const participants = this.resolveParticipants(this.seed);
    return {
      version: 1,
      roomId: 'local',
      hostId: 'host',
      participants,
      characters: characterCatalog,
      skins: {},
      modeId: this.modeId,
      scoringId: mode.scoringId,
      resultMapping: this.resultMapping,
      seed: this.seed,
      laps: this.laps,
      arenaId: this.arenaId,
    };
  }

  buildRaceConfig(): RaceConfig {
    const room = this.buildRoomState();
    const mode = gameModes[room.modeId];
    const relay = mode.team && this.relay;
    return {
      participants: room.participants,
      characters: room.characters,
      seed: room.seed,
      laps: room.laps,
      trackLength: TRACK_LENGTH,
      modeId: room.modeId,
      // Relay races score by anchor finish order (spec §5/§7).
      scoringId: relay ? 'teamRelay' : room.scoringId,
      teamMode: mode.team,
      relay,
    };
  }
}

export function serializeRoom(s: RoomState): string {
  return JSON.stringify(s);
}

export function deserializeRoom(json: string): RoomState {
  return JSON.parse(json) as RoomState;
}
