/**
 * Pure engine contracts (spec §10, §12.1). The engine knows nothing about
 * screens, PixiJS, DOM or the track *shape*. It deals only with abstract
 * `progress` (forward distance) and `lane` (0 = inside .. 1 = outside,
 * continuous). The renderer maps those onto an oval; track geometry must NOT
 * affect the simulation.
 */

import type { CharacterData } from '../data/schema.ts';

export type RacerId = string;

export interface RaceParticipant {
  id: RacerId;
  name: string;
  characterId: string;
  teamId?: string;
}

export interface RaceConfig {
  participants: RaceParticipant[];
  /** Snapshot of character data by id (serializable, for replay portability). */
  characters: Record<string, CharacterData>;
  seed: number;
  /** Number of laps; default 1 (spec §7). */
  laps: number;
  /** Abstract track length per lap in engine units (NOT pixels). */
  trackLength: number;
  /** Scoring/mode id (spec §4); team rules derive from this. */
  modeId: string;
  scoringId: string;
  teamMode: boolean;
  /**
   * Relay (이어달리기) gate (spec §5). When true, team members run one leg each
   * (exactly one lap per runner) in participation order; only one teammate is
   * active at a time. Non-relay races ignore this and run the classic model.
   */
  relay: boolean;
}

export type RacerPhase =
  | 'running'
  | 'blocked'
  | 'stunned'
  /** Legacy (nap removed): no skill produces this now; kept for renderer compat. */
  | 'napping'
  | 'straying'
  | 'finished'
  /** Relay-only: a teammate parked off-track until its leg starts (spec §5). */
  | 'waiting';

/** Per-skill scratch state (serializable). */
export interface SkillRuntime {
  /** Frame index until which a transient effect (burst/stun) lasts. */
  effectUntil?: number;
  /** Extra forward speed applied while effectUntil is active. */
  burst?: number;
  /**
   * catwalk (cat): frame index until which the cat is in its dodge window. While
   * open, an incoming *direct* disruption (banana/roar/divebomb stun) is avoided
   * with probability `dodgeChance`. Resolved per (cat id, frame) so every
   * attacker in the same frame agrees; see skills/dodge.ts + RaceEngine#tryDodge.
   */
  dodgeUntil?: number;
  /** catwalk: probability that an incoming disruption is avoided during the window. */
  dodgeChance?: number;
  /**
   * catwalk: cached dodge roll for the current frame, keyed by frame index.
   * `dodgeFrame` is the frame the roll was taken on; `dodgeRoll` is its result.
   * Memoised so multiple attackers in one frame share a single deterministic
   * decision (attacker-order independent).
   */
  dodgeFrame?: number;
  dodgeRoll?: boolean;
  /** 🌟 star item: frame index until which the racer is fully immune + boosted. */
  starUntil?: number;
  /** ⚡/💨 item slow: speed is multiplied by `slowMul` until `slowUntil`. */
  slowUntil?: number;
  slowMul?: number;
  /** catwalk: the cat is currently hopping clear over an ice zone (renderer cue). */
  iceJumping?: boolean;
  /** id of the ice zone the cat last decided on (one jump roll per zone entry). */
  iceZoneId?: string;
  /** Generic flag bag for handlers. */
  [k: string]: number | string | boolean | undefined;
}

export interface RacerState {
  id: RacerId;
  characterId: string;
  teamId?: string;
  /** Forward distance traveled in engine units. */
  progress: number;
  /** 0 = inside .. 1 = outside, continuous. */
  lane: number;
  /** Personal cruising lane this racer drifts back toward (spreads the field). */
  homeLane: number;
  /** Current per-frame forward speed (units/frame). */
  speed: number;
  /** Intrinsic cruise speed (jittered per racer, unbiased in expectation). */
  baseSpeed: number;
  /**
   * Relay-only: this racer's leg index within its team (0-based, participation
   * order; anchor = last). The renderer reads this on the team's active
   * (`running`) racer to show "n/total 주자". Undefined in non-relay races.
   */
  leg?: number;
  phase: RacerPhase;
  /** Lateral heading hint for renderer (-1 inward .. +1 outward). */
  facing: number;
  /** Frame index when the finish line was crossed. */
  finishedAt?: number;
  /** Final placement, 1 = first. Assigned at finish. */
  rank?: number;
  /** Frame index until which the skill is on cooldown. */
  skillCooldownUntil: number;
  skill: SkillRuntime;
}

export interface SkillEvent {
  frame: number;
  racerId: RacerId;
  type: string;
  variant:
    | 'activate' | 'hit' | 'dodge' | 'wake' | 'boost' | 'slip' | 'handoff'
    | 'star' | 'lightning' | 'shell' | 'shellhit' | 'fart';
  targetId?: RacerId;
  /** Speech-bubble text (from character.lines). */
  line?: string;
}

/** A pickup box on the track (spec-extension: item boxes). */
export interface ItemBoxState {
  id: string;
  /** Position along one lap, 0..trackLength. */
  progress: number;
  lane: number;
  active: boolean;
}

/**
 * An ice patch laid on the track by the penguin's `icefield` skill. The renderer
 * draws it as a slippery zone. Penguins (by characterId) speed up across it;
 * everyone else slows down. Position is one-lap (0..trackLength) and may wrap.
 */
export interface IceZoneState {
  id: string;
  /** Zone start along one lap, 0..trackLength (may wrap with `length`). */
  startProgress: number;
  /** Zone length in engine units along the lap. */
  length: number;
  /** Frame index until which the zone is active. */
  activeUntil: number;
  /** Racer id of the penguin that laid it. */
  ownerId: RacerId;
}

export interface EngineFrame {
  frame: number;
  /** ms since race start (frame * dtMs). */
  time: number;
  /** Immutable snapshot of every racer this frame (safe to retain for replay). */
  racers: RacerState[];
  /** Events that occurred *this* frame. */
  events: SkillEvent[];
  /** Item-box states this frame (for the renderer to draw). */
  boxes: ItemBoxState[];
  /** Active ice zones this frame (penguin icefield; for the renderer to draw). */
  iceZones: IceZoneState[];
  /** True once every racer has finished. */
  finished: boolean;
}

export interface ScoringResult {
  type: 'individual' | 'team';
  /** Winner first: racerIds (individual) or teamIds (team). */
  order: string[];
  /** Per-entry score detail (rank-sum / ace rank). */
  detail: Record<string, number>;
}

export interface RaceResult {
  /** Finish order, 1st .. last (racerIds). */
  order: RacerId[];
  finishFrame: Record<RacerId, number>;
  scoring: ScoringResult;
  seed: number;
}

/** Fixed simulation timestep. The engine never reads wall-clock. */
export const DT_MS = 1000 / 60;

/**
 * Finish line offset (start line ≠ finish line). Laps 1..(N-1) complete a full
 * loop back to the start line; only the *final* lap runs past the start line by
 * `FINISH_OFFSET_FRAC` of one lap length before the finish (≈3/4 along the
 * bottom straight, near the right corner).
 *
 * Total finish distance = laps × trackLength + FINISH_OFFSET_FRAC × trackLength.
 *
 * Lap boundaries (lap-count increments, "마지막 바퀴!" banner) stay at the integer
 * multiples of trackLength — only the final finish *distance* is pushed back.
 * Shared with the renderer (imported from this module) so the drawn finish line
 * matches the simulated one.
 */
export const FINISH_OFFSET_FRAC = 0.21;
