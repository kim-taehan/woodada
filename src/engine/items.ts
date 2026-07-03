/**
 * Item-box subsystem (🎁 gamble boxes: star/lightning/shell/fart) + 🐵 원숭이
 * 아이템 잔머리 remap. Extracted from RaceEngine.ts (P4) — same logic, a narrow
 * deps object instead of closure capture over `internal`/`config`/`frame`. Fork
 * labels (`monkeyitem:<pick>`) and box id numbering (`box<counter>`) are
 * unchanged (byte-preserved) as long as callers pass the same underlying Rng/
 * counter objects.
 */

import type { Rng } from './prng.ts';
import { DT_MS, type RacerId, type RacerState, type SkillEvent } from './types.ts';
import { MONKEY_ITEM } from './tuning.ts';

// Item boxes spawn at random times + positions during the race (never at the
// start), live briefly, and vanish when collected or after their lifetime.
export const ITEM = {
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

export interface ItemBox {
  id: string;
  progress: number;
  lane: number;
  expire: number;
}

/** The four gamble-box outcomes (decoupled from the weight roll so the monkey can remap one). */
export type ItemKind = 'star' | 'lightning' | 'shell' | 'fart';

/**
 * 🐵 원숭이 잔머리 (see CHARACTER PASSIVES): remap a rolled item kind to a smarter one for a
 * monkey-witted racer, given whether it is currently the leader. Pure (the only randomness is the
 * passed-in `rng`, a stable-label sub-stream so it never shifts the main item draw order):
 *   - shell while leading → fart   (the shell would stun the monkey itself)
 *   - fart while NOT leading → shell (a chasing fart hits no one useful; snipe the leader)
 *   - lightning → star with `lightningToStarChance` (gated: star is the strongest item)
 *   - otherwise unchanged.
 */
export function monkeyRemapItem(kind: ItemKind, isLeader: boolean, rng: Rng): ItemKind {
  if (kind === 'shell' && isLeader) return 'fart';
  if (kind === 'fart' && !isLeader) return 'shell';
  if (kind === 'lightning' && rng.bool(MONKEY_ITEM.lightningToStarChance)) return 'star';
  return kind;
}

/** Mutable box state slice (a subset of RaceEngine's `Internals`, passed by reference). */
export interface ItemBoxState {
  boxes: ItemBox[];
  nextBoxFrame: number;
  boxCounter: number;
}

export interface ItemDeps {
  frame: number;
  trackLength: number;
  boxRng: Rng;
  itemRngFor: (racerId: RacerId) => Rng;
  isSkillInvuln: (r: RacerState) => boolean;
  tryHedgehogEvade: (target: RacerState) => boolean;
}

/** A gamble box, on pickup, rolls one of four effects (weighted). */
export function applyItemPickup(self: RacerState, order: RacerState[], events: SkillEvent[], deps: ItemDeps): void {
  const { frame, itemRngFor, isSkillInvuln, tryHedgehogEvade } = deps;
  const irng = itemRngFor(self.id);
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
  if (self.itemWit) {
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

export function updateBoxes(state: ItemBoxState, order: RacerState[], events: SkillEvent[], deps: ItemDeps): void {
  const { frame, trackLength, boxRng } = deps;
  // Drop expired boxes.
  state.boxes = state.boxes.filter((b) => frame <= b.expire);

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
    const lapProgress = self.progress % trackLength;
    for (const box of state.boxes) {
      if (collected.has(box.id)) continue;
      if (Math.abs(lapProgress - box.progress) > ITEM.collectDist) continue;
      if (Math.abs(self.lane - box.lane) > ITEM.collectLane) continue;

      collected.add(box.id);
      applyItemPickup(self, order, events, deps);
    }
  }
  if (collected.size) state.boxes = state.boxes.filter((b) => !collected.has(b.id));

  // Spawn a new box at a random time + position (never collected at the line).
  if (frame >= state.nextBoxFrame) {
    if (state.boxes.length < ITEM.maxBoxes) {
      state.boxes.push({
        id: `box${state.boxCounter++}`,
        progress: boxRng.range(0.12, 0.95) * trackLength,
        lane: boxRng.range(0.12, 0.88),
        expire: frame + Math.round(boxRng.range(...ITEM.lifeMs) / DT_MS),
      });
    }
    state.nextBoxFrame = frame + Math.round(boxRng.range(...ITEM.spawnGapMs) / DT_MS);
  }
}
