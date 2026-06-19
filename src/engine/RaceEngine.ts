/**
 * Pure race simulation (spec §8, §10, §12). Fixed-timestep, fully deterministic
 * for a given (config, seed). The engine knows nothing about the renderer or the
 * track shape — only abstract progress + lane.
 */

import { createRng, type Rng } from './prng.ts';
import { applyOvertake } from './overtake.ts';
import {
  DT_MS,
  FINISH_OFFSET_FRAC,
  type EngineFrame,
  type RaceConfig,
  type RaceResult,
  type RacerId,
  type RacerState,
  type SkillEvent,
} from './types.ts';
import type { SkillRegistry } from './skills/types.ts';
import { resolveDodge } from './skills/dodge.ts';
import type { ScoringRegistry } from './scoring/types.ts';

const SPEED_JITTER = 0.08; // ±8% per-frame speed noise
const RETRY_COOLDOWN_MS = 200; // re-check a skill that declined to fire soon

/**
 * Catch-up / rubberbanding (anti-runaway). Deterministic, lane- and
 * character-agnostic: each frame a racer's speed is scaled purely by how far it
 * is from the field's mean progress. Trailers get a gentle tailwind, runaway
 * leaders a gentle drag — so the pack stays bunched and lead changes happen
 * without overriding skills (the band is small, a boosted leader still leads).
 * Gap is measured in laps (gap / trackLength) so it scales with track size.
 */
const CATCHUP = {
  /** Speed gain per lap of deficit behind the mean (trailers speed up). */
  behindGain: 2.6,
  /** Speed drag per lap of surplus ahead of the mean (leaders slow). */
  aheadDrag: 2.2,
  /** Clamp on the multiplier so nobody teleports or stalls. */
  maxBoost: 1.2,
  minBoost: 0.8,
  /** Dead-zone (laps) around the mean where no correction applies. */
  deadZone: 0.008,
} as const;

