import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { makeConfig, allThree } from './helpers.ts';
import { characterCatalog } from '../../src/data/characters/index.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

describe('skill behaviour', () => {
  it('all character skills activate over the course of races', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 60 && seen.size < 6; s++) {
      const { frames } = simulateRace(makeConfig({ characterIds: [...allThree, ...allThree], seed: s }), skills, scoring);
      for (const f of frames) for (const e of f.events) if (e.variant === 'activate') seen.add(e.type);
    }
    expect([...seen].sort()).toEqual(['banana', 'catwalk', 'divebomb', 'icefield', 'roar', 'zoomies']);
  });

  it('zoomies emits its line and pushes a burst (straying phase)', () => {
    const { frames } = simulateRace(makeConfig({ characterIds: ['dog', 'dog'], seed: 3 }), skills, scoring);
    const act = frames.flatMap((f) => f.events).find((e) => e.type === 'zoomies' && e.variant === 'activate');
    expect(act?.line).toBe('우다다다다!!!');
    const strayed = frames.some((f) => f.racers.some((r) => r.phase === 'straying'));
    expect(strayed).toBe(true);
  });

  it('banana never stuns a teammate and may dodge', () => {
    let sawHit = false;
    let sawDodge = false;
    for (let s = 0; s < 40; s++) {
      // Two monkeys on the same team — they must not stun each other.
      const cfg = makeConfig({
        characterIds: ['monkey', 'monkey', 'dog', 'dog'],
        seed: s,
        teamMode: true,
        scoringId: 'teamRankSum',
        teamIds: ['A', 'A', 'B', 'B'],
      });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.type !== 'banana') continue;
          if (e.variant === 'hit') {
            sawHit = true;
            // hit target must not be a teammate of the thrower
            const thrower = cfg.participants.find((p) => p.id === e.racerId)!;
            const target = cfg.participants.find((p) => p.id === e.targetId)!;
            expect(target.teamId).not.toBe(thrower.teamId);
          }
          if (e.variant === 'dodge') sawDodge = true;
        }
      }
    }
    expect(sawHit).toBe(true);
    expect(sawDodge).toBe(true);
  });

  it('catwalk dodge: a cat that dodges in its window is not stunned that frame', () => {
    // Probabilistic now (not guaranteed immunity). Whenever a roar/divebomb (which
    // have no dodgeChance of their own — a dodge there can only be catwalk's) hits
    // a cat that is in its dodge window, the cat avoids it and is not stunned.
    let sawCatDodge = false;
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({ characterIds: ['cat', 'cat', 'monkey', 'eagle', 'bear'], seed: s });
      const catIds = new Set(cfg.participants.filter((p) => p.characterId === 'cat').map((p) => p.id));
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.variant !== 'dodge' || !e.targetId || !catIds.has(e.targetId)) continue;
          // roar/divebomb dodges can ONLY be catwalk dodges (those skills have no
          // self dodgeChance), so the cat must be in-window and un-stunned.
          if (!['roar', 'divebomb'].includes(e.type)) continue;
          sawCatDodge = true;
          const cat = f.racers.find((r) => r.id === e.targetId)!;
          expect((cat.skill.dodgeUntil ?? 0) > f.frame).toBe(true);
          expect(cat.phase).not.toBe('stunned');
        }
      }
    }
    expect(sawCatDodge).toBe(true);
  });

  it('catwalk dodge roll is deterministic per (cat, frame) at 0/1 boundaries', () => {
    // The roll is resolved by forking the cat's own sub-stream by frame, so the
    // SAME cat/frame always yields the SAME outcome. With dodgeChance forced to 1
    // every in-window hit on a cat dodges; with 0 every in-window hit lands.
    function run(dodgeChance: number) {
      const characters = structuredClone(characterCatalog);
      characters.cat.skill.params = { ...characters.cat.skill.params, dodgeChance };
      const cfg = { ...makeConfig({ characterIds: ['cat', 'monkey', 'bear', 'eagle'], seed: 11 }), characters };
      return simulateRace(cfg, skills, scoring);
    }
    const always = run(1);
    // Same seed twice ⇒ identical event stream (determinism).
    const always2 = run(1);
    const ev = (r: ReturnType<typeof run>) =>
      r.frames.flatMap((f) => f.events.map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`));
    expect(ev(always)).toEqual(ev(always2));

    const catIds = new Set(['p0']); // first participant is the cat
    // With chance=1, no disruption event whose target is the cat may be a 'hit'.
    for (const f of always.frames) {
      for (const e of f.events) {
        if (!e.targetId || !catIds.has(e.targetId)) continue;
        if (!['banana', 'roar', 'divebomb', 'item'].includes(e.type)) continue;
        // While in window, an attack on the cat must dodge, never hit.
        const cat = f.racers.find((r) => r.id === e.targetId)!;
        if ((cat.skill.dodgeUntil ?? 0) > f.frame && e.variant === 'hit') {
          throw new Error(`cat was hit while dodgeChance=1 at frame ${f.frame}`);
        }
      }
    }
  });

  it('divebomb gambles: hits the target, botches onto self, or whiffs', () => {
    // 50/50: success stuns the nearest racer ahead (variant 'hit', targetId=that
    // racer); failure stuns the eagle itself (variant 'hit', targetId=self). No
    // target ahead in range → 'activate' only (whiff). Across seeds we must see
    // both branches, and a hit's victim must end up stunned that frame.
    let sawTargetHit = false;
    let sawSelfBotch = false;
    for (let s = 0; s < 60; s++) {
      // No cats so dodge never intervenes; targets are plain.
      const cfg = makeConfig({ characterIds: ['eagle', 'dog', 'monkey', 'bear', 'dog'], seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.type !== 'divebomb' || e.variant !== 'hit' || !e.targetId) continue;
          const victim = f.racers.find((r) => r.id === e.targetId)!;
          expect(victim.phase).toBe('stunned');
          if (e.racerId === e.targetId) sawSelfBotch = true;
          else sawTargetHit = true;
        }
      }
    }
    expect(sawTargetHit).toBe(true);
    expect(sawSelfBotch).toBe(true);
  });

  it('icefield: penguins glide faster and non-penguins slip slower inside the zone', () => {
    // While a penguin's ice zone is active, a penguin inside it must move faster
    // than its base step and a non-penguin inside it slower. The zone is laid
    // ahead of the penguin and exposed on EngineFrame.iceZones.
    let sawZone = false;
    let sawSlow = false;
    let sawBoost = false;
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({ characterIds: ['penguin', 'penguin', 'dog', 'monkey', 'bear'], seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      const trackLength = cfg.trackLength;
      for (let i = 1; i < frames.length; i++) {
        const f = frames[i];
        if (f.iceZones.length === 0) continue;
        sawZone = true;
        for (const z of f.iceZones) {
          // Zone is exposed with the contract shape.
          expect(z.startProgress).toBeGreaterThanOrEqual(0);
          expect(z.startProgress).toBeLessThan(trackLength);
          expect(z.length).toBeGreaterThan(0);
          for (const r of f.racers) {
            if (r.phase === 'stunned' || r.phase === 'finished' || r.phase === 'waiting') continue;
            const lap = r.progress % trackLength;
            const end = z.startProgress + z.length;
            const inside = end <= trackLength
              ? lap >= z.startProgress && lap < end
              : lap >= z.startProgress || lap < end - trackLength;
            if (!inside) continue;
            const prev = frames[i - 1].racers.find((p) => p.id === r.id)!;
            const step = r.progress - prev.progress;
            if (step <= 0) continue;
            if (r.characterId === 'penguin' && step > 1.5) sawBoost = true;
            if (r.characterId !== 'penguin' && step < 1.2) sawSlow = true;
          }
        }
      }
    }
    expect(sawZone).toBe(true);
    expect(sawBoost).toBe(true);
    expect(sawSlow).toBe(true);
  });

  it('icefield: the cat jumps over the ice with its dodgeChance (probabilistic exemption)', () => {
    // Force the cat's jump chance to 1: a roster of only penguins + cats has no
    // racer the slowFactor can touch (penguins boost, cats always jump), so the
    // race is byte-identical whatever slowFactor we pick. Forcing it to 0 makes the
    // cats slip ⇒ the same roster diverges with slowFactor — proving it's probabilistic.
    function run(catDodge: number, slowFactor: number) {
      const characters = structuredClone(characterCatalog);
      characters.cat.skill.params = { ...characters.cat.skill.params, dodgeChance: catDodge };
      characters.penguin.skill.params = { ...characters.penguin.skill.params, slowFactor };
      const cfg = { ...makeConfig({ characterIds: ['penguin', 'cat', 'penguin', 'cat'], seed: 9 }), characters };
      return simulateRace(cfg, skills, scoring);
    }
    const traj = (r: ReturnType<typeof run>) =>
      r.frames.map((f) => f.racers.map((x) => `${x.id}:${x.progress.toFixed(6)}`).join('|')).join('\n');

    expect(traj(run(1, 0.85))).toEqual(traj(run(1, 0.4)));
    expect(run(1, 0.85).frames.some((f) => f.iceZones.length > 0)).toBe(true);
    expect(traj(run(0, 0.85))).not.toEqual(traj(run(0, 0.4)));
  });

  it('is deterministic for the same (config, seed) on the new roster', () => {
    const cfg = () => makeConfig({ characterIds: ['dog', 'cat', 'monkey', 'eagle', 'bear'], seed: 7 });
    const a = simulateRace(cfg(), skills, scoring);
    const b = simulateRace(cfg(), skills, scoring);
    expect(a.result.order).toEqual(b.result.order);
    const evA = a.frames.flatMap((f) => f.events.map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`));
    const evB = b.frames.flatMap((f) => f.events.map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`));
    expect(evA).toEqual(evB);
  });
});
