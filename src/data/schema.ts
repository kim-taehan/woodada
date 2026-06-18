/**
 * Data-driven content schema (spec §2.4, §12.3). Characters, modes and skins
 * are plain config objects; skill *behavior* lives in the engine's skill
 * registry keyed by `skill.type`. Adding a character = one data object (+ one
 * handler only if it introduces a new skill type).
 */

export interface Palette {
  base: string;
  outline: string;
  point?: string;
  nose?: string;
  cheek?: string;
  tongue?: string;
  banana?: string;
  /** Open for future characters/skins. */
  [k: string]: string | undefined;
}

/** Skill types active in the current roster; catalog adds more later. */
export type SkillType = 'zoomies' | 'catwalk' | 'banana' | 'divebomb' | 'roar' | 'icefield' | (string & {});

export interface SkillSpec {
  type: SkillType;
  /** Random cooldown window [minMs, maxMs] between activations. */
  cooldownMs: [number, number];
  /** Free-form tunables consumed by the matching handler. */
  params: Record<string, number | string | boolean>;
}

export interface CharacterLines {
  skill: string;
  win: string;
  lose: string;
  dodge?: string;
}

export type VisualType = 'parts' | 'sprite' | 'spine' | 'emoji';

export interface CharacterData {
  id: string;
  name: string;
  visualType: VisualType;
  visualRef: string;
  /** Points at a PartModel (for visualType 'parts'). */
  partModelId?: string;
  proportions: { headBody: string; bigEyes: boolean };
  palette: Palette;
  runStyle: string;
  /** Per-character render size multiplier (default 1). */
  renderScale?: number;
  skill: SkillSpec;
  lines: CharacterLines;
}

export type CharacterCatalog = Record<string, CharacterData>;

/** Team winner determination strategy id (spec §4). */
export type ScoringId = 'individual' | 'teamRankSum' | 'teamAce' | (string & {});

export interface GameMode {
  id: string;
  label: string;
  team: boolean;
  scoringId: ScoringId;
  /** Legacy fixed layout. Unused now — team count lives in RoomStore/RaceConfig. */
  teamLayout?: { teams: number; perTeam: number };
}
