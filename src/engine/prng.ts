/**
 * Seeded PRNG (mulberry32). All engine randomness MUST flow through this —
 * never Math.random() — so that (config + seed) replays identically (spec §12.2).
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** True with probability p (0..1). */
  bool(p: number): boolean;
  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /**
   * Derive a stable, independent sub-stream from a label. Same label always
   * yields the same sub-stream regardless of how many draws happened on the
   * parent — this keeps per-skill randomness isolated so tuning one skill does
   * not shift unrelated racers' sequences (golden-screenshot stability).
   */
  fork(label: string): Rng;
}

function hashString(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const baseSeed = seed >>> 0;
  const gen = mulberry32(baseSeed);

  const rng: Rng = {
    next: () => gen(),
    int: (maxExclusive: number) => Math.floor(gen() * maxExclusive),
    range: (min: number, max: number) => min + gen() * (max - min),
    bool: (p: number) => gen() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(gen() * arr.length)],
    fork: (label: string) => createRng((baseSeed ^ hashString(label)) >>> 0),
  };
  return rng;
}
