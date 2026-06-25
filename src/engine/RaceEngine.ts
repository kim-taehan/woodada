/**
 * Pure race simulation (spec §8, §10, §12). Fixed-timestep, fully deterministic
 * for a given (config, seed). The engine knows nothing about the renderer or the
 * track shape — only abstract progress + lane.
 */

import { createRng, type Rng } from './prng.ts';
import { applyOvertake, laneDistanceFactor } from './overtake.ts';
import { sectionSpeedBias } from './stats.ts';
import { isCurve, lapPhase } from './track.ts';
import { SPEED_JITTER, RETRY_COOLDOWN_MS, COOLDOWN_SCALE, CATCHUP, BASE_SPEED, HOME_LANE, COOLDOWN_FIELD, OVERTAKE, ZONE, CONDITION, BEAR_SHOVE, DOG_STUN_RECOVER, PENGUIN_SPURT, CAT_CORNER_EXIT, MONKEY_ITEM } from './tuning.ts';
import {
  DT_MS,
  FINISH_OFFSET_FRAC,
  START_STAGGER_FRAC,
  type DecoyState,
  type EngineFrame,
  type RaceConfig,
  type RaceResult,
  type RacerId,
  type RacerState,
  type SkillEvent,
} from './types.ts';
import type { SkillContext, SkillRegistry } from './skills/types.ts';
import { rollDodge, rollRangedEvade } from './skills/dodge.ts';
import type { ScoringRegistry } from './scoring/types.ts';

// Engine tuning knobs (SPEED_JITTER, RETRY_COOLDOWN_MS, CATCHUP, BASE_SPEED,
// HOME_LANE, OVERTAKE, STATS) live in one place: engine/tuning.ts.

// Item boxes spawn at random times + positions during the race (never at the
// start), live briefly, and vanish when collected or after their lifetime.
const ITEM = {
  collectDist: 7, // progress units
  // Lane-DEPENDENT pickup (위치 경쟁): you must actually be near the box's lane to grab it, so a
  // box isn't auto-collected by whoever reaches its progress first (usually the inner-rail leader).
  // ≈ one lane band — paired with the box-seek lean (overtake.ts) so trailers steer out to claim it.
  collectLane: 0.15,
  // Box-seek reach (적극 획득): a racer leans toward a box at most `seekReach` progress units ahead
  // (lap-aware) AND within `seekLaneReach` lanes — close enough to be worth detouring for.
  seekReach: 60,
  seekLaneReach: 0.5,
  maxBoxes: 3,
  firstSpawnMs: [1500, 3000] as [number, number],
  spawnGapMs: [1800, 4000] as [number, number],
  lifeMs: [5000, 8000] as [number, number],
  // Effect tunables for the gamble-box item pool (lightning / fart / shell / star).
  lightningSlowMs: 850, lightningMul: 0.5, // ⚡ slows everyone else
  fartRange: 90, fartSlowMs: 1000, fartMul: 0.55, // 💨 slows racers behind
  shellStunMs: 750, // 🐢 stuns the current leader (even the picker)
  starBoost: 1.4, starMs: 2400, // 🌟 self speed + full immunity
} as const;

/** The four gamble-box outcomes (decoupled from the weight roll so the monkey can remap one). */
type ItemKind = 'star' | 'lightning' | 'shell' | 'fart';

// Skill-activation i-frames: ~0.3s of immunity to incoming disruption granted the
// instant a racer activates its own skill (so it isn't interrupted mid-cast).
const SKILL_INVULN_FRAMES = Math.round(300 / DT_MS);

// Gumiho illusionClone decoys (NON-scoring). A decoy bumps a rival within this
// progress + lane proximity, stunning it once (then the decoy pops). Collision is
// purely geometric (no RNG): same (config, seed) → identical bumps.
const DECOY = {
  collideDist: 10, // progress units (≈ ⅔ body-length; reaches adjacent traffic)
  collideLane: 0.18, // lane proximity (≈ OVERTAKE.laneNear)
  // A bumped racer is briefly immune to *further* decoy bumps, so one gumiho's
  // clones can't chain-stun the same victims lap after lap (anti-accumulation,
  // mirrors banana's bananaImmuneUntil). Keeps the field from over-rebunching.
  rebumpImmuneMs: 1200,
} as const;

interface ItemBox {
  id: string;
  progress: number;
  lane: number;
  expire: number;
}

interface IceZone {
  id: string;
  /** Lap-space start, 0..trackLength (already wrapped). */
  startProgress: number;
  length: number;
  expire: number;
  ownerId: RacerId;
  /** Speed multiplier for the penguin species inside the zone. */
  boostFactor: number;
  /** Speed multiplier for everyone else inside the zone. */
  slowFactor: number;
  /** 확률로 상대를 '물에 빠뜨림' (eliminated). */
  sinkChance?: number;
}

export interface RaceEngine {
  readonly config: RaceConfig;
  readonly frameIndex: number;
  readonly finished: boolean;
  step(): EngineFrame;
  current(): EngineFrame;
  result(): RaceResult | null;
}

interface Internals {
  racers: RacerState[];
  racerRng: Map<RacerId, Rng>;
  skillRng: Map<RacerId, Rng>;
  /** Per-racer stream for the per-lap "condition" (form) roll. */
  conditionRng: Map<RacerId, Rng>;
  /** Stable random key per racer to break processing-order ties fairly. */
  procKey: Map<RacerId, number>;
  /** Per-racer RNG stream for item-box effects. */
  itemRng: Map<RacerId, Rng>;
  /** RNG stream for box spawn timing + placement. */
  boxRng: Rng;
  /** Currently-active item boxes. */
  boxes: ItemBox[];
  /** Frame index of the next box spawn. */
  nextBoxFrame: number;
  boxCounter: number;
  /** Active penguin ice zones (icefield). */
  iceZones: IceZone[];
  iceCounter: number;
  /** Live gumiho illusionClone decoys (NON-scoring — never racers). */
  decoys: DecoyState[];
  decoyCounter: number;
  finishedCount: number;
  /**
   * Relay member queues (spec §5): teamId → member racerIds in participation
   * order. Empty when not a relay race. Pure derivation from config.participants.
   * Leg i of a team is run by members[i % members.length] (cyclic). Total legs
   * per team = config.laps; anchor = leg (laps-1).
   */
  legQueues: Map<string, RacerId[]>;
  /**
   * Relay only: teamId → index of the leg currently in progress (0-based).
   * Advances by 1 each handoff. The team finishes when leg (laps-1) completes.
   */
  teamLeg: Map<string, number>;
  /** Relay only: number of teams whose anchor (final) leg has finished. */
  teamsFinished: number;
  /**
   * Death-match only: integer lap index (1-based) of the next elimination. The
   * leader crossing into lap `elimLapTarget` (progress ≥ elimLapTarget×trackLength)
   * triggers one knock-out, then this advances. Pure progress-derived; no RNG.
   */
  elimLapTarget: number;
  /** Death-match only: number of racers eliminated so far (also the next order #). */
  elimCount: number;
  /** Mean progress of active racers this frame (catch-up reference). */
  meanProgress: number;
  /**
   * Field-size trailer-tailwind fade for this frame (see CATCHUP.spread): scales
   * the catch-up tailwind down as the active-racer count grows so a crowd strings
   * out front-to-back. Recomputed once per frame alongside meanProgress.
   */
  spreadBehind: number;
}

