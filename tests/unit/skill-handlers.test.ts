import { describe, it, expect } from 'vitest';
import { roarHandler } from '../../src/engine/skills/roar.ts';
import { abductHandler } from '../../src/engine/skills/abduct.ts';
import { bristleHandler } from '../../src/engine/skills/bristle.ts';
import { DT_MS } from '../../src/engine/types.ts';
import { characterCatalog } from '../../src/data/characters/index.ts';
import { createSkillTestContext } from './skillTestContext.ts';
import { makeRacer } from './fixtures.ts';

/**
 * Direct skill-handler unit tests — the P5/P6 payoff. Each handler is driven
 * through the REAL SkillContext (createSkillTestContext wraps the engine's own
 * buildSkillContext) with a hand-built field, no simulateRace, no seed loops:
 * one call, deterministic assertions. The seed-sampling statistical tests in
 * skills.test.ts still cover in-race emergence; these pin the handler CONTRACT.
 *
 * Numbers are read from the character data (skill.params), not hard-coded, so
 * balance patches don't break these tests — only behavioural changes do.
 */

const frames = (ms: number) => Math.round(ms / DT_MS);

describe('roar (bear) — direct handler', () => {
  const P = characterCatalog.bear.skill.params;

  it('staggers rivals in range; ignores teammates and out-of-range racers', () => {
    const bear = makeRacer({ id: 'bear1', characterId: 'bear', progress: 500, teamId: 'A' });
    const near = makeRacer({ id: 'near', progress: 500 + Number(P.range) - 1 });
    const far = makeRacer({ id: 'far', progress: 500 + Number(P.range) + 50 });
    const mate = makeRacer({ id: 'mate', progress: 500, teamId: 'A' });
    const { ctx, events } = createSkillTestContext({ self: bear, all: [bear, near, far, mate], frame: 100 });

    roarHandler(ctx);

    expect(near.phase).toBe('stunned');
    expect(near.speed).toBe(0);
    expect(near.skill.effectUntil).toBe(100 + frames(Number(P.staggerMs)));
    expect(far.phase).toBe('running');
    expect(mate.phase).toBe('running');
    expect(events.filter((e) => e.variant === 'hit').map((e) => e.targetId)).toEqual(['near']);
  });

  it('anti-stack: a recently roared victim dodges instead of re-stunning', () => {
    const bear = makeRacer({ id: 'bear1', characterId: 'bear', progress: 500 });
    const victim = makeRacer({ id: 'v', progress: 510, skill: { roarImmuneUntil: 999 } });
    const { ctx, events } = createSkillTestContext({ self: bear, all: [bear, victim], frame: 100 });

    roarHandler(ctx);

    expect(victim.phase).toBe('running');
    expect(events.some((e) => e.variant === 'dodge' && e.targetId === 'v')).toBe(true);
    expect(events.some((e) => e.variant === 'hit')).toBe(false);
  });

  it('self-burst is laps-gated: dormant before a beaten lap, scales with lapsDone after', () => {
    const P0 = Number(P.selfBurst);
    const growth = Number(P.selfBurstGrowth);
    const lapDistance = Number(P.lapDistance ?? 1000);

    // lapsDone = 0 (progress < 2×lapDistance) → gate closed, no burst even on a hit.
    const early = makeRacer({ id: 'b', characterId: 'bear', progress: lapDistance * 1.5 });
    const v1 = makeRacer({ id: 'v1', progress: early.progress + 10 });
    const c1 = createSkillTestContext({ self: early, all: [early, v1], frame: 100 });
    roarHandler(c1.ctx);
    expect(early.skill.burst ?? 0).toBe(0);

    // lapsDone = 2 (progress ≥ 3×lapDistance) → burst = selfBurst × (1 + 2×growth).
    const late = makeRacer({ id: 'b', characterId: 'bear', progress: lapDistance * 3.5 });
    const v2 = makeRacer({ id: 'v2', progress: late.progress + 10 });
    const c2 = createSkillTestContext({ self: late, all: [late, v2], frame: 100 });
    roarHandler(c2.ctx);
    expect(late.skill.burst).toBeCloseTo(P0 * (1 + 2 * growth), 10);
  });
});

