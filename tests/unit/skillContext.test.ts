import { describe, it, expect } from 'vitest';
import { createSkillTestContext } from './skillTestContext.ts';
import { makeRacer as racer } from './fixtures.ts';

// Behaviour-documenting tests for buildSkillContext (via the test factory that
// wraps it) — proves the extraction from RaceEngine.ts's fireSkill (P5) still
// does what the docstrings say, independent of a full RaceEngine/simulateRace.

describe('createSkillTestContext / buildSkillContext', () => {
  it('emit() stamps frame/racerId/type from the acting character', () => {
    const self = racer({ id: 'a', characterId: 'bear' });
    const { ctx, events } = createSkillTestContext({ self, frame: 42 });
    ctx.emit({ variant: 'activate' });
    expect(events).toEqual([{ frame: 42, racerId: 'a', type: 'roar', variant: 'activate' }]);
  });

  it('addIceZone wraps startProgress into [0, trackLength) and increments the id counter', () => {
    const self = racer({ id: 'a', characterId: 'penguin' });
    const { ctx, state } = createSkillTestContext({ self, trackLength: 1000 });
    ctx.addIceZone({ startProgress: -50, length: 100, durationFrames: 60, boostFactor: 1.1, slowFactor: 0.7 });
    ctx.addIceZone({ startProgress: 200, length: 100, durationFrames: 60, boostFactor: 1.1, slowFactor: 0.7 });
    expect(state.iceZones.map((z) => z.id)).toEqual(['ice0', 'ice1']);
    expect(state.iceZones[0].startProgress).toBe(950); // -50 wrapped into [0, 1000)
    expect(state.iceZones[1].startProgress).toBe(200);
  });

  it('spawnDecoys refuses a second set while the owner has live decoys', () => {
    const self = racer({ id: 'a', characterId: 'fox', progress: 100, lane: 0.5 });
    const { ctx, state } = createSkillTestContext({ self });
    const first = ctx.spawnDecoys([{ offset: 10, laneOffset: 0, lead: true }], 2000);
    const second = ctx.spawnDecoys([{ offset: 10, laneOffset: 0, lead: true }], 2000);
    expect(first).toBe(1);
    expect(second).toBe(0); // still alive → refused
    expect(state.decoys).toHaveLength(1);
    expect(state.decoys[0].id).toBe('decoy:a:0');
    expect(state.decoys[0].progress).toBe(110);
  });

  it('tryDecoyGuard consumes a live decoy and emits clonepop, then reports no shield', () => {
    const self = racer({ id: 'a', characterId: 'fox', progress: 100 });
    const target = racer({ id: 'b', characterId: 'fox' });
    const { ctx, events, state } = createSkillTestContext({ self, all: [self, target] });
    ctx.spawnDecoys([{ offset: 5, laneOffset: 0, lead: true }], 2000);
    expect(ctx.tryDecoyGuard(self)).toBe(true); // self is the decoy owner
    expect(state.decoys[0].alive).toBe(false);
    expect(events.at(-1)).toMatchObject({ racerId: 'a', type: 'illusionClone', variant: 'clonepop' });
    expect(ctx.tryDecoyGuard(self)).toBe(false); // already popped
  });

  it('canCopySkill bans mimic/illusionClone and anything not registered as a tick', () => {
    const self = racer({ id: 'a', characterId: 'bear' });
    const { ctx } = createSkillTestContext({ self, getTick: (t) => (t === 'roar' ? () => {} : undefined) });
    expect(ctx.canCopySkill('roar')).toBe(true);
    expect(ctx.canCopySkill('mimic')).toBe(false);
    expect(ctx.canCopySkill('illusionClone')).toBe(false);
    expect(ctx.canCopySkill('unregistered')).toBe(false);
  });

  it('invokeSkill dispatches the copied handler on its own rng fork and stamps the copied type', () => {
    const self = racer({ id: 'a', characterId: 'bear' });
    let seenRngDiffers = false;
    const copied = (copiedCtx: { rng: { next(): number }; emit: (e: { variant: string }) => void }) => {
      seenRngDiffers = copiedCtx.rng !== ctx.rng;
      copiedCtx.emit({ variant: 'activate' });
    };
    const { ctx, events } = createSkillTestContext({
      self,
      getTick: (t) => (t === 'roar' ? (copied as never) : undefined),
    });
    const fired = ctx.invokeSkill('roar', { range: 10 });
    expect(fired).toBe(true);
    expect(seenRngDiffers).toBe(true);
    expect(events.at(-1)).toMatchObject({ racerId: 'a', type: 'roar', variant: 'activate' });
  });

  it('invokeSkill refuses mimic (recursion), illusionClone, and unregistered types', () => {
    const self = racer({ id: 'a', characterId: 'bear' });
    const { ctx } = createSkillTestContext({ self, getTick: () => undefined });
    expect(ctx.invokeSkill('mimic', {})).toBe(false);
    expect(ctx.invokeSkill('illusionClone', {})).toBe(false);
    expect(ctx.invokeSkill('unregistered', {})).toBe(false);
  });

  it('default deps: no dodge, no ranged evade, params come from the acting character', () => {
    const self = racer({ id: 'a', characterId: 'dog' });
    const { ctx } = createSkillTestContext({ self });
    expect(ctx.tryDodge(self)).toBe(false);
    expect(ctx.tryRangedEvade(self)).toBe(false);
    expect(ctx.params).toEqual(expect.objectContaining({ burstMin: expect.any(Number) }));
  });
});
