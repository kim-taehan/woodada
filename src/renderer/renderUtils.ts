/**
 * Pure renderer helpers extracted from RaceRenderer (no closure state, no Pixi
 * objects). Field-size scaling, deterministic id hashing, track-zone math, and
 * the eagle-divebomb hop curve. All deterministic — same inputs, same outputs.
 */

import type { EngineFrame, RaceConfig } from '../engine/types.ts';
import { characterCatalog } from '../data/characters/index.ts';
import { teamPalette, type TeamId } from '../data/teams.ts';

// Eagle divebomb (jump-headbutt) screen-space action timing (seconds from start).
export const DIVE_RISE = 0.22; // spring up off the ground (eased out — a quick hop)
export const DIVE_HANG = 0.05; // a tiny float at the top of the hop before the lunge
export const DIVE_PLUNGE = 0.26; // drop + lunge forward onto the target (eased in)
export const DIVE_TOTAL = DIVE_RISE + DIVE_HANG + DIVE_PLUNGE;
export const DIVE_LIFT = 46; // peak screen-Y hop height (px) — a low forward pounce, not a soar
export const DIVE_POP = 0.16; // slight scale bump at the apex of the hop
// When the divebomb impact FX should land: as the headbutt connects at the bottom.
export const IMPACT_DELAY = DIVE_RISE + DIVE_HANG + DIVE_PLUNGE * 0.82;

// Spider abduct reel-in: how long the yanked target's body takes to slide (in
// screen space) from where it was to its engine-demoted spot behind the spider.
// Matches the webPull strand/yank FX (~0.4s ttl) so glyph + body arrive together.
export const REEL_SECS = 0.25;

/**
 * Screen-space hop offset at `age` seconds into the jump-headbutt: how high off
 * the ground the eagle is (`lift`, px upward), a scale bump (`pop`), and `glide`
 * (0→1) — the lunge progress used to slide the body horizontally onto the target.
 * Springs up over its own spot (glide 0), floats briefly, then drops while lunging
 * forward (glide→1) so it rams the target head-first. Returns null once over.
 */
export function diveOffset(age: number): { lift: number; pop: number; glide: number } | null {
  if (age < 0 || age > DIVE_TOTAL) return null;
  if (age < DIVE_RISE) {
    const k = age / DIVE_RISE;
    const e = 1 - (1 - k) * (1 - k); // ease-out: quick spring, settling at the top
    return { lift: DIVE_LIFT * e, pop: DIVE_POP * e, glide: 0 };
  }
  if (age < DIVE_RISE + DIVE_HANG) {
    return { lift: DIVE_LIFT, pop: DIVE_POP, glide: 0 }; // float at the top of the hop
  }
  const k = (age - DIVE_RISE - DIVE_HANG) / DIVE_PLUNGE;
  const e = k * k; // ease-in: accelerating drop + forward lunge
  return { lift: DIVE_LIFT * (1 - e), pop: DIVE_POP * (1 - e), glide: e };
}

/**
 * Field-size auto-scaling. The "field" is how many racers share the track AT
 * ONCE — for a relay that is the active team count (one runner per team), not
 * the headcount. Small fields keep today's look exactly; crowded fields shrink
 * the characters and widen the lane band so they overlap less and name tags
 * stay legible.
 */
const FIELD_MIN = 6; // ≤ this → unchanged (regression-safe)
const FIELD_MAX = 16; // fully crowded
const SIZE_FLOOR = 0.62; // smallest character multiplier (legibility clamp)
const BAND_CEIL = 1.5; // widest lane band multiplier

export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** 0 at FIELD_MIN, 1 at FIELD_MAX, eased. */
export function crowding(fieldSize: number): number {
  return smoothstep((fieldSize - FIELD_MIN) / (FIELD_MAX - FIELD_MIN));
}

/** Global character-size multiplier for a field size (1 → SIZE_FLOOR). */
export function fieldSizeScale(fieldSize: number): number {
  return 1 - (1 - SIZE_FLOOR) * crowding(fieldSize);
}

/** Lane-band widening multiplier for a field size (1 → BAND_CEIL). */
export function fieldBandMul(fieldSize: number): number {
  return 1 + (BAND_CEIL - 1) * crowding(fieldSize);
}

// Per-species emoji for the lane-intro card's "🐧 펭귄" species line. Mirrors the
// shell's SetupScreen CHAR_LABEL (the renderer must not import shell); the name
// itself comes from characterCatalog. A missing id just shows the bare name.
const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐶', cat: '🐱', monkey: '🐒', eagle: '🦅', bear: '🐻',
  penguin: '🐧', hedgehog: '🦔', spider: '🕷️', alien: '🛸',
};

/** "🐧 펭귄"-style species label for a characterId (emoji + catalog name). */
export function speciesLabel(characterId: string): string {
  const name = characterCatalog[characterId]?.name ?? characterId;
  const emoji = SPECIES_EMOJI[characterId];
  return emoji ? `${emoji} ${name}` : name;
}

/** Racers sharing the track at once: relay → active team count; else headcount. */
export function fieldSizeOf(cfg: RaceConfig): number {
  if (cfg.relay) {
    const teams = new Set<string>();
    for (const p of cfg.participants) teams.add(p.teamId ?? p.id);
    return teams.size;
  }
  return cfg.participants.length;
}

export function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * True if a racer's one-lap position lies inside an active ice zone (mirrors the
 * engine's `inZone`, wrap-aware). Display-only: it picks the penguin's belly-slide
 * pose; it never changes the simulation (the engine already applied the boost).
 */
export function lapPosInZones(progress: number, trackLength: number, zones: EngineFrame['iceZones']): boolean {
  const lapPos = ((progress % trackLength) + trackLength) % trackLength;
  for (const z of zones) {
    const end = z.startProgress + z.length;
    if (end <= trackLength) {
      if (lapPos >= z.startProgress && lapPos < end) return true;
    } else if (lapPos >= z.startProgress || lapPos < end - trackLength) {
      return true;
    }
  }
  return false;
}

export function isTeamId(id: string | undefined): id is TeamId {
  return id !== undefined && id in teamPalette;
}

/**
 * Deterministic hash of a racer id → a stable [0,1) value. Used for the
 * post-finish free-scatter offsets so the layout is reproducible (no
 * Math.random) — same (config+seed) yields the same celebration tableau.
 */
export function hash01(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mix and fold to [0,1).
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

export function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c) * (1 - c);
}
