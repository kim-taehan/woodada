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
    // catwalk is now REACTIVE too (no self-activation tick; it only emits 'activate'
    // when it actually dodges an incoming hit) — covered by its own dodge test below.
    // illusionClone is a standard tick-driven self-activating skill (eng-fox confirmed).
    const expected = ['abduct', 'banana', 'icefield', 'illusionClone', 'roar', 'zoomies'];
    const seen = new Set<string>();
    // Full roster ×2 (16 racers) so the spider's abduct has dense targets ahead. The
    // field-size cooldown scaling (×2 at 16) thins skill density, so the seed budget is
    // wider than before to still let the slowest skill (icefield) fire at least once.
    // (catwalk/bristle also emit 'activate' now but aren't in `expected`, so we break
    // only once every EXPECTED type is seen — not on raw set size.)
    const allSeen = () => expected.every((t) => seen.has(t));
    for (let s = 0; s < 200 && !allSeen(); s++) {
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
    const alienId = 'p0';
    const alienCopies = (r: ReturnType<typeof simulateRace>) =>
      r.frames.some((f) =>
        f.events.some((e) => e.racerId === alienId && e.type === 'mimic' && e.variant === 'activate'),
      );

    // ROBUSTNESS (seed-stable, not a single hand-picked seed): the alien must copy in the
    // large majority of seeds — whether any ONE seed yields a copy depends on whether a
    // copyable racer drifts into scan range, which shifts with engine tuning. Sampling
    // avoids the test going red just because the chosen seed stops producing a copy.
    const SAMPLE = 20;
    let copySeeds = 0;
    for (let s = 0; s < SAMPLE; s++) {
      if (alienCopies(simulateRace(makeConfig({ characterIds: roster, seed: s }), skills, scoring))) copySeeds++;
    }
    expect(copySeeds).toBeGreaterThanOrEqual(15); // mimic reliably fires (≈17/20 in practice)

    // Detailed structural + determinism checks run on the FIRST sampled seed that copies,
    // so they always have a real mimic activation to assert against (no fixed-seed brittleness).
    let detailSeed = 0;
    for (let s = 0; s < SAMPLE; s++) {
      if (alienCopies(simulateRace(makeConfig({ characterIds: roster, seed: s }), skills, scoring))) {
        detailSeed = s;
        break;
      }
    }
    const cfg = () => makeConfig({ characterIds: roster, seed: detailSeed });
    const a = simulateRace(cfg(), skills, scoring);
    const b = simulateRace(cfg(), skills, scoring);
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

    // Every alien event is either the mimic marker, an 'item' event (the alien can pick up
    // item boxes like anyone — orthogonal to mimic), or a copied effect stamped with a real
    // copyable (self-activating) type — never the alien firing 'bristle' (reaction-only) or
    // recursively copying 'mimic'. illusionClone is also excluded from mimic's copy target
    // (eng-fox confirmed: canCopySkill rejects 'illusionClone').
    const copyable = ['zoomies', 'catwalk', 'banana', 'roar', 'icefield', 'abduct'];
    for (const s of evA) {
      const type = s.split(':')[1];
      const variant = s.split(':')[2];
      if (type === 'mimic') {
        expect(variant).toBe('activate'); // the only 'mimic'-typed event is the marker
        continue;
      }
      if (type === 'item') continue; // item-box pickup — not a mimic copy
      expect(copyable).toContain(type);
      // mimic must never emit an illusionClone event (copy-blocked in engine).
      expect(type).not.toBe('illusionClone');
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

  it('catwalk (reactive): a dodged roar lands no stun + the cat plays its own catwalk activate', () => {
    // REACTIVE just-dodge: catwalk has no pre-armed window — it reacts the instant a
    // disruption targets the cat (cooldown permitting). roar has no dodgeChance of its
    // own, so a roar 'dodge' on a non-starred cat can only be catwalk's. When it
    // happens: (1) no roar 'hit' lands on that cat this frame, and (2) the cat emits
    // its OWN catwalk 'activate' the same frame (so the renderer can play catwalk).
    let sawCatDodge = false;
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({ characterIds: ['cat', 'cat', 'monkey', 'penguin', 'bear'], seed: s });
      const catIds = new Set(cfg.participants.filter((p) => p.characterId === 'cat').map((p) => p.id));
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.variant !== 'dodge' || e.type !== 'roar' || !e.targetId || !catIds.has(e.targetId)) continue;
          const cat = f.racers.find((r) => r.id === e.targetId)!;
          // A starred cat deflects without a catwalk dodge — skip those.
          if ((cat.skill.starUntil ?? 0) > f.frame) continue;
          sawCatDodge = true;
          // (1) No roar 'hit' may also land on the same cat this frame.
          const stunnedNow = f.events.some(
            (ev) => ev.targetId === e.targetId && ev.variant === 'hit' && ev.type === 'roar',
          );
          expect(stunnedNow).toBe(false);
          // (2) The cat emitted its own catwalk activate this frame (reactive cue).
          const catwalkActivate = f.events.some(
            (ev) => ev.racerId === e.targetId && ev.type === 'catwalk' && ev.variant === 'activate',
          );
          expect(catwalkActivate).toBe(true);
        }
      }
    }
    expect(sawCatDodge).toBe(true);
  });

  it('catwalk (reactive): deterministic, and at chance=1 any cat that IS hit was on cooldown', () => {
    // The roll forks the cat's own sub-stream by frame → SAME (cat, frame) ⇒ SAME
    // outcome (determinism). With dodgeChance forced to 1, catwalk dodges every
    // incoming hit IT IS ALLOWED TO (cooldown ready). So if a banana/roar/item ever
    // lands a 'hit' on the cat, it can only be because catwalk was still on cooldown:
    // in that frame's snapshot the cat must show skillCooldownUntil > frame. We must
    // also actually SEE the cat dodge at least once (the mechanic is live).
    function run(dodgeChance: number, seed: number) {
      const characters = structuredClone(characterCatalog);
      characters.cat.skill.params = { ...characters.cat.skill.params, dodgeChance };
      const cfg = { ...makeConfig({ characterIds: ['cat', 'monkey', 'bear', 'penguin'], seed }), characters };
      return simulateRace(cfg, skills, scoring);
    }
    const ev = (r: ReturnType<typeof run>) =>
      r.frames.flatMap((f) => f.events.map((e) => `${f.frame}:${e.type}:${e.variant}:${e.targetId ?? ''}`));
    expect(ev(run(1, 11))).toEqual(ev(run(1, 11))); // determinism (same seed ⇒ same race)

    // Robust over a sample of seeds: whether a given seed even lands a dodgeable hit on the
    // cat is brittle (lane/overtake dynamics decide it), so the INVARIANT — a hit only lands
    // while catwalk is on cooldown — is checked in every seed, and we require the dodge
    // mechanic to be seen live in at least one.
    const catId = 'p0'; // first participant is the cat
    let sawCatwalkDodge = false;
    for (let seed = 0; seed < 20; seed++) {
      for (const f of run(1, seed).frames) {
        for (const e of f.events) {
          if (e.racerId === catId && e.type === 'catwalk' && e.variant === 'dodge') sawCatwalkDodge = true;
          if (e.targetId !== catId || e.variant !== 'hit') continue;
          if (!['banana', 'roar', 'item'].includes(e.type)) continue;
          // chance=1 ⇒ a hit only gets through while catwalk is on cooldown.
          const cat = f.racers.find((r) => r.id === catId)!;
          expect(cat.skillCooldownUntil).toBeGreaterThan(f.frame);
        }
      }
    }
    expect(sawCatwalkDodge).toBe(true);
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

  it('icefield: the airborne alien is exempt from the slow (floats over the ice)', () => {
    // The alien rides a UFO (airborne trait) so a ground hazard can't slip it: no
    // boost, no slow, just no contact. Two assertions:
    //  (1) IN-ZONE A/B: re-run every seed with the alien grounded (airborne:false)
    //      as the only change, and compare the alien's MEAN per-frame step *while it is
    //      inside a live ice zone*. Removing the slip raises that mean (gliding vs
    //      slipping), so the exempt mean must be STRICTLY greater. We measure the buff
    //      at its source (per-frame ice multiplier) rather than via finish progress:
    //      catch-up rubberbanding equalizes finish totals across the two arms, so the
    //      finish-progress aggregate sits in the noise floor and is not a stable signal.
    //      To keep this a clean test of the ICE mechanic (not of balance), we pin a
    //      local catalog where the alien's mimic is disabled (huge cooldown) and stats
    //      fixed in BOTH arms — so `airborne` is the sole difference and balance-tuner
    //      can retune the real alien.skill.params freely without disturbing this gate.
    //  (2) LIVENESS: in the exempt run, a co-located non-penguin non-alien still
    //      slips inside the zone (< 1.2), proving the zone is genuinely active — the
    //      exemption is alien-only, not a blanket no-op. (We don't assert a per-frame
    //      floor on the alien itself: its step can dip below cruise from traffic /
    //      catch-up, unrelated to ice — only the ice multiplier is what's removed,
    //      which the aggregate A/B in (1) measures.)
    //
    // Pinned alien: mimic effectively off (cooldown far past any race) + fixed stats,
    // so this test is invariant to alien.skill.params / speed / power tuning.
    const pinnedAlien = {
      ...characterCatalog.alien,
      speed: 3,
      power: 3,
      skill: { ...characterCatalog.alien.skill, cooldownMs: [1e9, 1e9] as [number, number] },
    };
    const exemptCat = { ...characterCatalog, alien: { ...pinnedAlien, airborne: true } };
    const grounded = { ...characterCatalog, alien: { ...pinnedAlien, airborne: false } };
    const roster = ['penguin', 'penguin', 'alien', 'dog', 'monkey'];
    const trackLength = 1000;
    let sawZone = false;
    let sawSlow = false; // a non-penguin, non-alien still slips inside the zone
    let sawAlienInZone = false; // the alien actually sat in a live zone

    const lapPos = (p: number) => p % trackLength;
    const inZone = (lap: number, z: { startProgress: number; length: number }): boolean => {
      const end = z.startProgress + z.length;
      return end <= trackLength
        ? lap >= z.startProgress && lap < end
        : lap >= z.startProgress || lap < end - trackLength;
    };
    // Sum the alien's forward step + the frames it spent inside a live zone, so we
    // can compare the MEAN in-zone step between the two arms (the direct ice signal).
    function alienInZone(race: ReturnType<typeof simulateRace>): { step: number; frames: number } {
      let step = 0;
      let frames = 0;
      for (let i = 1; i < race.frames.length; i++) {
        const f = race.frames[i];
        if (f.iceZones.length === 0) continue;
        for (const z of f.iceZones) {
          for (const r of f.racers) {
            if (r.phase === 'stunned' || r.phase === 'finished' || r.phase === 'waiting') continue;
            if (!inZone(lapPos(r.progress), z)) continue;
            const prev = race.frames[i - 1].racers.find((p) => p.id === r.id)!;
            const ds = r.progress - prev.progress;
            if (ds <= 0) continue;
            if (r.characterId === 'alien') {
              sawAlienInZone = true;
              sawZone = true;
              step += ds;
              frames++;
            }
            // A grounded non-penguin still slips, so the zone is genuinely active.
            if (r.characterId !== 'penguin' && r.characterId !== 'alien' && ds < 1.2) sawSlow = true;
          }
        }
      }
      return { step, frames };
    }

    let exemptStep = 0,
      exemptFrames = 0,
      groundedStep = 0,
      groundedFrames = 0;
    for (let s = 0; s < 40; s++) {
      const exempt = simulateRace(
        { ...makeConfig({ characterIds: roster, seed: s }), characters: exemptCat },
        skills,
        scoring,
      );
      const ctrl = simulateRace(
        { ...makeConfig({ characterIds: roster, seed: s }), characters: grounded },
        skills,
        scoring,
      );
      const e = alienInZone(exempt);
      const g = alienInZone(ctrl);
      exemptStep += e.step;
      exemptFrames += e.frames;
      groundedStep += g.step;
      groundedFrames += g.frames;
    }
    // (1) The exemption is a real, positive buff: the alien glides faster per frame
    // while inside the ice than when grounded (no slip vs slip). Measured at the
    // source (per-frame step), so catch-up doesn't wash it out.
    expect(exemptStep / exemptFrames).toBeGreaterThan(groundedStep / groundedFrames);
    expect(sawAlienInZone).toBe(true);
    expect(sawZone).toBe(true);
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
    const cfgFor = (seed: number) =>
      makeConfig({
        characterIds: roster,
        seed,
        teamMode: true,
        scoringId: 'teamRankSum',
        teamIds: ['A', 'A', 'B', 'B', 'C', 'C'],
      });
    const ev = (r: ReturnType<typeof simulateRace>) =>
      r.frames.flatMap((f) =>
        f.events
          .filter((e) => e.type === 'bristle')
          .map((e) => `${f.frame}:${e.variant}:${e.racerId}:${e.targetId ?? ''}`),
      );
    const bristleHits = (r: ReturnType<typeof simulateRace>) => ev(r).some((s) => s.includes(':hit:'));

    // ROBUSTNESS (seed-stable, not a single hand-picked seed): whether bristle lands a
    // 'hit' on a given seed depends on whether a non-teammate actually overtakes the
    // hedgehog, which shifts with engine tuning. Sample many seeds so the test asserts the
    // mechanic works *in general* rather than going red when one seed stops producing a hit.
    const SAMPLE = 20;
    let hitSeeds = 0;
    let detailSeed = -1;
    for (let s = 0; s < SAMPLE; s++) {
      if (bristleHits(simulateRace(cfgFor(s), skills, scoring))) {
        hitSeeds++;
        if (detailSeed < 0) detailSeed = s;
      }
    }
    expect(hitSeeds).toBeGreaterThanOrEqual(8); // bristle engages in most seeds (≈11/20 in practice — overtakes are rarer once the inner-rail pull clusters the field)

    // Detailed determinism + team-exclusion checks run on the first sampled seed that hits,
    // so they always have a real bristle hit to assert against (no fixed-seed brittleness).
    const cfg = () => cfgFor(detailSeed);
    const a = simulateRace(cfg(), skills, scoring);
    const b = simulateRace(cfg(), skills, scoring);
    expect(ev(a)).toEqual(ev(b)); // hook order is deterministic

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

  it('banana throws BOTH forward and backward (target: either)', () => {
    // The monkey now targets the nearest racer ahead OR behind (random each throw).
    // Across many races we must see banana hits on a target BOTH ahead of and behind
    // the thrower (proving bidirectional targeting, not just front).
    let sawForward = false;
    let sawBackward = false;
    for (let s = 0; s < 60 && !(sawForward && sawBackward); s++) {
      const cfg = makeConfig({ characterIds: ['monkey', 'dog', 'cat', 'bear', 'penguin'], seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const e of f.events) {
          if (e.type !== 'banana' || e.variant !== 'hit' || !e.targetId) continue;
          const thrower = f.racers.find((r) => r.id === e.racerId)!;
          const target = f.racers.find((r) => r.id === e.targetId)!;
          if (target.progress > thrower.progress) sawForward = true;
          else if (target.progress < thrower.progress) sawBackward = true;
        }
      }
    }
    expect(sawForward).toBe(true);
    expect(sawBackward).toBe(true);
  });

  it('skill i-frames: a racer is immune to disruption for ~0.3s after it activates', () => {
    // The instant a racer activates its own skill it gets ~300ms of i-frames. While
    // active, an incoming disruption (banana/roar/abduct/bristle/item) cannot land a
    // 'hit' on it — at most a 'dodge' (shrug-off). We assert no 'hit' ever targets a
    // racer whose skillInvulnUntil is still in the future that frame.
    let sawInvuln = false;
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({ characterIds: ['dog', 'monkey', 'bear', 'spider', 'hedgehog', 'cat'], seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (const f of frames) {
        for (const r of f.racers) if ((r.skill.skillInvulnUntil ?? 0) > f.frame) sawInvuln = true;
        for (const e of f.events) {
          if (e.variant !== 'hit' || !e.targetId) continue;
          if (!['banana', 'roar', 'abduct', 'bristle', 'item'].includes(e.type)) continue;
          const target = f.racers.find((r) => r.id === e.targetId)!;
          // An i-framed racer must never be the victim of a landed disruption hit.
          expect((target.skill.skillInvulnUntil ?? 0) > f.frame).toBe(false);
        }
      }
    }
    expect(sawInvuln).toBe(true); // the mechanic actually engaged
  });

  it('stun resets the victim\'s skill cooldown past the stun (no instant skill on recovery)', () => {
    // When a racer is freshly stunned, its skill cooldown is pushed to (at least) the
    // stun's end + a fresh roll, so it can't fire the instant it recovers. We capture
    // the frame a racer ENTERS stunned and assert its cooldown now ends strictly after
    // its stun ends (effectUntil).
    let sawReset = false;
    for (let s = 0; s < 40; s++) {
      const cfg = makeConfig({ characterIds: ['monkey', 'bear', 'dog', 'penguin', 'hedgehog'], seed: s });
      const { frames } = simulateRace(cfg, skills, scoring);
      for (let i = 1; i < frames.length; i++) {
        for (const r of frames[i].racers) {
          if (r.phase !== 'stunned') continue;
          const prev = frames[i - 1].racers.find((p) => p.id === r.id)!;
          if (prev.phase === 'stunned') continue; // not freshly stunned this frame
          const stunEnd = r.skill.effectUntil ?? frames[i].frame;
          // Cooldown must extend past the stun end (reset applied = recovery delay).
          expect(r.skillCooldownUntil).toBeGreaterThan(stunEnd);
          sawReset = true;
        }
      }
    }
    expect(sawReset).toBe(true);
  });
});