// Item boxes spawn at random times + positions during the race (never at the
// start), live briefly, and vanish when collected or after their lifetime.
const ITEM = {
  collectDist: 7, // progress units
  collectLane: 0.6, // wide: effectively lane-independent, so no lane is favoured
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
  /** Mean progress of active racers this frame (catch-up reference). */
  meanProgress: number;
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

  const internal: Internals = {
    racers: config.participants.map((p, i, arr) => {
      const r = rng.fork(`base:${p.id}`);
      const baseSpeed = r.range(1.3, 1.5); // engine units/frame; tight band keeps it fair
      // Personal cruising lane, spread across the track + a little jitter. The
      // spread is inside-weighted (exponent > 1) so more racers home toward the
      // inner lanes — purely a positional skew; lane never affects speed.
      const spread = arr.length > 1 ? 0.1 + Math.pow(i / (arr.length - 1), 1.6) * 0.8 : 0.5;
      const homeLane = Math.max(0.08, Math.min(0.92, spread + r.range(-0.05, 0.05)));
      // Relay: leg = this racer's current (or next-up) leg, 0-based. The member
      // running leg 0 starts active; everyone else (including future legs of the
      // same member) waits. Members that never run (size > laps) stay waiting.
      const leg = config.relay ? firstLegOf(p.id) : undefined;
      const phase: RacerState['phase'] = config.relay && leg !== 0 ? 'waiting' : 'running';
      return {
        id: p.id,
        characterId: p.characterId,
        teamId: p.teamId,
        progress: 0,
        lane: homeLane,
        homeLane,
        speed: 0,
        baseSpeed,
        leg,
        phase,
        facing: 0,
        skillCooldownUntil: Math.round(rng.range(...firstCooldown(config, p.characterId)) / DT_MS),
        skill: {},
      } satisfies RacerState;
    }),
    racerRng: new Map(),
    skillRng: new Map(),
    procKey: new Map(),
    itemRng: new Map(),
    boxRng: rng.fork('boxes'),
    boxes: [],
    nextBoxFrame: 0,
    boxCounter: 0,
    iceZones: [],
    iceCounter: 0,
    finishedCount: 0,
    legQueues,
    teamLeg: new Map([...legQueues.keys()].map((t) => [t, 0])),
    teamsFinished: 0,
    meanProgress: 0,
  };
  internal.nextBoxFrame = Math.round(internal.boxRng.range(...ITEM.firstSpawnMs) / DT_MS);

  for (const p of config.participants) {
    internal.racerRng.set(p.id, rng.fork(`racer:${p.id}`));
    internal.skillRng.set(p.id, rng.fork(`skill:${p.id}`));
    internal.itemRng.set(p.id, rng.fork(`item:${p.id}`));
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
    if (self.phase === 'finished' || self.phase === 'waiting') return;
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

  function tryActivateSkill(self: RacerState, events: SkillEvent[]): void {
    if (frame < self.skillCooldownUntil) return;
    if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'stunned') return;

    const character = config.characters[self.characterId];
    const handler = skills.get(character.skill.type);
    if (!handler) return;

    const before = events.length;
    handler({
      self,
      all: internal.racers,
      byId: (id) => internal.racers.find((r) => r.id === id),
      participants: participantsById,
      rng: internal.skillRng.get(self.id)!,
      frame,
      params: character.skill.params,
      lines: character.lines,
      skillTypeOf: (id) => {
        const cid = participantsById[id]?.characterId;
        return cid ? config.characters[cid]?.skill.type : undefined;
      },
      emit: (e) =>
        events.push({ frame, racerId: self.id, type: character.skill.type, ...e }),
      tryDodge: (target) => resolveDodge(target, frame, internal.skillRng.get(target.id)!),
      addIceZone: (z) => {
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
    });

    const activated = events.length > before;
    if (activated) {
      const [min, max] = character.skill.cooldownMs;
      self.skillCooldownUntil = frame + Math.round(internal.skillRng.get(self.id)!.range(min, max) / DT_MS);
    } else {
      self.skillCooldownUntil = frame + Math.round(RETRY_COOLDOWN_MS / DT_MS);
    }
  }

  /**
   * Anti-runaway multiplier (see CATCHUP). Pure function of this racer's gap to
   * the field mean (in laps) — no RNG, no character/lane term, so it is
   * deterministic and unbiased. Trailers are nudged up, runaway leaders down,
   * within a small clamped band that never overrides a skill burst outright.
   */
  function catchupFactor(self: RacerState): number {
    const gapLaps = (internal.meanProgress - self.progress) / config.trackLength;
    if (gapLaps > CATCHUP.deadZone) {
      return Math.min(CATCHUP.maxBoost, 1 + (gapLaps - CATCHUP.deadZone) * CATCHUP.behindGain);
    }
    if (gapLaps < -CATCHUP.deadZone) {
      return Math.max(CATCHUP.minBoost, 1 + (gapLaps + CATCHUP.deadZone) * CATCHUP.aheadDrag);
    }
    return 1;
  }

  /** Mean progress over racers currently on track (catch-up reference point). */
  function activeMeanProgress(): number {
    let sum = 0;
    let n = 0;
    for (const r of internal.racers) {
      if (r.phase === 'finished' || r.phase === 'waiting') continue;
      sum += r.progress;
      n++;
    }
    return n > 0 ? sum / n : 0;
  }

  function advance(self: RacerState, events: SkillEvent[]): void {
    if (self.phase === 'finished' || self.phase === 'waiting') return;
    if (self.phase === 'stunned') {
      self.speed = 0;
      return;
    }

    const jitter = 1 + internal.racerRng.get(self.id)!.range(-SPEED_JITTER, SPEED_JITTER);
    self.speed = self.baseSpeed * jitter + (self.skill.burst ?? 0);

    self.speed *= catchupFactor(self);

    applyOvertake(self, internal.racers, internal.racerRng.get(self.id)!, frame);

    applyIce(self);
    if ((self.skill.slowUntil ?? 0) > frame) self.speed *= Number(self.skill.slowMul ?? 1);

    self.progress += self.speed;

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
    }
    events.push({ frame, racerId: finisher.id, type: 'relay', variant: 'handoff', targetId: nextId });
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
  function applyIce(self: RacerState): void {
    if (internal.iceZones.length === 0) { self.skill.iceJumping = false; return; }
    const lapPos = self.progress % config.trackLength;
    const zone = internal.iceZones.find((z) => frame < z.expire && inZone(lapPos, z));
    if (!zone) { self.skill.iceJumping = false; self.skill.iceZoneId = undefined; return; }
    if ((self.skill.starUntil ?? 0) > frame) return; // ⭐ star: immune to ice

    if (self.characterId === 'cat') {
      // Decide ONCE per zone entry: jump clear over the ice (no slow) with the cat's
      // dodgeChance. `iceJumping` is exposed for the renderer to play the hop.
      if (self.skill.iceZoneId !== zone.id) {
        self.skill.iceZoneId = zone.id;
        self.skill.iceJumping = internal.skillRng
          .get(self.id)!
          .fork(`icejump:${zone.id}`)
          .bool(Number(config.characters.cat.skill.params.dodgeChance ?? 0));
      }
      if (self.skill.iceJumping) return; // jumped clear — no slow
      self.speed *= zone.slowFactor;
      return;
    }
    self.speed *= self.characterId === 'penguin' ? zone.boostFactor : zone.slowFactor;
  }

  /** A gamble box, on pickup, rolls one of four effects (weighted). */
  function applyItemPickup(self: RacerState, order: RacerState[], events: SkillEvent[]): void {
    const irng = internal.itemRng.get(self.id)!;
    const active = (r: RacerState) => r.phase !== 'finished' && r.phase !== 'waiting' && r.phase !== 'stunned';
    const starred = (r: RacerState) => (r.skill.starUntil ?? 0) > frame;
    const x = irng.range(0, 8); // weights: star 1 / lightning 2 / shell 2 / fart 3

    if (x < 1) {
      // 🌟 star: self speed boost + full immunity for a while.
      const until = frame + Math.round(ITEM.starMs / DT_MS);
      self.skill.burst = ITEM.starBoost;
      self.skill.effectUntil = until;
      self.skill.starUntil = until;
      self.phase = 'straying';
      events.push({ frame, racerId: self.id, type: 'item', variant: 'star', line: '무적! ⭐' });
    } else if (x < 3) {
      // ⚡ lightning: every other racer slows briefly.
      const until = frame + Math.round(ITEM.lightningSlowMs / DT_MS);
      for (const r of order) {
        if (r.id === self.id || !active(r) || starred(r)) continue;
        r.skill.slowUntil = until;
        r.skill.slowMul = ITEM.lightningMul;
      }
      events.push({ frame, racerId: self.id, type: 'item', variant: 'lightning', line: '⚡ 번개!' });
    } else if (x < 5) {
      // 🐢 shell: stuns the current leader — even if the picker IS the leader.
      let leader: RacerState | undefined;
      for (const r of order) if (active(r) && (!leader || r.progress > leader.progress)) leader = r;
      events.push({ frame, racerId: self.id, type: 'item', variant: 'shell', line: '🐢 등껍질!' });
      if (leader && !starred(leader)) {
        leader.phase = 'stunned';
        leader.speed = 0;
        leader.skill.burst = 0;
        leader.skill.effectUntil = frame + Math.round(ITEM.shellStunMs / DT_MS);
        events.push({ frame, racerId: self.id, type: 'item', variant: 'shellhit', targetId: leader.id });
      }
    } else {
      // 💨 fart: racers behind the picker (within range) slow briefly.
      const until = frame + Math.round(ITEM.fartSlowMs / DT_MS);
      for (const r of order) {
        if (r.id === self.id || !active(r) || starred(r)) continue;
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
      if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'stunned') continue;
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
      finished: isRaceFinished(),
    };
  }

  // Relay finishes when every team's anchor (final) leg is done; non-relay when
  // every racer has crossed. Relay racers re-enter waiting, so a global racer
  // count would never settle — track team completions instead.
  function isRaceFinished(): boolean {
    return config.relay
      ? internal.teamsFinished >= internal.legQueues.size
      : internal.finishedCount >= internal.racers.length;
  }

  function buildResult(): RaceResult {
    const order = [...internal.racers]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .map((r) => r.id);
    const finishFrame: Record<RacerId, number> = {};
    for (const r of internal.racers) finishFrame[r.id] = r.finishedAt ?? frame;
    const strategy = scoring.get(config.scoringId) ?? scoring.get('individual')!;
    return { order, finishFrame, scoring: strategy(order, config), seed: config.seed };
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
      for (const self of order) resolveTimer(self);
      for (const self of order) tryActivateSkill(self, events);
      internal.meanProgress = activeMeanProgress();
      for (const self of order) advance(self, events);
      updateBoxes(order, events);

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

/** Run a whole race headless (tests, replay, golden screenshots). */
export function simulateRace(
  config: RaceConfig,
  skills: SkillRegistry,
  scoring: ScoringRegistry,
  maxFrames = 60 * 120,
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
