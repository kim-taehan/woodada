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
  /**
   * Death-match (탈락 모드, individual only). When set, the race eliminates one
   * active racer at every lap boundary — the moment the leader (max-progress
   * active racer) completes a new full lap (integer multiple of trackLength):
   *   - 'first': the current 1st place (max progress) is eliminated;
   *   - 'last' : the current last place (min progress) is eliminated.
   * Eliminated racers stop advancing (phase='eliminated') and are excluded from
   * skills/items/catch-up. The race ends when one active racer remains. Ranks:
   *   - 'first': earlier-eliminated ranks HIGHER (1st-out = rank 1, survivor = N);
   *   - 'last' : earlier-eliminated ranks LOWER  (survivor = rank 1, 1st-out = N).
   * Undefined → classic race (finish-order ranking, no eliminations).
   */
  elimination?: 'first' | 'last';
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
  | 'waiting'
  /** Death-match: knocked out at a lap boundary; frozen, no longer racing. */
  | 'eliminated';

/** Per-skill scratch state (serializable). */
export interface SkillRuntime {
  /** Frame index until which a transient effect (burst/stun) lasts. */
  effectUntil?: number;
  /** Extra forward speed applied while effectUntil is active. */
  burst?: number;
  /**
   * catwalk (cat) — REACTIVE just-dodge. There is no pre-opened window any more:
   * when a direct disruption actually targets the cat (engine#tryDodge), and the
   * cat's catwalk cooldown is ready, it rolls `dodgeChance`. On success the dodge
   * consumes the cooldown, awards a small forward slip, and emits activate+dodge.
   * `dodgeFrame`/`dodgeRoll` memoise the roll per (cat id, frame) so several
   * attackers in one frame share one deterministic decision (attacker-order
   * independent). The ice-jump path (applyIce) still reads `dodgeChance` directly.
   */
  dodgeFrame?: number;
  dodgeRoll?: boolean;
  /**
   * hedgehog 작은 표적 — ranged-evade memo. Mirrors dodgeFrame/dodgeRoll: the evade roll
   * against incoming ranged disruption is resolved once per (target id, frame) and cached
   * here so every attacker in that frame sees the same outcome (attacker-order independent).
   */
  evadeFrame?: number;
  evadeRoll?: boolean;
  /**
   * skill i-frames: frame index until which the racer is immune to incoming
   * disruption (stun/slow/pushback/pull/web), granted for ~0.3s the instant it
   * activates its own skill. Distinct from ⭐ star (longer + speed boost); this is
   * a brief activation-protection so a racer isn't disrupted mid-cast.
   */
  skillInvulnUntil?: number;
  /** 🌟 star item: frame index until which the racer is fully immune + boosted. */
  starUntil?: number;
  /** ⚡/💨 item slow: speed is multiplied by `slowMul` until `slowUntil`. */
  slowUntil?: number;
  slowMul?: number;
  /**
   * banana anti-stack: frame index until which this racer is immune to *further*
   * banana hits (set to end-of-stun + a buffer on a banana hit). Stops relay teams
   * from chain-stunning one victim leg after leg.
   */
  bananaImmuneUntil?: number;
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
   * Cornering specialty (1..5, median 3) copied from CharacterData at init. Read each frame to
   * bias speed by track section — fast on straights & slow on curves (low) or vice-versa (high),
   * netting to zero over a lap (see engine/stats.ts sectionSpeedBias). Undefined → no preference.
   */
  cornering?: number;
  /**
   * Immune to AREA-OF-EFFECT disruption skills (copied from CharacterData at init). AOE skill
   * handlers (e.g. roar) skip this racer. Trait-based, not an id check. Undefined → not immune.
   */
  aoeImmune?: boolean;
  /**
   * Wall-crawl grip (벽타기, 0..1) copied from CharacterData at init. Fraction of the curve
   * outer-rail distance penalty (LANE.distLoss) this racer ignores in laneDistanceFactor.
   * Undefined → 0 (normal penalty). Speed-neutral — only the lane→distance conversion is eased.
   */
  outerGrip?: number;
  /**
   * Small-target ranged evasion (작은 표적, 0..1) copied from CharacterData at init. Chance an
   * incoming ranged disruption (banana / web / shell) misses this racer. Undefined → 0 (no evade).
   */
  rangedEvade?: number;
  /**
   * Head start (빠른 출발): frame index until which this racer is held at the start line
   * (progress 0, speed 0) before it begins running. Computed at init from the field-wide head
   * start so the biggest head-start racer launches first. 0 → starts at the gun (frame 0).
   */
  startHoldUntil: number;
  /**
   * Relay-only: this racer's leg index within its team (0-based, participation
   * order; anchor = last). The renderer reads this on the team's active
   * (`running`) racer to show "n/total 주자". Undefined in non-relay races.
   */
  leg?: number;
  phase: RacerPhase;
  /** Lateral heading hint for renderer (-1 inward .. +1 outward). */
  facing: number;
  /**
   * Overtake hysteresis: the lane side this racer has committed to weave toward
   * (-1 inner, +1 outer) while passing a blocker, or 0 / undefined when not
   * committed. Held until the pass clears or that side gets blocked, so the weave
   * target doesn't flip every frame (no per-frame side re-roll → no lane wobble).
   */
  weaveSide?: -1 | 0 | 1;
  /** Frame index when the finish line was crossed. */
  finishedAt?: number;
  /**
   * Death-match: frame index at which this racer was eliminated. Undefined for
   * the lone survivor and for non-elimination races. The renderer reads this (and
   * `eliminationOrder`) to stage the knocked-out racers.
   */
  eliminatedAt?: number;
  /**
   * Death-match: 1-based order of elimination (1 = first knocked out). Lets the
   * renderer/shell recover the exact elimination sequence from any frame without
   * scanning event history. Undefined for the survivor and non-elimination races.
   */
  eliminationOrder?: number;
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
    | 'star' | 'lightning' | 'shell' | 'shellhit' | 'fart'
    /** Death-match: this racer was just eliminated at a lap boundary. */
    | 'out'
    /** Gumiho illusionClone: decoys spawned (racerId = the gumiho). */
    | 'clone'
    /** A decoy bumped a racer → that racer is stunned (racerId = the victim, line "어?"). */
    | 'clonehit'
    /** A decoy absorbed an incoming disruption for the gumiho → it pops ("퐁!"). */
    | 'clonepop'
    /** Gumiho teleports forward to the lead decoy when the clones expire ("스르르…퐁!"). */
    | 'teleport';
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

/**
 * Gumiho illusionClone decoy (분신). A NON-scoring entity: it is never a racer,
 * never enters the rank/scoring/overtake/item systems, and only carries
 * progress + lane so the renderer can draw it. A decoy holds a fixed forward
 * `offset` from its owner (re-anchored each frame) but a fixed SPREAD `lane`
 * deliberately fanned off the owner's lane so it sweeps into side-traffic. Decoys
 * bump rivals (a brief stun), absorb incoming disruptions aimed at the owner, and
 * despawn after `cloneDuration` (the owner may teleport to the lead decoy at that
 * moment). Position is absolute progress (not lap-wrapped), matching
 * RacerState.progress.
 */
export interface DecoyState {
  id: string;
  /** The gumiho this decoy belongs to. */
  ownerId: RacerId;
  /** Fixed progress offset from the owner (+ ahead / − behind); held for life. */
  offset: number;
  /**
   * Fixed LANE offset from the owner, held for life. 0 = inline (the decoy tracks
   * the owner's lane every frame, sitting directly in front/behind on the same
   * line — the default). >0/<0 keeps the decoy laterally fanned off the owner onto
   * side-traffic while still following the owner's lane drift.
   */
  laneOffset: number;
  /** Absolute forward distance (owner.progress + offset, clamped ≥ 0). */
  progress: number;
  /** 0 = inside .. 1 = outside, continuous. Re-anchored to owner.lane + laneOffset. */
  lane: number;
  /** Frame the decoy was spawned. */
  spawnedAt: number;
  /** Frame index at which the decoy auto-despawns. */
  expireFrame: number;
  /** The forward-most decoy (the teleport reference point on expiry). */
  lead: boolean;
  /** Cleared to false the moment a collision / absorption consumes the decoy. */
  alive: boolean;
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
  /** Live illusionClone decoys this frame (gumiho; for the renderer to draw). */
  decoys: DecoyState[];
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

/**
 * Staggered start offset (fraction of one lap). At race start the outer-most
 * racer (lane=1) begins this many laps ahead; inner-most (lane=0) starts at 0.
 * Intermediate lanes interpolate linearly. Mirrors the diagonal start line
 * drawn at u=0 in the renderer (outer edge at u=START_STAGGER_FRAC, inner at 0).
 */
export const START_STAGGER_FRAC = 0.018;
