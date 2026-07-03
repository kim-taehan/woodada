/**
 * Ice-field subsystem (🐧 icefield skill: penguin lays a patch, environmental +
 * species-based, team-agnostic). Extracted from RaceEngine.ts (P4) — same logic,
 * a narrow deps object instead of closure capture over `internal`/`config`/`frame`.
 * Fork labels (`icejump:<zoneId>`) are unchanged (byte-preserved) as long as
 * callers pass the same underlying skill-rng streams.
 */

import type { Rng } from './prng.ts';
import type { CharacterData } from '../data/schema.ts';
import { ICE_LIMITS } from './tuning.ts';
import type { RacerId, RacerState } from './types.ts';

export interface IceZone {
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

/** True if `lapPos` (0..trackLength) lies inside the zone, accounting for wrap. */
export function inZone(lapPos: number, zone: IceZone, trackLength: number): boolean {
  const end = zone.startProgress + zone.length;
  if (end <= trackLength) return lapPos >= zone.startProgress && lapPos < end;
  // Wrapped zone: [start, len) ∪ [0, end - len).
  return lapPos >= zone.startProgress || lapPos < end - trackLength;
}

export interface IceDeps {
  frame: number;
  trackLength: number;
  iceZones: IceZone[];
  racers: RacerState[];
  characters: Record<string, CharacterData>;
  skillRngFor: (racerId: RacerId) => Rng;
}

/**
 * Penguin icefield (environmental, species-based, team-agnostic). A racer whose
 * lap-position is inside any active zone has its speed scaled: an `iceGlide`
 * racer glides faster (boostFactor), every other racer slips slower (slowFactor).
 * An `iceHop` racer is nimble: each frame it can *jump over* the ice with
 * probability equal to its own skill's `dodgeChance` (deterministic per
 * (racer, frame) via its own sub-stream), dodging the slow that frame. Stacks
 * multiplicatively if (rarely) inside several zones; deterministic.
 */
export function applyIce(self: RacerState, deps: IceDeps): void {
  const { frame, trackLength, iceZones, racers, characters, skillRngFor } = deps;
  if (iceZones.length === 0) { self.skill.iceJumping = false; return; }
  const lapPos = self.progress % trackLength;

  // Find all zones the racer is currently in
  const activeZones = iceZones.filter((z) => frame < z.expire && inZone(lapPos, z, trackLength));
  if (activeZones.length === 0) {
    self.skill.iceJumping = false;
    self.skill.iceZoneId = undefined;
    return;
  }

  if ((self.skill.starUntil ?? 0) > frame) return; // ⭐ star: immune to ice
  // Airborne racers (e.g. the alien's UFO) float over the ice — no contact, so
  // neither the ice-glide boost nor the runner slow applies. Trait-driven, not
  // id-hardcoded.
  if (characters[self.characterId]?.airborne) return;

  // 🐧 아이스 글라이드: 얼음판 위에서는 스턴 무효 (스턴 중에도 얼음판 위면 정상 이동)
  if (self.iceGlide && self.phase === 'stunned') {
    self.phase = 'running';
    self.speed = self.baseSpeed * activeZones[0].boostFactor;
    return;
  }

  if (self.iceHop) {
    // Decide ONCE per zone entry: jump clear over the ice (no slow) with this racer's own
    // skill's dodgeChance. `iceJumping` is exposed for the renderer to play the hop.
    const zone = activeZones[0];
    if (self.skill.iceZoneId !== zone.id) {
      self.skill.iceZoneId = zone.id;
      self.skill.iceJumping = skillRngFor(self.id)
        .fork(`icejump:${zone.id}`)
        .bool(Number(characters[self.characterId]?.skill.params.dodgeChance ?? 0));
    }
    if (self.skill.iceJumping) return; // jumped clear — no slow
    // On ice: apply slow factor (capped at the ice-limits floor)
    self.speed *= Math.max(ICE_LIMITS.slowFloor, activeZones[0].slowFactor);
    return;
  }

  // 🐧 펭귄 얼음판: 감속/부스트 누적 방지 (최대 50% 감속, 18% 부스트)
  // 아이스 글라이더만 부스트, 나머지는 감속 (팀메이트도 영향 없음 = 1.0)
  const isGlider = Boolean(self.iceGlide);
  const owner = racers.find((r) => r.id === activeZones[0].ownerId);
  const isTeammate = owner?.teamId !== undefined && owner.teamId === self.teamId;

  // 팀메이트는 얼음판 영향 없음 (1.0), 글라이더는 부스트, 나머지는 감속
  if (isTeammate && !isGlider) {
    // 팀메이트: 영향 없음
    return;
  }

  let finalFactor: number = isGlider ? ICE_LIMITS.boostCeil : ICE_LIMITS.slowFloor;

  // If multiple zones, take the minimum (most severe) factor, but cap at limits
  for (const zone of activeZones) {
    const zoneFactor = isGlider ? zone.boostFactor : zone.slowFactor;
    if (isGlider) {
      finalFactor = Math.max(finalFactor, zoneFactor);  // max boost
    } else {
      finalFactor = Math.min(finalFactor, zoneFactor);  // min (most severe) slow
    }
  }

  // Cap at limits: max 50% slow, max 18% boost
  if (!isGlider) {
    finalFactor = Math.max(ICE_LIMITS.slowFloor, finalFactor);
  } else {
    finalFactor = Math.min(ICE_LIMITS.boostCeil, finalFactor);
  }

  self.speed *= finalFactor;
}
