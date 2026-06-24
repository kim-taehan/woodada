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
  /**
   * Cornering specialty on the same 1–5 scale (midpoint 3 = no preference). Splits a racer's
   * pace between track sections: a low `cornering` is a STRAIGHT sprinter (faster on the
   * straights, slower through the bends), a high one is a CURVE specialist (the reverse). The
   * boost on one section is mirrored by an equal cut on the other (weighted by section length),
   * so the lap-average pace — and thus win-rate fairness — is unchanged; it just makes the lead
   * trade hands every straight↔curve transition. Default 3 (omitted) → no section preference.
   */
  cornering?: number;
  /**
   * Flies/hovers above the track instead of touching ground. Read by the engine
   * to exempt the racer from ground-borne environmental effects (e.g. the
   * penguin icefield slows runners but can't touch something that floats — no
   * boost either, just no contact). Default false.
   */
  airborne?: boolean;
  /**
   * Immune to AREA-OF-EFFECT disruption skills (e.g. the bear's roar stagger). Read by
   * AOE skill handlers to skip this racer (a dodge gag). A trait, not an id check, so any
   * future AOE skill can honour it. Distinct from `airborne` (ground-hazard exemption like
   * the icefield) — don't double-cover the ice here. Default false.
   */
  aoeImmune?: boolean;
  /**
   * Wall-crawl grip (벽타기): the fraction of the CURVE outer-rail distance penalty
   * (LANE.distLoss) this racer shrugs off — 0 = full penalty (normal), 1 = no penalty
   * (runs the outside arc for free). Read by the engine's laneDistanceFactor so a gripper
   * loses less ground swinging wide through the bends. Trait, not an id check. Speed-neutral
   * (only the lane→distance conversion is eased; the "lane never affects speed" rule holds).
   * Default 0 (omitted) → normal outer-rail penalty.
   */
  outerGrip?: number;
  /**
   * Small-target ranged evasion (작은 표적): probability (0..1) that an incoming RANGED
   * disruption simply misses this racer — the banana throw, the spider's web, the shell.
   * Read by those handlers (a trait, not an id check) to whiff the hit and emit a dodge.
   * Resolved deterministically per (target id, frame) like the catwalk dodge, so multiple
   * attackers in one frame agree. Default 0 (omitted) → no evasion.
   */
  rangedEvade?: number;
  /**
   * Head start (빠른 출발): how many ms earlier than the rest of the field this racer begins
   * running. At the gun, every racer is held in place (progress 0, speed 0) for
   * `max(headStartMs across the field) − ownHeadStartMs`, so the racer with the largest head
   * start launches first and the others follow once their hold lapses. A field with no head-start
   * racer (all 0) is held 0ms = the classic simultaneous start. Trait, not an id check. Default 0.
   */
  headStartMs?: number;
  skill: SkillSpec;
  lines: CharacterLines;
}

export type CharacterCatalog = Record<string, CharacterData>;

/** Team winner determination strategy id (spec §4). */
export type ScoringId =
  | 'individual'
  | 'teamRankSum'
  | 'teamAce'
  | 'teamFirstPlace'
  | 'teamRelay'
  | (string & {});

/**
 * Selectable team-mode flavor (team-mode selector, #28). The shell offers these
 * three at setup; each maps to a scoring id (relay also flips RaceConfig.relay).
 * `firstPlace` = 1등 보유, `rankSum` = 등수합, `relay` = 이어달리기.
 */
export type TeamScoringId = 'firstPlace' | 'rankSum' | 'relay';

/** Default team flavor when none is chosen (relay = 이어달리기). */
export const defaultTeamScoringId: TeamScoringId = 'relay';

/** Maps a selectable team flavor to its engine scoring strategy id. */
export const TEAM_SCORING_TO_ID: Record<TeamScoringId, ScoringId> = {
  firstPlace: 'teamFirstPlace',
  rankSum: 'teamRankSum',
  relay: 'teamRelay',
};

export interface GameMode {
  id: string;
  label: string;
  team: boolean;
  scoringId: ScoringId;
  /**
   * Individual-mode deathmatch flavor. Each lap eliminates one racer:
   * `'first'` = the leader drops out (먼저 빠질수록 상위), `'last'` = the
   * trailer drops out (끝까지 남으면 우승). Omitted = normal race. Mirrors
   * `RaceConfig.elimination` (engine) — same field name & values. Final ranking
   * is the engine rank, so no separate scoringId is needed.
   */
  elimination?: 'first' | 'last';
  /** Legacy fixed layout. Unused now — team count lives in RoomStore/RaceConfig. */
  teamLayout?: { teams: number; perTeam: number };
}

/**
 * Setup-screen options for the individual-mode deathmatch selector (mirrors the
 * teamScoringOptions pattern). `id: 'none'` = normal race; `'first' | 'last'`
 * map straight to `GameMode.elimination` / `RaceConfig.elimination`.
 */
export type EliminationId = 'none' | 'first' | 'last';
