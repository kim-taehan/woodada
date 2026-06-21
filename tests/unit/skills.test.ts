import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { makeConfig, allThree } from './helpers.ts';
import { characterCatalog } from '../../src/data/characters/index.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

describe('skill behaviour', () => {
  it('all self-activating character skills activate over the course of races', () => {
    // bristle is reaction-only (onOvertaken; no 'activate' emit) and mimic emits the
    // COPIED skill's type (not 'mimic'), so neither shows up as its own 'activate'
    // here — bristle is covered by its own hook test, mimic by the copy test below.
    const expected = ['abduct', 'banana', 'catwalk', 'icefield', 'roar', 'zoomies'];
    const seen = new Set<string>();
    for (let s = 0; s < 80 && seen.size < expected.length; s++) {
      const { frames } = simulateRace(makeConfig({ characterIds: [...allThree, ...allThree], seed: s }), skills, scoring);
      for (const f of frames) for (const e of f.events) if (e.variant === 'activate') seen.add(e.type);
    }
    for (const type of expected) expect([...seen]).toContain(type);
  });

  it('abduct yanks the nearest racer ahead back behind the spider + tangles it', () => {
    // Deterministic (no gamble): on a hit the target must end up BEHIND the spider
    // and carry a slow (tangle). Never a teammate; never targets behind. No cats so
    // dodge never intervenes.
    let sawHit = false;
    for (let s = 0; s < 60; s++) {
      const cfg = makeConfig({ characterIds: ['spider', 'dog', 'monkey', 'bear', 'penguin'], seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.type !== 'abduct' || e.variant !== 'hit' || !e.targetId) continue;
          sawHit = true;
          const spider = f.racers.find((r) => r.id === e.racerId)!;
          const target = f.racers.find((r) => r.id === e.targetId)!;
          // Yanked behind the spider this frame, and tangled (slow active now).
          expect(target.progress).toBeLessThanOrEqual(spider.progress);
          expect((target.skill.slowUntil ?? 0) > f.frame).toBe(true);
        }
      }
    }
    expect(sawHit).toBe(true);
  });

  it('abduct never yanks a teammate (relay/team exclusion)', () => {
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({
        characterIds: ['spider', 'spider', 'dog', 'dog'],
        seed: s,
        teamMode: true,
        scoringId: 'teamRankSum',
        teamIds: ['A', 'A', 'B', 'B'],
      });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.type !== 'abduct' || e.variant !== 'hit' || !e.targetId) continue;
          const thrower = cfg.participants.find((p) => p.id === e.racerId)!;
          const target = cfg.participants.find((p) => p.id === e.targetId)!;
          expect(target.teamId).not.toBe(thrower.teamId);
        }
      }
    }
  });

  it('mimic copies the nearest racer\'s skill and fires it AS the alien, deterministically', () => {
    // The alien has no fixed effect: it emits events stamped with the COPIED type,
    // attributed to the alien (racerId = alien). Same (config, seed) must replay the
    // alien's emitted event stream identically (alien-only sub-stream, stable order).
    const roster = ['alien', 'dog', 'monkey', 'bear', 'spider', 'penguin'];
    const cfg = () => makeConfig({ characterIds: roster, seed: 21 });
    const a = simulateRace(cfg(), skills, scoring);
    const b = simulateRace(cfg(), skills, scoring);
    const alienId = 'p0';
    const ev = (r: ReturnType<typeof simulateRace>) =>
      r.frames.flatMap((f) =>
        f.events
          .filter((e) => e.racerId === alienId)
          .map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`),
      );
    const evA = ev(a);
    expect(evA).toEqual(ev(b)); // deterministic replay

    // The alien emits a "따라하기" marker (type 'mimic', variant 'activate',
    // targetId = the copied owner) on a successful copy, followed by the copied
    // skill's own events (stamped with the COPIED type). It must have copied at
    // least once, so a marker must exist with a real owner targetId.
    const markers = a.frames.flatMap((f) =>
      f.events.filter((e) => e.racerId === alienId && e.type === 'mimic' && e.variant === 'activate'),
    );
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) expect(m.targetId).toBeTruthy(); // owner of the copied skill

    // The marker is the FIRST alien event of that activation: in the same frame, no
    // alien NON-mimic event may precede a mimic marker.
    for (const f of a.frames) {
      const mine = f.events.filter((e) => e.racerId === alienId);
      const firstMarkerIdx = mine.findIndex((e) => e.type === 'mimic' && e.variant === 'activate');
      if (firstMarkerIdx < 0) continue;
      const copiedBeforeMarker = mine.slice(0, firstMarkerIdx).some((e) => e.type !== 'mimic');
      expect(copiedBeforeMarker).toBe(false);
    }

    // Every alien event is either the mimic marker, or a copied effect stamped with a
    // real copyable (self-activating) type — never the alien firing 'bristle'
    // (reaction-only) or recursively copying 'mimic'.
    const copyable = ['zoomies', 'catwalk', 'banana', 'roar', 'icefield', 'abduct'];
    for (const s of evA) {
      const type = s.split(':')[1];
      const variant = s.split(':')[2];
      if (type === 'mimic') {
        expect(variant).toBe('activate'); // the only 'mimic'-typed event is the marker
        continue;
      }
      expect(copyable).toContain(type);
    }
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
    // Probabilistic now (not guaranteed immunity). Whenever a roar (which has
    // no dodgeChance of its own — a dodge there can only be catwalk's) hits
    // a cat that is in its dodge window, the cat avoids it and is not stunned.
    let sawCatDodge = false;
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({ characterIds: ['cat', 'cat', 'monkey', 'penguin', 'bear'], seed: s });
      const catIds = new Set(cfg.participants.filter((p) => p.characterId === 'cat').map((p) => p.id));
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.variant !== 'dodge' || !e.targetId || !catIds.has(e.targetId)) continue;
          if (!['roar'].includes(e.type)) continue;
          const cat = f.racers.find((r) => r.id === e.targetId)!;
          // roar has no self dodgeChance, so a dodge on a cat is either a
          // catwalk dodge (cat in its dodge window) OR a ⭐ star deflect (cat has an
          // active star). A starred cat may dodge without being in its catwalk window.
          if ((cat.skill.starUntil ?? 0) > f.frame) continue;
          sawCatDodge = true;
          expect((cat.skill.dodgeUntil ?? 0) > f.frame).toBe(true);
          // A dodge avoids *this* incoming disruption: no roar may also
          // land a 'hit' on the same cat this frame. (We don't assert phase!=
          // 'stunned' outright — a residual stun from an EARLIER frame can still
          // be in effect; the dodge only guarantees no NEW stun lands now.)
          const stunnedNow = f.events.some(
            (ev) =>
              ev.targetId === e.targetId &&
              ev.variant === 'hit' &&
              ['roar'].includes(ev.type),
          );
          expect(stunnedNow).toBe(false);
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
      const cfg = { ...makeConfig({ characterIds: ['cat', 'monkey', 'bear', 'penguin'], seed: 11 }), characters };
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
        if (!['banana', 'roar', 'item'].includes(e.type)) continue;
        // While in window, an attack on the cat must dodge, never hit.
        const cat = f.racers.find((r) => r.id === e.targetId)!;
        if ((cat.skill.dodgeUntil ?? 0) > f.frame && e.variant === 'hit') {
          throw new Error(`cat was hit while dodgeChance=1 at frame ${f.frame}`);
        }
      }
    }
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

  it('bristle (onOvertaken hook) fires on real overtakes, deterministically, never on a teammate', () => {
    // TODO #7: bristle is now driven by the engine onOvertaken hook (fires the
    // frame a non-teammate crosses ahead). Same (config, seed) must replay the
    // hook's event stream identically (order-stable across simultaneous overtakes),
    // and a hedgehog must never counter (shove/slow) a teammate that passes it.
    const roster = ['hedgehog', 'hedgehog', 'dog', 'monkey', 'penguin', 'bear'];
    const cfg = () =>
      makeConfig({
        characterIds: roster,
        seed: 13,
        teamMode: true,
        scoringId: 'teamRankSum',
        teamIds: ['A', 'A', 'B', 'B', 'C', 'C'],
      });
    const a = simulateRace(cfg(), skills, scoring);
    const b = simulateRace(cfg(), skills, scoring);
    const ev = (r: ReturnType<typeof simulateRace>) =>
      r.frames.flatMap((f) =>
        f.events
          .filter((e) => e.type === 'bristle')
          .map((e) => `${f.frame}:${e.variant}:${e.racerId}:${e.targetId ?? ''}`),
      );
    const evA = ev(a);
    expect(evA).toEqual(ev(b)); // hook order is deterministic

    // Bristle must have actually engaged via the hook (real overtake counters).
    expect(evA.some((s) => s.includes(':hit:'))).toBe(true);

    // Team-exclusion: a bristle 'hit' target must never be the hedgehog's teammate.
    const part = cfg().participants;
    for (const f of a.frames) {
      for (const e of f.events) {
        if (e.type !== 'bristle' || e.variant !== 'hit' || !e.targetId) continue;
        const owner = part.find((p) => p.id === e.racerId)!;
        const victim = part.find((p) => p.id === e.targetId)!;
        expect(victim.teamId).not.toBe(owner.teamId);
      }
    }
  });

  it('is deterministic for the same (config, seed) on the new roster', () => {
    const cfg = () => makeConfig({ characterIds: ['dog', 'cat', 'monkey', 'penguin', 'bear'], seed: 7 });
    const a = simulateRace(cfg(), skills, scoring);
    const b = simulateRace(cfg(), skills, scoring);
    expect(a.result.order).toEqual(b.result.order);
    const evA = a.frames.flatMap((f) => f.events.map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`));
    const evB = b.frames.flatMap((f) => f.events.map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`));
    expect(evA).toEqual(evB);
  });
});