describe('abduct (spider) — direct handler', () => {
  const P = characterCatalog.spider.skill.params;

  it('yanks the nearest racer ahead in the band to pullGap behind, tangles and immunises it', () => {
    const spider = makeRacer({ id: 's', characterId: 'spider', progress: 500 });
    const nearer = makeRacer({ id: 'n', progress: 500 + Number(P.minRange) + 10 });
    const farther = makeRacer({ id: 'f', progress: 500 + Number(P.range) - 1 });
    const { ctx, events } = createSkillTestContext({ self: spider, all: [spider, nearer, farther], frame: 100 });

    abductHandler(ctx);

    expect(nearer.progress).toBe(500 - Number(P.pullGap)); // yanked behind the spider
    expect(farther.progress).toBe(500 + Number(P.range) - 1); // only the nearest is grabbed
    expect(nearer.skill.slowMul).toBe(Number(P.tangleMul));
    const tangleEnd = 100 + frames(Number(P.tangleMs));
    expect(nearer.skill.slowUntil).toBe(tangleEnd);
    expect(nearer.skill.abductImmuneUntil).toBe(tangleEnd + frames(Number(P.immuneMs ?? 0)));
    expect(events.map((e) => e.variant)).toEqual(['activate', 'hit']);
  });

  it('holds (emits nothing) when nobody is in the minRange..range band', () => {
    const spider = makeRacer({ id: 's', characterId: 'spider', progress: 500 });
    const tooClose = makeRacer({ id: 'c', progress: 500 + Number(P.minRange) - 1 });
    const tooFar = makeRacer({ id: 'f', progress: 500 + Number(P.range) + 1 });
    const behind = makeRacer({ id: 'b', progress: 400 });
    const { ctx, events } = createSkillTestContext({ self: spider, all: [spider, tooClose, tooFar, behind] });

    abductHandler(ctx);

    expect(events).toEqual([]); // 'declined to fire' → engine retries on RETRY_COOLDOWN_MS
    expect(tooClose.progress).toBe(500 + Number(P.minRange) - 1);
  });

  it('star deflects the web: activate + dodge, target position untouched', () => {
    const spider = makeRacer({ id: 's', characterId: 'spider', progress: 500 });
    const starred = makeRacer({ id: 't', progress: 550, skill: { starUntil: 999 } });
    const { ctx, events } = createSkillTestContext({ self: spider, all: [spider, starred], frame: 100 });

    abductHandler(ctx);

    expect(starred.progress).toBe(550);
    expect(events.map((e) => e.variant)).toEqual(['activate', 'dodge']);
  });
});

describe('bristle (hedgehog) — direct handler', () => {
  const P = characterCatalog.hedgehog.skill.params;

  it('spikes the nearest racer behind within maxGap: pushback + slow, recoil burst on self', () => {
    const hog = makeRacer({ id: 'h', characterId: 'hedgehog', progress: 500 });
    const chaser = makeRacer({ id: 'c', progress: 500 - Number(P.maxGap) + 10 });
    const straggler = makeRacer({ id: 'x', progress: 300 });
    const { ctx, events } = createSkillTestContext({ self: hog, all: [hog, chaser, straggler], frame: 100 });

    bristleHandler(ctx);

    expect(chaser.progress).toBe(500 - Number(P.maxGap) + 10 - Number(P.pushBack));
    expect(chaser.skill.slowMul).toBe(Number(P.slowMul));
    expect(chaser.skill.slowUntil).toBe(100 + frames(Number(P.slowMs)));
    expect(straggler.progress).toBe(300); // only the nearest chaser is hit
    expect(hog.skill.burst).toBe(Number(P.recoilBurst)); // recoil self-boost
    expect(hog.phase).toBe('straying');
    expect(events.some((e) => e.variant === 'hit' && e.targetId === 'c')).toBe(true);
  });

  it('does not fire when last (nobody behind) or when the chaser is beyond maxGap', () => {
    const hog = makeRacer({ id: 'h', characterId: 'hedgehog', progress: 500 });
    const leader = makeRacer({ id: 'l', progress: 600 });
    const c1 = createSkillTestContext({ self: hog, all: [hog, leader] });
    bristleHandler(c1.ctx);
    expect(c1.events).toEqual([]);

    const farChaser = makeRacer({ id: 'c', progress: 500 - Number(P.maxGap) - 1 });
    const c2 = createSkillTestContext({ self: hog, all: [hog, farChaser] });
    bristleHandler(c2.ctx);
    expect(c2.events).toEqual([]);
    expect(farChaser.progress).toBe(500 - Number(P.maxGap) - 1);
  });
});