export function createRaceEngine(
  config: RaceConfig,
  skills: SkillRegistry,
  scoring: ScoringRegistry,
): RaceEngine {
  const rng = createRng(config.seed);
  const participantsById = Object.fromEntries(config.participants.map((p) => [p.id, p]));
  // Relay: each runner does exactly one full lap, so a *handoff* fires at the lap
  // boundary (one trackLength per leg, start line = baton line). The ANCHOR leg
  // instead runs trackLength*(1 + FINISH_OFFSET_FRAC) — it crosses that last baton
  // line and keeps going 0.21 of a lap to the real finish, matching individual/
  // team races (which run laps full loops + FINISH_OFFSET_FRAC). Mid-race handoffs
  // stay at the integer lap boundary; only the final finish distance shifts back.
  const goal = config.relay
    ? config.trackLength
    : config.trackLength * (config.laps + FINISH_OFFSET_FRAC);
  // Relay anchor's extended finish (offset past the last baton line).
  const relayAnchorGoal = config.trackLength * (1 + FINISH_OFFSET_FRAC);

  // Relay member queues: teamId → member racerIds in participation order.
  // Leg count per team = config.laps; leg i is run by members[i % size] (cyclic),
  // so a member may run several legs. Anchor = leg (laps-1). A teamless
  // participant becomes a one-member team (its own anchor), matching the scoring
  // fallback. Pure derivation — no RNG, no draw-order dependence.
  const legQueues = new Map<string, RacerId[]>();
  const memberIndexOf = new Map<RacerId, number>();
  if (config.relay) {
    for (const p of config.participants) {
      const team = p.teamId ?? p.id;
      const q = legQueues.get(team) ?? [];
      memberIndexOf.set(p.id, q.length);
      q.push(p.id);
      legQueues.set(team, q);
    }
  }

  // A member's first leg = its participation index j (it runs legs j, j+size, …
  // that are < laps). When size > laps some members never run: no first leg.
  function firstLegOf(id: RacerId): number | undefined {
    const j = memberIndexOf.get(id);
    if (j === undefined) return undefined;
    return j < config.laps ? j : undefined;
  }

  // Active-runner count at the start line — relay members on a non-first leg begin
  // `waiting`, so only concurrently-running racers count toward the field-size
  // cooldown factor (the initial cooldown uses the same factor as in-race re-arms).
  const initialActive = config.relay
    ? config.participants.filter((p) => firstLegOf(p.id) === 0).length
    : config.participants.length;
  const initialCooldownFactor = fieldCooldownFactor(initialActive);

  // 빠른 출발 (head start): the field is held at the gun for the biggest head start present, and
  // each racer's own hold is that field max minus its own — so the largest-head-start racer (the
  // fox) launches at frame 0 and the rest follow when their hold lapses. No head-start racer in
  // the field → max 0 → everyone held 0 (classic simultaneous start). Pure, deterministic.
  const fieldMaxHeadStartMs = Math.max(
    0,
    ...config.participants.map((p) => config.characters[p.characterId]?.headStartMs ?? 0),
  );

  const internal: Internals = {
    racers: config.participants.map((p, i, arr) => {
      const r = rng.fork(`base:${p.id}`);
      const stats = config.characters[p.characterId];
      const baseSpeed = r.range(BASE_SPEED.min, BASE_SPEED.max);
      // Personal cruising lane, spread across the track + a little jitter. The
      // spread is inside-weighted (exponent > 1) so more racers home toward the
      // inner lanes — purely a positional skew; lane never affects speed.
      const spread =
        arr.length > 1 ? HOME_LANE.lo + Math.pow(i / (arr.length - 1), HOME_LANE.exp) * HOME_LANE.span : 0.5;
      const homeLane = Math.max(
        HOME_LANE.clampMin,
        Math.min(HOME_LANE.clampMax, spread + r.range(-HOME_LANE.jitter, HOME_LANE.jitter)),
      );
      // Relay: leg = this racer's current (or next-up) leg, 0-based. The member
      // running leg 0 starts active; everyone else (including future legs of the
      // same member) waits. Members that never run (size > laps) stay waiting.
      const leg = config.relay ? firstLegOf(p.id) : undefined;
      const phase: RacerState['phase'] = config.relay && leg !== 0 ? 'waiting' : 'running';
      return {
        id: p.id,
        characterId: p.characterId,
        teamId: p.teamId,
        progress: phase === 'running' ? homeLane * START_STAGGER_FRAC * config.trackLength : 0,
        lane: homeLane,
        homeLane,
        speed: 0,
        baseSpeed,
        cornering: stats?.cornering,
        aoeImmune: stats?.aoeImmune,
        outerGrip: stats?.outerGrip,
        rangedEvade: stats?.rangedEvade,
        catchupBoost: stats?.catchupBoost,
        // 빠른 출발: held at the gun for (field max − own) head start, then runs (frame 0 for the fox).
        startHoldUntil: Math.round((fieldMaxHeadStartMs - (stats?.headStartMs ?? 0)) / DT_MS),
        leg,
        phase,
        facing: 0,
        skillCooldownUntil: Math.round(
          (rng.range(...firstCooldown(config, p.characterId)) * initialCooldownFactor * COOLDOWN_SCALE) / DT_MS,
        ),
        skill: {},
      } satisfies RacerState;
    }),
    racerRng: new Map(),
    skillRng: new Map(),
    conditionRng: new Map(),
    procKey: new Map(),
    itemRng: new Map(),
    boxRng: rng.fork('boxes'),
    boxes: [],
    nextBoxFrame: 0,
    boxCounter: 0,
    iceZones: [],
    iceCounter: 0,
    decoys: [],
    decoyCounter: 0,
    finishedCount: 0,
    legQueues,
    teamLeg: new Map([...legQueues.keys()].map((t) => [t, 0])),
    teamsFinished: 0,
    elimLapTarget: 1,
    elimCount: 0,
    meanProgress: 0,
    spreadBehind: 1,
  };
  internal.nextBoxFrame = Math.round(internal.boxRng.range(...ITEM.firstSpawnMs) / DT_MS);

  for (const p of config.participants) {
    internal.racerRng.set(p.id, rng.fork(`racer:${p.id}`));
    internal.skillRng.set(p.id, rng.fork(`skill:${p.id}`));
    internal.itemRng.set(p.id, rng.fork(`item:${p.id}`));
    internal.conditionRng.set(p.id, rng.fork(`condition:${p.id}`));
    internal.procKey.set(p.id, rng.next());
  }

  let frame = 0;
  let raceResult: RaceResult | null = null;

  function firstCooldown(cfg: RaceConfig, characterId: string): [number, number] {
    return cfg.characters[characterId].skill.cooldownMs;
  }

  function resolveTimer(self: RacerState): void {
    // A finished racer (relay leg done, or race over) must never be resurrected
    // by a stale transient timer; relay keeps stepping while others run.
    if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'eliminated') return;
    if (self.skill.effectUntil === undefined || frame < self.skill.effectUntil) return;

    if (self.phase === 'stunned') {
      self.phase = 'running';
      self.skill.burst = 0;
      self.skill.effectUntil = undefined;
      return;
    }
    if (self.phase === 'straying') {
      self.phase = 'running';
      self.skill.burst = 0;
      self.skill.effectUntil = undefined;
      return;
    }
    // Generic transient burst on a still-running racer (e.g. catwalk's slip,
    // which stays blockable): just clear it when the window ends.
    self.skill.burst = 0;
    self.skill.effectUntil = undefined;
  }

  /** True while `r` is in skill-activation i-frames (immune to incoming disruption). */
  function isSkillInvuln(r: RacerState): boolean {
    return (r.skill.skillInvulnUntil ?? 0) > frame;
  }

  /**
   * Reactive catwalk just-dodge (replaces the old pre-armed dodge window). Called by
   * a disruption (banana/roar/abduct/bristle/item) when it actually targets a racer.
   * Only the cat reacts, and only while its catwalk cooldown is ready. The roll is
   * deterministic + memoised per (cat id, frame) so every attacker in one frame
   * agrees regardless of order; side effects (cooldown spend, forward slip, activate
   * + dodge emit) are applied exactly once — on the first call that resolves the roll.
   *
   * Returns true iff the disruption is dodged. i-frame / star are handled by the
   * caller BEFORE this (priority: star > i-frame > catwalk dodge > hit), so they
   * never reach here.
   */
  function tryCatwalkDodge(cat: RacerState, events: SkillEvent[]): boolean {
    const character = config.characters[cat.characterId];
    if (!character || character.skill.type !== 'catwalk') return false;
    if (frame < cat.skillCooldownUntil) {
      cat.skill.dodgeFrame = frame;
      cat.skill.dodgeRoll = false;
      return false;
    }
    const chance = Number(character.skill.params.dodgeChance ?? 0);
    const dodged = rollDodge(cat, frame, internal.skillRng.get(cat.id)!, chance);
    if (!dodged) return false; // cooldown NOT spent on a whiff — may dodge a later hit
    // Success: spend the cooldown (field-scaled, same as fireSkill), grant a small
    // blockable forward slip, and emit activate + dodge (legacy dodge event preserved
    // for the 냥펀치/캣워크 commentary; targetId = the cat).
    const [min, max] = character.skill.cooldownMs;
    const factor = fieldCooldownFactor(activeRunnerCount()) * COOLDOWN_SCALE;
    cat.skillCooldownUntil =
      frame + Math.round((internal.skillRng.get(cat.id)!.range(min, max) * factor) / DT_MS);
    cat.skill.burst = Number(character.skill.params.slipBoost ?? 0);
    cat.skill.effectUntil = frame + Math.round(Number(character.skill.params.windowMs ?? 0) / DT_MS);
    cat.phase = 'straying';
    events.push({ frame, racerId: cat.id, type: 'catwalk', variant: 'activate' });
    events.push({ frame, racerId: cat.id, type: 'catwalk', variant: 'dodge', targetId: cat.id });
    return true;
  }

  function isPenguinOnIce(racer: RacerState): boolean {
    if (racer.characterId !== 'penguin') return false;
    const lapPos = racer.progress % config.trackLength;
    return internal.iceZones.some((z) => frame < z.expire && inZone(lapPos, z));
  }

  /**
   * 🦊 작은 표적 (see CHARACTER PASSIVES): resolve `target`'s ranged-evade against an incoming
   * RANGED disruption (banana / web / shell). Trait-driven (CharacterData.rangedEvade) — not an
   * id check. The roll is on the TARGET's own seeded sub-stream, memoised per (target id, frame)
   * so several attackers in one frame agree (attacker-order independent). No cooldown, no side
   * effects other than the cached roll — evasion is always-on. The CALLER emits the dodge event
   * and whiffs the hit. Returns false for any racer without the trait.
   */
  function tryHedgehogEvade(target: RacerState): boolean {
    const chance = config.characters[target.characterId]?.rangedEvade ?? target.rangedEvade ?? 0;
    return rollRangedEvade(target, frame, internal.skillRng.get(target.id)!, chance);
  }

  /**
   * Single skill-firing entry point shared by cooldown-gated self-activation
   * AND the event-driven `onOvertaken` hook (TODO #7). Both paths pass the same
   * cooldown gate, draw from the same `skill:<id>` sub-stream, and award the same
   * full/RETRY cooldown by whether the handler emitted — so a racer's skill can
   * only fire once per frame (whichever path reaches the gate first sets the
   * cooldown into the future), preventing double-fire / RNG double-draw.
   *
   * `passer` is undefined for self-activation (tick) and set for a reaction.
   */
  function fireSkill(self: RacerState, events: SkillEvent[], passer?: RacerState): void {
    if (frame < self.skillCooldownUntil) return;
    if (frame < self.startHoldUntil) return; // 빠른 출발: held racers don't cast at the line
    if (
      self.phase === 'finished' ||
      self.phase === 'waiting' ||
      self.phase === 'stunned' ||
      self.phase === 'eliminated'
    )
      return;

    const character = config.characters[self.characterId];
    const reaction = passer ? skills.getReaction(character.skill.type) : undefined;
    const tick = passer ? undefined : skills.get(character.skill.type);
    if (!reaction && !tick) return;

    const before = events.length;
    // Bits of the context shared by the racer's OWN skill and any skill the alien
    // copies through invokeSkill (the actor `self` is the same in both — only
    // params/rng/type-stamping differ for a copied skill).
    const shared = {
      self,
      all: internal.racers,
      byId: (id: RacerId) => internal.racers.find((r) => r.id === id),
      participants: participantsById,
      frame,
      lines: character.lines,
      hitLines: character.hitLines,
      skillTypeOf: (id: RacerId) => {
        const cid = participantsById[id]?.characterId;
        return cid ? config.characters[cid]?.skill.type : undefined;
      },
      skillParamsOf: (id: RacerId) => {
        const cid = participantsById[id]?.characterId;
        return cid ? config.characters[cid]?.skill.params : undefined;
      },
      // Pure check (no dispatch / RNG): copyable = registered tick handler, not mimic.
      // illusionClone is banned from being mimicked (the decoy kit is too strong to
      // hand the alien) — treated like 'mimic' itself (uncopyable).
      canCopySkill: (copiedType: string) =>
        copiedType !== 'mimic' && copiedType !== 'illusionClone' && skills.get(copiedType) !== undefined,
      tryDodge: (target: RacerState) => {
        if (isPenguinOnIce(target)) return true; // 빙판 위 펭귄은 방해 스킬 무적
        return tryCatwalkDodge(target, events);
      },
      tryRangedEvade: (target: RacerState) => tryHedgehogEvade(target),
      addIceZone: (z: Parameters<SkillContext['addIceZone']>[0]) => {
        const start = ((z.startProgress % config.trackLength) + config.trackLength) % config.trackLength;
        internal.iceZones.push({
          id: `ice${internal.iceCounter++}`,
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
        if (internal.decoys.some((d) => d.ownerId === self.id && d.alive)) return 0;
        const expireFrame = frame + Math.round(durationMs / DT_MS);
        for (const s of specs) {
          internal.decoys.push({
            id: `decoy:${self.id}:${internal.decoyCounter++}`,
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
        const shield = internal.decoys.find((d) => d.ownerId === target.id && d.alive);
        if (!shield) return false;
        shield.alive = false;
        events.push({ frame, racerId: target.id, type: 'illusionClone', variant: 'clonepop', line: '퐁!' });
        return true;
      },
    };
    const ctx: SkillContext = {
      ...shared,
      rng: internal.skillRng.get(self.id)!,
      params: character.skill.params,
      emit: (e) => events.push({ frame, racerId: self.id, type: character.skill.type, ...e }),
      // Alien mimic dispatch: run another skill's handler with `self` (the alien)
      // as the actor, the scanned racer's params, and an alien-only stable rng fork.
      // Refuses 'mimic' (recursion) and reaction-only skills (no tick handler);
      // returns whether the copied handler actually fired (emitted an event).
      invokeSkill: (copiedType, paramsOverride) => {
        if (copiedType === 'mimic') return false; // recursion guard
        if (copiedType === 'illusionClone') return false; // banned: too strong to mimic
        const copiedTick = skills.get(copiedType);
        if (!copiedTick) return false; // reaction-only (e.g. 'bristle') or unknown → uncopyable
        const copiedBefore = events.length;
        const copiedCtx: SkillContext = {
          ...shared,
          // Alien-only sub-stream per copied type: isolates the copied skill's draws
          // from the scanned racer's stream and keeps the order stable/deterministic.
          rng: internal.skillRng.get(self.id)!.fork(`mimic:${copiedType}`),
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
    if (reaction && passer) reaction({ ...ctx, passer });
    else if (tick) tick(ctx);

    const activated = events.length > before;
    if (activated) {
      // i-frames: the instant a racer activates its own skill it is briefly immune to
      // incoming disruption (so it isn't interrupted mid-cast). Set on ANY successful
      // activation — including a skill the alien copied via invokeSkill (same `self`).
      self.skill.skillInvulnUntil = frame + SKILL_INVULN_FRAMES;
      const [min, max] = character.skill.cooldownMs;
      const factor = fieldCooldownFactor(activeRunnerCount()) * COOLDOWN_SCALE;
      self.skillCooldownUntil =
        frame + Math.round((internal.skillRng.get(self.id)!.range(min, max) * factor) / DT_MS);
    } else {
      self.skillCooldownUntil = frame + Math.round(RETRY_COOLDOWN_MS / DT_MS);
    }
  }

  /**
   * Event-driven overtake hooks (TODO #7). After advance, compare this frame's
   * progress against the pre-advance snapshot to find real overtakes: A overtook
   * B iff prev[A] ≤ prev[B] and cur[A] > cur[B]. For each overtaken racer B that
   * owns an `onOvertaken` reaction, pick the representative passer (the passer
   * whose post-advance progress is nearest ahead of B; procKey tie-break) and
   * fire the hook through the shared `fireSkill` gate.
   *
   * Determinism: the detection is a single frame-boundary snapshot (a 2nd-order
   * inversion caused by a shove here is left for next frame, so no in-frame
   * cascade / infinite loop). Overtaken racers are processed in a stable order
   * (cur progress desc, then the init-time procKey) and the representative passer
   * is chosen with the same stable keys — no new RNG draw, no `all`-order or
   * draw-order dependence.
   */
  function fireOvertakeHooks(prevProgress: Map<RacerId, number>, events: SkillEvent[]): void {
    type Pass = { overtaken: RacerState; passer: RacerState };
    const passes: Pass[] = [];
    for (const b of internal.racers) {
      // Only racers that can react are worth detecting (also skips inert ones via
      // the fireSkill gate later, but reaction-less skills never react at all).
      const type = config.characters[b.characterId]?.skill.type;
      if (!type || !skills.getReaction(type)) continue;
      const prevB = prevProgress.get(b.id);
      const curB = b.progress;
      if (prevB === undefined) continue;
      let best: RacerState | undefined;
      for (const a of internal.racers) {
        if (a.id === b.id) continue;
        const prevA = prevProgress.get(a.id);
        if (prevA === undefined) continue;
        // A overtook B this frame: was at-or-behind, now strictly ahead.
        if (!(prevA <= prevB && a.progress > curB)) continue;
        // Representative passer = nearest ahead of B (smallest cur gap); procKey
        // tie-break (stable, draw-order independent, no RNG draw here).
        if (
          !best ||
          a.progress < best.progress ||
          (a.progress === best.progress &&
            internal.procKey.get(a.id)! < internal.procKey.get(best.id)!)
        ) {
          best = a;
        }
      }
      if (best) passes.push({ overtaken: b, passer: best });
    }
    // Stable fire order: leader-side overtaken first (cur progress desc), procKey
    // tie-break — same regime as the self-activation `order`.
    passes.sort(
      (x, y) =>
        y.overtaken.progress - x.overtaken.progress ||
        internal.procKey.get(y.overtaken.id)! - internal.procKey.get(x.overtaken.id)!,
    );
    for (const { overtaken, passer } of passes) fireSkill(overtaken, events, passer);
  }

  /**
   * Anti-runaway multiplier (see CATCHUP). Pure function of this racer's gap to
   * the field mean (in laps) — no RNG, no character/lane term, so it is
   * deterministic and unbiased. Trailers are nudged up, runaway leaders down,
   * within a small clamped band that never overrides a skill burst outright.
   *
   * Field-size reshaping (CATCHUP.spread): in a crowded field the trailer
   * tailwind is faded (let the pack string out front-to-back). The leader drag is
   * left at its base value (amplifying it both re-bunches the field and skews
   * slot fairness — see tuning note). The fade comes from `meanProgress`'s
   * active-runner count, cached once per frame, so the result stays a
   * deterministic function of the count.
   */
  function catchupFactor(self: RacerState): number {
    const gapLaps = (internal.meanProgress - self.progress) / config.trackLength;
    if (gapLaps > CATCHUP.deadZone) {
      return Math.min(
        CATCHUP.maxBoost,
        1 + (gapLaps - CATCHUP.deadZone) * CATCHUP.behindGain * internal.spreadBehind,
      );
    }
    if (gapLaps < -CATCHUP.deadZone) {
      return Math.max(CATCHUP.minBoost, 1 + (gapLaps + CATCHUP.deadZone) * CATCHUP.aheadDrag);
    }
    return 1;
  }

  /** Racers currently on track (relay `waiting`/`finished` excluded). */
  function activeRunnerCount(): number {
    let n = 0;
    for (const r of internal.racers) {
      if (r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
      n++;
    }
    return n;
  }

  /**
   * Field-size trailer-tailwind fade (see CATCHUP.spread). Pure function of the
   * active-runner count: at/below the knee it is 1 (small-field feel preserved);
   * above it the tailwind fades toward `behindMin` so a crowd strings out.
   */
  function spreadBehindFor(active: number): number {
    const s = CATCHUP.spread;
    const over = Math.max(0, active - s.kneeAt);
    return Math.max(s.behindMin, 1 - over * s.behindFade);
  }

  /** Mean progress over racers currently on track (catch-up reference point). */
  function activeMeanProgress(): number {
    let sum = 0;
    let n = 0;
    for (const r of internal.racers) {
      if (r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
      sum += r.progress;
      n++;
    }
    return n > 0 ? sum / n : 0;
  }

  /**
   * Forward personal-zone clamp (정면 통과 불가): after every racer has advanced, no racer may
   * end the frame having passed THROUGH another on the same lane band that it STARTED the frame
   * behind — it is pulled back to sit at most `ZONE.minGap` behind that rival (and never shoved
   * back past where it began the frame, so a fully-boxed racer just halts rather than reversing).
   * Overtaking therefore requires going around (a different lane, paying the distLoss), never
   * clipping straight through. `prev` is the pre-advance progress snapshot. Iterates the stable
   * racer array; pure position math, no RNG → deterministic.
   */
  function resolveForwardZones(prev: Map<RacerId, number>): void {
    for (const self of internal.racers) {
      if (
        self.phase === 'finished' ||
        self.phase === 'waiting' ||
        self.phase === 'eliminated' ||
        self.phase === 'stunned'
      ) {
        continue;
      }
      const selfPrev = prev.get(self.id)!;
      let cap = Infinity;
      for (const other of internal.racers) {
        if (other.id === self.id) continue;
        if (other.phase === 'finished' || other.phase === 'waiting' || other.phase === 'eliminated') continue;
        // Only rivals self was genuinely BEHIND at frame start are "blockers" it must not pass
        // through (so the straight start line, where everyone is level, produces no clamp).
        if (prev.get(other.id)! <= selfPrev) continue;
        // Same lane band only — a racer on a different lane is going around (the legal pass).
        if (Math.abs(other.lane - self.lane) > OVERTAKE.laneNear) continue;
        const c = other.progress - ZONE.minGap;
        if (c < cap) cap = c;
      }
      if (cap < selfPrev) cap = selfPrev; // halt short, never reverse past the frame start
      if (self.progress > cap) self.progress = cap;
    }
  }

  // ─── CHARACTER PASSIVES ──────────────────────────────────────────────────────────────────
  // Per-character always-on effects (distinct from cooldown skills). They hook in at different
  // points by nature, so they can't share one call site — this index keeps them findable:
  //   🐻 bear  — applyBearShove()              : whole-field, after progress resolves (lane push)
  //   🐶 dog   — fresh-stun loop (DOG_STUN_RECOVER) : in the per-frame stun-recovery pass
  //   🐧 penguin / 🐱 cat — applyCharacterSpeedPassives() : per-racer speed, inside advance()
  //   🐵 monkey — monkeyRemapItem()            : remaps a rolled item kind in applyItemPickup
  //   🦔 hedgehog — tryHedgehogEvade() (rangedEvade) : whiffs an incoming ranged hit
  //                                                    (banana / web / shell)
  //   🦊 fox (headStartMs) — startHoldUntil hold in advance()/fireSkill : launches first at the gun
  //   👽 alien (aoeImmune) / 🕷️ spider (outerGrip) : data traits read at their single point
  //                                                  (roar handler / laneDistanceFactor)
  // Determinism: most take no RNG; the rolls that exist (monkey item remap, hedgehog evade) are
  // each on a stable-label SUB-stream so they never shift the main draw order, and the hedgehog
  // evade is memoised per (target, frame) so attacker order can't change it.

  /**
   * Bear passive "몸통 밀치기" (body shove). Every frame, each bear in CONTACT with a rival
   * just ahead on its lane band — same window the personal-zone clamp uses (forward gap within
   * ZONE.minGap, lateral within OVERTAKE.laneNear) — nudges that rival OUTWARD by BEAR_SHOVE
   * .lanePush (clamped), while keeping its own pace. Unlike the (nearly-dead) block-decel, this
   * fires on contact rather than only when fully boxed in, so it pays off in a brawl pack.
   * Pure position math, no RNG → deterministic. Runs after progress is final for the frame.
   */
   function applyBearShove(): void {
     for (const bear of internal.racers) {
       if (bear.characterId !== 'bear') continue;
       if (bear.phase === 'finished' || bear.phase === 'waiting' || bear.phase === 'eliminated') continue;
       // 팀전에서는 몸통 밀치기 비활성화 (밸런스)
       if (bear.teamId !== undefined) continue;
       for (const other of internal.racers) {
         if (other.id === bear.id) continue;
         if (other.phase === 'finished' || other.phase === 'waiting' || other.phase === 'eliminated') continue;
         const gap = other.progress - bear.progress;
         const bearReach = ZONE.minGap * 2; // 곰만 2 배 더 넓은 접촉 범위 (24 유닛)
         if (gap < 0 || gap > bearReach) continue; // only a rival in front-contact (relaxed for bear)
         if (Math.abs(other.lane - bear.lane) > OVERTAKE.laneNear * 1.5) continue; // 레인 범위도 1.5 배 완화
         // Shove outward (toward lane 1), clamped to the racing band the overtake model uses.
         other.lane = Math.min(0.95, other.lane + BEAR_SHOVE.lanePush);
       }
     }
   }

  /**
   * True once `self` has passed the LAST curve of its final lap and is on the bottom-straight
   * finishing run toward the goal (the "home stretch"). The finish run is the segment from the
   * final start-line crossing to the offset finish — entirely within the bottom straight (since
   * FINISH_OFFSET_FRAC < SECTION.bottomStraightEnd). Non-relay: starts at laps×trackLength. Relay:
   * only the anchor leg has a finishing run, starting at its leg's lap line (1×trackLength). Pure.
   */
  function inFinalHomeStretch(self: RacerState): boolean {
    // Death-match has no finish line (race ends by elimination, racers lap indefinitely), so
    // there is no "final home stretch" — the spurt would otherwise fire every lap past `laps`.
    if (config.elimination) return false;
    if (config.relay) {
      if ((self.leg ?? 0) < config.laps - 1) return false; // only the anchor runs the finish line
      return self.progress >= config.trackLength;
    }
    return self.progress >= config.laps * config.trackLength;
  }

  /**
   * Per-racer character speed passives, applied right after the base/section speed is set in
   * advance() (before catch-up). Pure functions of section + progress + a per-racer frame latch
   * in the skill bag — no RNG, no extra draws → deterministic. Speed only (lane untouched).
   *   🐧 penguin — 막판 스퍼트: on the final home-stretch straight, raise the straight pace to
   *       PENGUIN_SPURT.sprintCornering ("sprint 6") by adding the delta over its normal bias.
   *   🐱 cat — 코너 탈출 가속: on a curve→straight transition, latch a short window during which
   *       speed gets a × (1 + CAT_CORNER_EXIT.boost) kick (the cat darts out of the bend).
   */
  function applyCharacterSpeedPassives(self: RacerState, onCurve: boolean, jitter: number, condition: number): void {
    if (self.characterId === 'penguin' && !onCurve && inFinalHomeStretch(self)) {
      const bonus = sectionSpeedBias(PENGUIN_SPURT.sprintCornering, false) - sectionSpeedBias(self.cornering, false);
      self.speed += bonus * jitter * condition;
    }

    if (self.characterId === 'cat') {
      // Latch the corner-exit window on the curve→straight transition (prev curve, now straight).
      const wasOnCurve = self.skill.prevOnCurve === true;
      self.skill.prevOnCurve = onCurve;
      if (wasOnCurve && !onCurve) self.skill.cornerExitUntil = frame + CAT_CORNER_EXIT.windowFrames;
      if (Number(self.skill.cornerExitUntil ?? 0) > frame) self.speed *= 1 + CAT_CORNER_EXIT.boost;
    }

    // 🦊 구미호 본능: 선두와 거리 멀수록 속도 증가 (catchupBoost 트레이트).
    if (self.catchupBoost) {
      const leader = internal.racers.reduce((best, r) =>
        r.phase === 'running' && r.id !== self.id && r.progress > best.progress ? r : best,
        { progress: self.progress } as RacerState
      );
      const gap = Math.max(0, leader.progress - self.progress);
      const ratio = Math.min(gap / (config.trackLength * 0.5), 1);
      self.speed *= 1 + ratio * self.catchupBoost;
    }
  }

  // 🎁 Lane of the nearest reachable item box ahead of `self` (lap-aware), or undefined if none
  // in reach — fed to applyOvertake so the racer leans toward it (적극 획득). Pure: box positions
  // are deterministic (boxRng), no RNG drawn here.
  function nearestBoxLane(self: RacerState): number | undefined {
    let lane: number | undefined;
    let bestGap = Infinity;
    const lapPos = self.progress % config.trackLength;
    for (const box of internal.boxes) {
      if (frame > box.expire) continue;
      let gap = box.progress - lapPos;
      if (gap < 0) gap += config.trackLength; // wrap to the next-ahead box on this lap
      if (gap > ITEM.seekReach) continue;
      if (Math.abs(box.lane - self.lane) > ITEM.seekLaneReach) continue;
      if (gap < bestGap) {
        bestGap = gap;
        lane = box.lane;
      }
    }
    return lane;
  }

  function advance(self: RacerState, events: SkillEvent[]): void {
    if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'eliminated') return;
    if (self.phase === 'stunned') {
      self.speed = 0;
      return;
    }
    // 빠른 출발 (head start): hold this racer on the line until its head-start delay lapses, so the
    // fox (largest head start → 0 hold) launches first. Frozen at progress 0, no forward movement.
    if (frame < self.startHoldUntil) {
      self.speed = 0;
      return;
    }

    // Track section (straight vs curve) at the racer's current lap position. Drives the
    // cornering speed split AND the curve-only inside advantage below.
    const onCurve = isCurve(lapPhase(self.progress, config.trackLength));
    // Per-lap "condition" (form): on each new lap, roll a fresh 1..steps from the racer's own
    // seeded stream and scale this lap's cruise speed by it (centred, so it nets out → fair).
    const lapIdx = Math.floor(self.progress / config.trackLength);
    if (lapIdx !== Number(self.skill.conditionLap ?? -1)) {
      self.skill.conditionLap = lapIdx;
      const roll = 1 + internal.conditionRng.get(self.id)!.int(CONDITION.steps); // 1..steps
      self.skill.condition = 1 + (roll - CONDITION.mid) * CONDITION.gain;
    }
    const condition = Number(self.skill.condition ?? 1);
    const jitter = 1 + internal.racerRng.get(self.id)!.range(-SPEED_JITTER, SPEED_JITTER);
    // 출발 직선 라인 유지: on the opening straight of lap 0 the field holds formation (see applyOvertake
    // below). To keep that staggered launch FAIR, the per-character cornering speed split is neutralised
    // during it — otherwise a straight-sprinter (dog) pulls away in the parade and starves the curve
    // specialists (hedgehog/spider/cat) below the fairness floor. baseSpeed/jitter/condition (all random,
    // not character-systematic) remain. Cornering identity resumes at the first curve. Pure (progress).
    // leg 0 only: relay handoff runners also start at progress=0 but should race freely.
    const inStartStraight = (self.leg ?? 0) === 0 && self.progress < FINISH_OFFSET_FRAC * config.trackLength;
    const corneringBias = inStartStraight ? 0 : sectionSpeedBias(self.cornering, onCurve);
    self.speed = (self.baseSpeed + corneringBias) * jitter * condition + (self.skill.burst ?? 0);

    // Per-racer character speed passives (penguin spurt, cat corner-exit) — see CHARACTER PASSIVES.
    applyCharacterSpeedPassives(self, onCurve, jitter, condition);

    self.speed *= catchupFactor(self);

    const laneHold = inStartStraight || ((self.skill['laneHoldUntil'] as number | undefined ?? 0) > frame);
     applyOvertake(self, internal.racers, internal.racerRng.get(self.id)!, frame, nearestBoxLane(self), laneHold);

     applyIce(self, events);
    // slowMul (bristle / lightning / fart).
    if ((self.skill.slowUntil ?? 0) > frame) {
      self.speed *= Number(self.skill.slowMul ?? 1);
    }

    // Lane → distance, CURVE-ONLY: the outer rail is a longer arc only through the bends, so
    // the distance penalty applies on curves and the straights are lane-neutral (passing out
    // wide there is free — a natural overtaking zone). `progress` accumulates the speed scaled
    // by this factor, staying a *corrected* distance metric (real path travelled) that ranking /
    // finish / death-match read directly and fairly across lanes.
    self.progress += self.speed * laneDistanceFactor(self.lane, onCurve, self.outerGrip);

    // Death-match: nobody "finishes" by crossing a goal line — the race ends only
    // by elimination (handled in applyEliminations / isRaceFinished). Racers keep
    // lapping until knocked out or left the lone survivor.
    if (config.elimination) return;

    // Anchor runs the extended finish; every other leg hands off at the lap line.
    const effectiveGoal =
      config.relay && (self.leg ?? 0) >= config.laps - 1 ? relayAnchorGoal : goal;
    if (self.progress < effectiveGoal) return;

    if (config.relay) {
      relayLegComplete(self, events);
    } else if (self.finishedAt === undefined) {
      self.finishedAt = frame;
      self.rank = ++internal.finishedCount;
      self.phase = 'finished';
      self.speed = 0;
    }
  }

  /**
   * Relay leg completion (spec §5, cyclic model): the runner crossing the line
   * has just completed the team's current leg. Legs per team = config.laps; leg
   * i is run by members[i % size]. On the anchor leg (laps-1) the team finishes
   * (the finisher is ranked by arrival). Otherwise the next leg's runner starts
   * at the line and a 'handoff' event is emitted (targetId = next runner, which
   * may be the same racer when the cycle wraps back to it). Pure rule, no RNG.
   */
  function relayLegComplete(finisher: RacerState, events: SkillEvent[]): void {
    const team = finisher.teamId ?? finisher.id;
    const queue = internal.legQueues.get(team);
    if (!queue) return;
    const size = queue.length;
    const leg = finisher.leg ?? 0;

    // Anchor leg done → team finishes. The finisher is the anchor here.
    if (leg >= config.laps - 1) {
      finisher.finishedAt = frame;
      finisher.rank = ++internal.finishedCount;
      finisher.phase = 'finished';
      finisher.speed = 0;
      internal.teamsFinished++;
      return;
    }

    const nextLeg = leg + 1;
    internal.teamLeg.set(team, nextLeg);
    const nextId = queue[nextLeg % size];
    const next = internal.racers.find((r) => r.id === nextId)!;

    if (nextId === finisher.id) {
      // Cycle wrapped straight back to this racer (e.g. one-member team): it
      // keeps running the next leg from the line — no waiting hop.
      finisher.progress = 0;
      finisher.speed = 0;
      finisher.skill.burst = 0;
      finisher.skill.effectUntil = undefined;
      finisher.leg = nextLeg;
      finisher.phase = 'running';
    } else {
      // Park the finisher: it returns to waiting, parked at its *next* own leg
      // (currentLeg + size) for the renderer queue. If it has no further leg it
      // stays waiting permanently (inert, never reactivated).
      finisher.progress = 0;
      finisher.speed = 0;
      finisher.skill.burst = 0;
      finisher.skill.effectUntil = undefined;
      const ownNext = leg + size;
      finisher.leg = ownNext < config.laps ? ownNext : finisher.leg;
      finisher.phase = 'waiting';
      // Hand the baton to the next runner waiting at the line.
      next.phase = 'running';
      next.progress = 0;
      next.speed = 0;
      next.leg = nextLeg;
      // 0.5-second skill lockout after receiving baton.
      next.skillCooldownUntil = Math.max(next.skillCooldownUntil, frame + Math.round(0.5 * 60));
      // 0.2-second lane-hold after baton (no immediate lane drift).
      next.skill['laneHoldUntil'] = frame + Math.round(0.2 * 60);
    }
    events.push({ frame, racerId: finisher.id, type: 'relay', variant: 'handoff', targetId: nextId });
  }

  /**
   * Death-match elimination at lap boundaries. A lap boundary is the moment the
   * leader (max-progress active racer) completes a new full lap — i.e. some active
   * racer's progress has reached `elimLapTarget × trackLength`. On each boundary,
   * one active racer is knocked out:
   *   - 'first': current 1st (max progress) — leading too hard gets you out;
   *   - 'last' : current last (min progress) — trailing gets you out.
   * Ties broken by the stable per-racer procKey (deterministic, draw-order
   * independent, no RNG). Eliminations stop once a lone survivor remains. The
   * leader may have lapped several boundaries in one frame (rare): the while-loop
   * fires one knock-out per crossed boundary, still exactly one per lap.
   *
   * Pure: depends only on progress + the fixed procKey, so the same (config, seed)
   * yields the identical elimination order/ranks.
   */
  function applyEliminations(events: SkillEvent[]): void {
    if (!config.elimination) return;
    const isActive = (r: RacerState) =>
      r.phase !== 'finished' && r.phase !== 'waiting' && r.phase !== 'eliminated';

    while (true) {
      const active = internal.racers.filter(isActive);
      if (active.length <= 1) return; // lone survivor (or none) — nothing to do
      // Boundary reached when the front-runner has crossed elimLapTarget laps.
      const leadProgress = Math.max(...active.map((r) => r.progress));
      if (leadProgress < internal.elimLapTarget * config.trackLength) return;

      // Pick the eliminee: extreme progress for the mode, procKey tie-break.
      let victim = active[0];
      for (const r of active) {
        if (r === victim) continue;
        const better =
          config.elimination === 'first'
            ? r.progress > victim.progress ||
              (r.progress === victim.progress &&
                internal.procKey.get(r.id)! < internal.procKey.get(victim.id)!)
            : r.progress < victim.progress ||
              (r.progress === victim.progress &&
                internal.procKey.get(r.id)! < internal.procKey.get(victim.id)!);
        if (better) victim = r;
      }

      victim.phase = 'eliminated';
      victim.speed = 0;
      victim.skill.burst = 0;
      victim.skill.effectUntil = undefined;
      victim.eliminatedAt = frame;
      victim.eliminationOrder = ++internal.elimCount;
      events.push({ frame, racerId: victim.id, type: 'eliminate', variant: 'out' });

      internal.elimLapTarget++;
    }
  }

  /**
   * Gumiho illusionClone decoy update (runs once per frame, AFTER advance so the
   * owner's progress is final). Pure + deterministic (no RNG here — offsets were
   * drawn at spawn time):
   *   1. Re-anchor each live decoy to its owner (decoys move in lock-step, holding
   *      their spawn-time offset). A finished/eliminated/waiting owner kills its
   *      decoys instantly.
   *   2. Collision stun: a live decoy within (progress + lane) proximity of a
   *      non-owner active racer stuns that racer for `collisionStun` ("어?"), then
   *      the decoy pops. star / skill i-frames are respected (no stun, no pop).
   *      Decoys are scanned in list (spawn) order; victims in stable procKey order.
   *   3. Expiry: at `expireFrame`, if the LEAD decoy is still alive AND ahead of the
   *      owner, the owner teleports up to it (a gentle forward hop, "스르르…퐁!").
   *      Then every one of that owner's decoys despawns.
   * Dead/expired decoys are pruned at the end.
   */
  function updateDecoys(events: SkillEvent[]): void {
    if (internal.decoys.length === 0) return;

    for (const d of internal.decoys) {
      if (!d.alive) continue;
      const owner = internal.racers.find((r) => r.id === d.ownerId);
      // Owner gone / parked / out → decoys vanish (no teleport from a dead owner).
      if (
        !owner ||
        owner.phase === 'finished' ||
        owner.phase === 'waiting' ||
        owner.phase === 'eliminated'
      ) {
        d.alive = false;
        continue;
      }
      // Forward progress. While the owner runs normally the decoy re-anchors to the
      // owner (owner.progress + spawn offset), keeping the formation tight. But a
      // STUNNED owner is frozen — the decoy must keep running on its OWN, so it instead
      // advances by the owner's cruise speed (baseSpeed). The front decoy thus pulls
      // further ahead during the stun; the expiry teleport (to the lead decoy) then lets
      // the body catch up — an intended stun-escape synergy. The decoy NEVER moves
      // backward: re-anchoring is clamped to its current progress, so a decoy that
      // pulled ahead during a stun keeps that lead after the owner recovers (no snap
      // back) until the owner's own advance catches the formation up to it.
      // Deterministic: baseSpeed is fixed per racer, no RNG.
      const anchored = owner.phase === 'stunned' ? d.progress + owner.baseSpeed : owner.progress + d.offset;
      d.progress = Math.max(d.progress, anchored, 0);
      // Lane always tracks the owner's lane (+ fixed offset), even during a stun.
      d.lane = Math.max(0, Math.min(1, owner.lane + d.laneOffset));
    }

    // Collision stun: each live decoy bumps EXACTLY ONE racer — the single nearest
    // qualifying rival (NOT an AoE / multi-target pulse). The decoy is consumed on
    // that one bump. "Nearest" = smallest progress gap; procKey tie-break (stable,
    // draw-order independent, no RNG) so the pick is deterministic.
    const stunFrames = (ms: number) => Math.round(ms / DT_MS);
    for (const d of internal.decoys) {
      if (!d.alive) continue;
      const owner = internal.racers.find((r) => r.id === d.ownerId);
      if (!owner) continue;
      const collisionMs = Number(config.characters[owner.characterId]?.skill.params.collisionStun ?? 500);
      let victim: RacerState | undefined;
      let victimGap = Infinity;
      for (const v of internal.racers) {
        if (v.id === d.ownerId) continue;
        if (
          v.phase === 'finished' ||
          v.phase === 'waiting' ||
          v.phase === 'stunned' ||
          v.phase === 'eliminated'
        )
          continue;
        const gap = Math.abs(v.progress - d.progress);
        if (gap > DECOY.collideDist) continue;
        if (Math.abs(v.lane - d.lane) > DECOY.collideLane) continue;
        // Respect invulnerability (consistent with every other disruption source).
        if ((v.skill.starUntil ?? 0) > frame) continue;
        if ((v.skill.skillInvulnUntil ?? 0) > frame) continue;
        // Anti-accumulation: a recently-bumped racer is briefly immune to further
        // decoy bumps (mirrors banana's anti-stack) so a gumiho's clones can't
        // chain-stun the same victims lap after lap and over-rebunch the field.
        if (frame < Number(v.skill.decoyImmuneUntil ?? 0)) continue;
        // Keep the nearest qualifying rival (procKey tie-break for determinism).
        if (
          gap < victimGap ||
          (gap === victimGap && victim && internal.procKey.get(v.id)! < internal.procKey.get(victim.id)!)
        ) {
          victim = v;
          victimGap = gap;
        }
      }
      if (victim) {
        // Bump! Stun the single nearest victim and consume this decoy (one bump).
        victim.phase = 'stunned';
        victim.speed = 0;
        victim.skill.burst = 0;
        victim.skill.effectUntil = frame + stunFrames(collisionMs);
        victim.skill.decoyImmuneUntil = frame + stunFrames(collisionMs) + stunFrames(DECOY.rebumpImmuneMs);
        events.push({ frame, racerId: victim.id, type: 'illusionClone', variant: 'clonehit', line: '어?' });
        d.alive = false; // decoy spent — it can't bump a second racer
      }
    }

    // Expiry → teleport: when an owner's decoys reach expireFrame, the owner hops up
    // to its LEAD decoy if that decoy is still alive and ahead. Group by owner so the
    // teleport happens once per owner set.
    const expiringOwners = new Set<RacerId>();
    for (const d of internal.decoys) {
      if (frame >= d.expireFrame) expiringOwners.add(d.ownerId);
    }
    for (const ownerId of expiringOwners) {
      const owner = internal.racers.find((r) => r.id === ownerId);
      const lead = internal.decoys.find(
        (d) => d.ownerId === ownerId && d.lead && d.alive && frame >= d.expireFrame,
      );
      if (
        owner &&
        lead &&
        owner.phase !== 'finished' &&
        owner.phase !== 'waiting' &&
        owner.phase !== 'eliminated' &&
        lead.progress > owner.progress
      ) {
        // Hop all the way to the lead decoy's position. With inline 1-body-length
        // spacing the lead sits ≈1 body-length ahead, so the body advances by that
        // gap (≈57u ≈ 7 마디) — the confirmed "lead-decoy teleport" forward jump.
        owner.progress = lead.progress;
        events.push({ frame, racerId: owner.id, type: 'illusionClone', variant: 'teleport', line: '스르르…퐁!' });
      }
      // Despawn the whole expiring set for this owner.
      for (const d of internal.decoys) if (d.ownerId === ownerId && frame >= d.expireFrame) d.alive = false;
    }

    // Prune dead / despawned decoys.
    internal.decoys = internal.decoys.filter((d) => d.alive);
  }

  /** True if `lapPos` (0..trackLength) lies inside the zone, accounting for wrap. */
  function inZone(lapPos: number, zone: IceZone): boolean {
    const len = config.trackLength;
    const end = zone.startProgress + zone.length;
    if (end <= len) return lapPos >= zone.startProgress && lapPos < end;
    // Wrapped zone: [start, len) ∪ [0, end - len).
    return lapPos >= zone.startProgress || lapPos < end - len;
  }

  /**
   * Penguin icefield (environmental, species-based, team-agnostic). A racer whose
   * lap-position is inside any active zone has its speed scaled: penguins glide
   * faster (boostFactor), every other species slips slower (slowFactor). The cat
   * is nimble: each frame it can *jump over* the ice with probability equal to its
   * catwalk `dodgeChance` (deterministic per (cat, frame) via its own sub-stream),
   * dodging the slow that frame. Stacks multiplicatively if (rarely) inside
   * several zones; deterministic.
   */
   function applyIce(self: RacerState, events: SkillEvent[]): void {
     if (internal.iceZones.length === 0) { self.skill.iceJumping = false; return; }
     const lapPos = self.progress % config.trackLength;
     
     // Find all zones the racer is currently in
     const activeZones = internal.iceZones.filter((z) => frame < z.expire && inZone(lapPos, z));
     if (activeZones.length === 0) { 
       self.skill.iceJumping = false; 
       self.skill.iceZoneId = undefined; 
       return; 
     }
     
     if ((self.skill.starUntil ?? 0) > frame) return; // ⭐ star: immune to ice
     // Airborne racers (e.g. the alien's UFO) float over the ice — no contact, so
     // neither the penguin boost nor the runner slow applies. Trait-driven, not
     // id-hardcoded.
     if (config.characters[self.characterId]?.airborne) return;

     // 🐧 펭귄: 얼음판 위에서는 스턴 무효 (스턴 중에도 얼음판 위면 정상 이동)
     if (self.characterId === 'penguin' && self.phase === 'stunned') {
       self.phase = 'running';
       self.speed = self.baseSpeed * activeZones[0].boostFactor;
       return;
     }

     if (self.characterId === 'cat') {
       // Decide ONCE per zone entry: jump clear over the ice (no slow) with the cat's
       // dodgeChance. `iceJumping` is exposed for the renderer to play the hop.
       const zone = activeZones[0];
       if (self.skill.iceZoneId !== zone.id) {
         self.skill.iceZoneId = zone.id;
         self.skill.iceJumping = internal.skillRng
           .get(self.id)!
           .fork(`icejump:${zone.id}`)
           .bool(Number(config.characters.cat.skill.params.dodgeChance ?? 0));
       }
       if (self.skill.iceJumping) return; // jumped clear — no slow
       // Cat on ice: apply slow factor (capped at 0.50)
       self.speed *= Math.max(0.50, activeZones[0].slowFactor);
       return;
     }
     
      // 🐧 펭귄 얼음판: 감속/부스트 누적 방지 (최대 50% 감속, 18% 부스트)
      // 펭귄 본인만 부스트, 나머지는 감속 (팀메이트도 영향 없음 = 1.0)
      const isPenguin = self.characterId === 'penguin';
      const owner = internal.racers.find(r => r.id === activeZones[0].ownerId);
      const isTeammate = owner?.teamId !== undefined && owner.teamId === self.teamId;
      const isPenguinOrTeammate = isPenguin || isTeammate;
      
      // 팀메이트는 얼음판 영향 없음 (1.0), 펭귄은 부스트, 나머지는 감속
      if (isTeammate && !isPenguin) {
        // 팀메이트: 영향 없음
        return;
      }
      
      let finalFactor = isPenguin ? 1.18 : 0.50;
      
      // If multiple zones, take the minimum (most severe) factor, but cap at limits
      for (const zone of activeZones) {
        const zoneFactor = isPenguin ? zone.boostFactor : zone.slowFactor;
        if (isPenguin) {
          finalFactor = Math.max(finalFactor, zoneFactor);  // max boost
        } else {
          finalFactor = Math.min(finalFactor, zoneFactor);  // min (most severe) slow
        }
      }
      
      // Cap at limits: max 50% slow (0.50), max 18% boost (1.18)
      if (!isPenguin) {
        finalFactor = Math.max(0.50, finalFactor);
      } else {
        finalFactor = Math.min(1.18, finalFactor);
      }
      
      self.speed *= finalFactor;
   }

  /**
   * 🐵 원숭이 잔머리 (see CHARACTER PASSIVES): remap a rolled item kind to a smarter one for a
   * monkey, given whether it is currently the leader. Pure (the only randomness is the passed-in
   * `rng`, a stable-label sub-stream so it never shifts the main item draw order):
   *   - shell while leading → fart   (the shell would stun the monkey itself)
   *   - fart while NOT leading → shell (a chasing fart hits no one useful; snipe the leader)
   *   - lightning → star with `lightningToStarChance` (gated: star is the strongest item)
   *   - otherwise unchanged.
   */
  function monkeyRemapItem(kind: ItemKind, isLeader: boolean, rng: Rng): ItemKind {
    if (kind === 'shell' && isLeader) return 'fart';
    if (kind === 'fart' && !isLeader) return 'shell';
    if (kind === 'lightning' && rng.bool(MONKEY_ITEM.lightningToStarChance)) return 'star';
    return kind;
  }

  /** A gamble box, on pickup, rolls one of four effects (weighted). */
  function applyItemPickup(self: RacerState, order: RacerState[], events: SkillEvent[]): void {
    const irng = internal.itemRng.get(self.id)!;
    const active = (r: RacerState) =>
      r.phase !== 'finished' && r.phase !== 'waiting' && r.phase !== 'stunned' && r.phase !== 'eliminated';
    // Immune to this item's disruption: ⭐ star OR brief skill-activation i-frames.
    const immune = (r: RacerState) => (r.skill.starUntil ?? 0) > frame || isSkillInvuln(r);

    // Current leader = active racer with max progress (shared by the shell effect + monkey remap).
    let leader: RacerState | undefined;
    for (const r of order) if (active(r) && (!leader || r.progress > leader.progress)) leader = r;

    const x = irng.range(0, 8); // weights: star 1 / lightning 2 / shell 2 / fart 3
    let kind: ItemKind = x < 1 ? 'star' : x < 3 ? 'lightning' : x < 5 ? 'shell' : 'fart';
    // 🐵 Monkey remap: situational re-pick. The roll is on a SUB-stream forked off this racer's
    // itemRng so the main `x` draw order (and thus everyone else's items) is untouched. The fork
    // seed derives from the rng's BASE seed (not its live state), so the label must carry a
    // per-pickup discriminator or every pickup would roll identically — a monotonic per-racer
    // pickup counter gives each pickup its own deterministic sub-stream. Determinism holds.
    if (self.characterId === 'monkey') {
      const pick = Number(self.skill.monkeyItemPicks ?? 0);
      self.skill.monkeyItemPicks = pick + 1;
      kind = monkeyRemapItem(kind, leader?.id === self.id, irng.fork(`monkeyitem:${pick}`));
    }

    if (kind === 'star') {
      // 🌟 star: self speed boost + full immunity for a while.
      const until = frame + Math.round(ITEM.starMs / DT_MS);
      self.skill.burst = ITEM.starBoost;
      self.skill.effectUntil = until;
      self.skill.starUntil = until;
      self.phase = 'straying';
      events.push({ frame, racerId: self.id, type: 'item', variant: 'star', line: '무적! ⭐' });
    } else if (kind === 'lightning') {
      // ⚡ lightning: every other racer slows briefly.
      const until = frame + Math.round(ITEM.lightningSlowMs / DT_MS);
      for (const r of order) {
        if (r.id === self.id || !active(r) || immune(r)) continue;
        r.skill.slowUntil = until;
        r.skill.slowMul = ITEM.lightningMul;
      }
      events.push({ frame, racerId: self.id, type: 'item', variant: 'lightning', line: '⚡ 번개!' });
    } else if (kind === 'shell') {
      // 🐢 shell: stuns the current leader — even if the picker IS the leader.
      events.push({ frame, racerId: self.id, type: 'item', variant: 'shell', line: '🐢 등껍질!' });
      if (leader && !immune(leader)) {
        // 🦔 작은 표적: a hedgehog leader can duck the shell (ranged) — whiff, no stun.
        if (tryHedgehogEvade(leader)) {
          events.push({ frame, racerId: self.id, type: 'item', variant: 'dodge', targetId: leader.id });
        } else {
          leader.phase = 'stunned';
          leader.speed = 0;
          leader.skill.burst = 0;
          leader.skill.effectUntil = frame + Math.round(ITEM.shellStunMs / DT_MS);
          events.push({ frame, racerId: self.id, type: 'item', variant: 'shellhit', targetId: leader.id });
        }
      }
    } else {
      // 💨 fart: racers behind the picker (within range) slow briefly.
      const until = frame + Math.round(ITEM.fartSlowMs / DT_MS);
      for (const r of order) {
        if (r.id === self.id || !active(r) || immune(r)) continue;
        if (r.progress >= self.progress || self.progress - r.progress > ITEM.fartRange) continue;
        r.skill.slowUntil = until;
        r.skill.slowMul = ITEM.fartMul;
      }
      events.push({ frame, racerId: self.id, type: 'item', variant: 'fart', line: '뿌웅~ 💨' });
    }
  }

  function updateBoxes(order: RacerState[], events: SkillEvent[]): void {
    // Drop expired boxes.
    internal.boxes = internal.boxes.filter((b) => frame <= b.expire);

    // Collect boxes by proximity.
    const collected = new Set<string>();
    for (const self of order) {
      if (
        self.phase === 'finished' ||
        self.phase === 'waiting' ||
        self.phase === 'stunned' ||
        self.phase === 'eliminated'
      )
        continue;
      const lapProgress = self.progress % config.trackLength;
      for (const box of internal.boxes) {
        if (collected.has(box.id)) continue;
        if (Math.abs(lapProgress - box.progress) > ITEM.collectDist) continue;
        if (Math.abs(self.lane - box.lane) > ITEM.collectLane) continue;

        collected.add(box.id);
        applyItemPickup(self, order, events);
      }
    }
    if (collected.size) internal.boxes = internal.boxes.filter((b) => !collected.has(b.id));

    // Spawn a new box at a random time + position (never collected at the line).
    if (frame >= internal.nextBoxFrame) {
      if (internal.boxes.length < ITEM.maxBoxes) {
        internal.boxes.push({
          id: `box${internal.boxCounter++}`,
          progress: internal.boxRng.range(0.12, 0.95) * config.trackLength,
          lane: internal.boxRng.range(0.12, 0.88),
          expire: frame + Math.round(internal.boxRng.range(...ITEM.lifeMs) / DT_MS),
        });
      }
      internal.nextBoxFrame = frame + Math.round(internal.boxRng.range(...ITEM.spawnGapMs) / DT_MS);
    }
  }

  function boxStates(): { id: string; progress: number; lane: number; active: boolean }[] {
    return internal.boxes.map((b) => ({ id: b.id, progress: b.progress, lane: b.lane, active: true }));
  }

  function iceStates() {
    return internal.iceZones
      .filter((z) => frame < z.expire)
      .map((z) => ({
        id: z.id,
        startProgress: z.startProgress,
        length: z.length,
        activeUntil: z.expire,
        ownerId: z.ownerId,
      }));
  }

  function snapshot(events: SkillEvent[]): EngineFrame {
    return {
      frame,
      time: frame * DT_MS,
      racers: internal.racers.map((r) => ({ ...r, skill: { ...r.skill } })),
      events,
      boxes: boxStates(),
      iceZones: iceStates(),
      // Immutable copy of live decoys (safe to retain for replay; renderer-facing).
      decoys: internal.decoys.filter((d) => d.alive).map((d) => ({ ...d })),
      finished: isRaceFinished(),
    };
  }

  // Relay finishes when every team's anchor (final) leg is done; non-relay when
  // every racer has crossed. Relay racers re-enter waiting, so a global racer
  // count would never settle — track team completions instead.
  function isRaceFinished(): boolean {
    if (config.elimination) {
      // Death-match ends when at most one racer is still active (the survivor).
      let active = 0;
      for (const r of internal.racers) {
        if (r.phase !== 'finished' && r.phase !== 'waiting' && r.phase !== 'eliminated') active++;
      }
      return active <= 1;
    }
    return config.relay
      ? internal.teamsFinished >= internal.legQueues.size
      : internal.finishedCount >= internal.racers.length;
  }

  function buildResult(): RaceResult {
    if (config.elimination) assignEliminationRanks();
    const order = [...internal.racers]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .map((r) => r.id);
    const finishFrame: Record<RacerId, number> = {};
    for (const r of internal.racers) finishFrame[r.id] = r.finishedAt ?? r.eliminatedAt ?? frame;
    const strategy = scoring.get(config.scoringId) ?? scoring.get('individual')!;
    return { order, finishFrame, scoring: strategy(order, config), seed: config.seed };
  }

  /**
   * Death-match rank assignment from elimination order (1 = first knocked out).
   * N = total racers; the lone survivor has no eliminationOrder.
   *   - 'first' (선두탈락): earlier-out ranks HIGHER → rank = eliminationOrder;
   *     survivor (last remaining) = rank N (worst).
   *   - 'last'  (꼴찌탈락): earlier-out ranks LOWER  → rank = N − eliminationOrder + 1;
   *     survivor = rank 1 (winner). i.e. exactly the reverse of elimination order.
   */
  function assignEliminationRanks(): void {
    const n = internal.racers.length;
    for (const r of internal.racers) {
      const k = r.eliminationOrder; // undefined for the survivor
      if (k === undefined) {
        r.rank = config.elimination === 'first' ? n : 1; // survivor
      } else {
        r.rank = config.elimination === 'first' ? k : n - k + 1;
      }
    }
  }

  const engine: RaceEngine = {
    config,
    get frameIndex() {
      return frame;
    },
    get finished() {
      return isRaceFinished();
    },
    step() {
      if (engine.finished) return snapshot([]);
      const events: SkillEvent[] = [];

      // Process leader-first so within-frame finish order resolves cleanly.
      const order = [...internal.racers].sort(
        (a, b) => b.progress - a.progress || internal.procKey.get(b.id)! - internal.procKey.get(a.id)!,
      );
      internal.iceZones = internal.iceZones.filter((z) => frame < z.expire);
      // Snapshot who is already stunned, so the post-frame pass can reset the cooldown
      // ONLY for racers freshly stunned this frame (any source: banana/roar/shell).
      const wasStunned = new Set(internal.racers.filter((r) => r.phase === 'stunned').map((r) => r.id));
      for (const self of order) resolveTimer(self);
      for (const self of order) fireSkill(self, events);
      internal.meanProgress = activeMeanProgress();
      // Field-size trailer-tailwind fade for this frame (front-to-back spread in
      // a crowd). Same active-runner count the cooldown knee uses; cached so
      // catchupFactor stays a pure per-frame function of the count.
      internal.spreadBehind = spreadBehindFor(activeRunnerCount());

      // Frame-boundary progress snapshot, taken AFTER self-activation skills (so
      // a shove this frame counts) but BEFORE advance, to detect real overtakes
      // (progress inversions) this advance produces.
      const prevProgress = new Map<RacerId, number>();
      for (const self of order) prevProgress.set(self.id, self.progress);
      for (const self of order) advance(self, events);
      resolveForwardZones(prevProgress);
      applyBearShove();
      fireOvertakeHooks(prevProgress, events);

      // Death-match: knock out one racer at each lap boundary the leader crosses.
      applyEliminations(events);

      // Gumiho illusionClone: move decoys with their owner, bump rivals (stun),
      // and run expiry teleport. After advance/elimination so progress is final.
      updateDecoys(events);

      updateBoxes(order, events);

      // 🐶 강아지 패시브: 스턴을 남들보다 빨리 떨치고 일어난다.
      // 스킬 쿨다운은 스턴 종료 시점까지만 밀림(새 롤 없음 — 기존 쿨타임 유지).
      for (const self of order) {
        if (self.phase !== 'stunned' || wasStunned.has(self.id)) continue;
        if (self.characterId === 'dog' && self.skill.effectUntil !== undefined) {
          const remaining = self.skill.effectUntil - frame;
          if (remaining > 0) self.skill.effectUntil = frame + Math.max(1, Math.round(remaining * DOG_STUN_RECOVER));
        }
        const stunEnd = self.skill.effectUntil ?? frame;
        self.skillCooldownUntil = Math.max(self.skillCooldownUntil, stunEnd);
      }

      const f = snapshot(events);
      frame++;
      if (engine.finished && !raceResult) raceResult = buildResult();
      return f;
    },
    current() {
      return snapshot([]);
    },
    result() {
      return raceResult;
    },
  };

  return engine;
}

/**
 * Field-size cooldown factor (see COOLDOWN_FIELD). Gentle multiplier on every skill
 * cooldown roll that grows with the number of racers actually on track, so a crowded
 * field fires skills less often. Pure function of a deterministic count.
 */
function fieldCooldownFactor(activeRunners: number): number {
  const over = Math.max(0, activeRunners - COOLDOWN_FIELD.kneeAt);
  return Math.min(COOLDOWN_FIELD.maxFactor, 1 + over * COOLDOWN_FIELD.perRacer);
}

/**
 * A safe upper bound on frames for a race to finish, derived from the course.
 *
 * Total finish distance is laps + FINISH_OFFSET_FRAC of a lap (relay: the anchor
 * runs the same offset past its last baton line, and legs are run in series, so
 * the team distance is still laps × trackLength + offset). We divide by a very
 * conservative *sustained* speed floor (well under the 1.3 cruise floor, to absorb
 * prolonged blocking / slows / catch-up dips) and add a multiplicative buffer.
 * This is only a runaway guard — real races finish far sooner.
 */
function autoMaxFrames(config: RaceConfig): number {
  const MIN_SUSTAINED_SPEED = 0.4; // units/frame, conservative worst case
  const BUFFER = 1.5;
  // Death-match ignores `laps`: the leader laps until N−1 racers are knocked out,
  // so the bounding distance is the (N−1)th lap boundary plus the finish offset.
  const laps = config.elimination
    ? Math.max(1, config.participants.length - 1)
    : config.laps;
  const distance = config.trackLength * (laps + FINISH_OFFSET_FRAC);
  return Math.ceil((distance / MIN_SUSTAINED_SPEED) * BUFFER);
}

/**
 * Run a whole race headless (tests, replay, golden screenshots). `maxFrames`
 * defaults to a course-scaled bound (autoMaxFrames) so any lap count finishes;
 * pass an explicit value to override (back-compat).
 */
export function simulateRace(
  config: RaceConfig,
  skills: SkillRegistry,
  scoring: ScoringRegistry,
  maxFrames = autoMaxFrames(config),
): { frames: EngineFrame[]; result: RaceResult } {
  const engine = createRaceEngine(config, skills, scoring);
  const frames: EngineFrame[] = [];
  while (!engine.finished && frames.length < maxFrames) {
    frames.push(engine.step());
  }
  const result = engine.result();
  if (!result) throw new Error('race did not finish within maxFrames');
  return { frames, result };
}
