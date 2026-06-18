import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/engine/prng.ts';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('produces values in [0,1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('fork is stable per label, independent of parent draws', () => {
    const parent1 = createRng(42);
    const f1 = parent1.fork('skill:dog');
    const parent2 = createRng(42);
    parent2.next();
    parent2.next(); // advance parent differently
    const f2 = parent2.fork('skill:dog');
    expect(f1.next()).toEqual(f2.next());
  });

  it('different labels give different streams', () => {
    const p = createRng(42);
    expect(p.fork('a').next()).not.toEqual(p.fork('b').next());
  });

  it('bool respects probability roughly', () => {
    const r = createRng(99);
    let hits = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (r.bool(0.3)) hits++;
    expect(hits / N).toBeGreaterThan(0.27);
    expect(hits / N).toBeLessThan(0.33);
  });
});
