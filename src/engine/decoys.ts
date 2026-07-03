/**
 * Gumiho illusionClone decoy subsystem (NON-scoring — decoys are never racers).
 * Extracted from RaceEngine.ts (P4) — same logic, a narrow deps object instead
 * of closure capture over `internal`/`config`/`frame`. No RNG here (offsets are
 * drawn at spawn time by fireSkill's `ctx.spawnDecoys`, which stays in
 * RaceEngine.ts) — collision/teleport are pure geometry, fully deterministic.
 */

import type { CharacterData } from '../data/schema.ts';
import { DT_MS, type DecoyState, type RacerId, type RacerState, type SkillEvent } from './types.ts';

// A decoy bumps a rival within this progress + lane proximity, stunning it once
// (then the decoy pops). Collision is purely geometric (no RNG): same (config,
// seed) → identical bumps.
export const DECOY = {
  collideDist: 10, // progress units (≈ ⅔ body-length; reaches adjacent traffic)
  collideLane: 0.18, // lane proximity (≈ OVERTAKE.laneNear)
  // A bumped racer is briefly immune to *further* decoy bumps, so one gumiho's
  // clones can't chain-stun the same victims lap after lap (anti-accumulation,
  // mirrors banana's bananaImmuneUntil). Keeps the field from over-rebunching.
  rebumpImmuneMs: 1200,
} as const;

/** Mutable decoy state slice (a subset of RaceEngine's `Internals`, passed by reference). */
export interface DecoyUpdateState {
  decoys: DecoyState[];
}

export interface DecoyDeps {
  frame: number;
  racers: RacerState[];
  characters: Record<string, CharacterData>;
  /** Stable per-racer tie-break key (draw-order independent, no RNG). */
  procKey: Map<RacerId, number>;
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
export function updateDecoys(state: DecoyUpdateState, events: SkillEvent[], deps: DecoyDeps): void {
  const { frame, racers, characters, procKey } = deps;
  if (state.decoys.length === 0) return;

  for (const d of state.decoys) {
    if (!d.alive) continue;
    const owner = racers.find((r) => r.id === d.ownerId);
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
  for (const d of state.decoys) {
    if (!d.alive) continue;
    const owner = racers.find((r) => r.id === d.ownerId);
    if (!owner) continue;
    const collisionMs = Number(characters[owner.characterId]?.skill.params.collisionStun ?? 500);
    let victim: RacerState | undefined;
    let victimGap = Infinity;
    for (const v of racers) {
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
        (gap === victimGap && victim && procKey.get(v.id)! < procKey.get(victim.id)!)
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
  for (const d of state.decoys) {
    if (frame >= d.expireFrame) expiringOwners.add(d.ownerId);
  }
  for (const ownerId of expiringOwners) {
    const owner = racers.find((r) => r.id === ownerId);
    const lead = state.decoys.find(
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
    for (const d of state.decoys) if (d.ownerId === ownerId && frame >= d.expireFrame) d.alive = false;
  }

  // Prune dead / despawned decoys.
  state.decoys = state.decoys.filter((d) => d.alive);
}
