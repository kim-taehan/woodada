import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';
const SEED = 7;
// Catwalk is now REACTIVE: the cat only fires it to dodge an incoming attack, so
// it no longer activates in the seed-7 roster. Capture/assert it from a seed where
// the cat actually reacts (activate + dodge in the same frame). Kept separate from
// SEED so the seed-7 goldens (start/mid/finish/etc.) don't drift.
// (Was 8; the lane-spread/side-separation engine change shifted who ends up
// shoulder-to-shoulder so the cat no longer gets attacked at seed 8 — repinned
// to 4, the lowest seed that still has catwalk activate+dodge in the DEFAULT_IDS
// roster. Then adding fox to DEFAULT_IDS shifted seed-4's collision geometry so
// the cat no longer reacts there either — repinned to 2, now the lowest seed
// with catwalk activate+dodge in the fox-inclusive roster.)
const CATWALK_SEED = 2;

// Deterministic visual verification (spec §13). Drives the engine headless to
// find skill-activation frames, then renders the canvas at those exact frames.

async function settle(page: import('@playwright/test').Page) {
  await page.waitForTimeout(250); // let Pixi paint the seeked frame
}

test('capture key race states', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');

  const sim = await page.evaluate((seed) => window.__woodada.simulate({ seed }), SEED);
  expect(sim.totalFrames).toBeGreaterThan(60);

  const captures: Record<string, number> = {
    'start': 0,
    'mid': Math.floor(sim.totalFrames / 2),
    'finish': sim.totalFrames - 1,
    'busiest': sim.busiestFrame,
  };
  // (catwalk is reactive → captured separately below from CATWALK_SEED.)
  for (const key of ['zoomies:activate', 'banana:activate', 'banana:hit', 'banana:dodge', 'divebomb:activate', 'divebomb:hit', 'roar:activate', 'icefield:activate']) {
    if (key in sim.eventFrames) captures[key.replace(':', '-')] = sim.eventFrames[key];
  }

  for (const [name, frame] of Object.entries(captures)) {
    await page.evaluate(
      ([f, seed]) => window.__woodada.showRaceAt(f as number, { seed: seed as number }),
      [frame, SEED] as const,
    );
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-${name}.png` });
  }

  // Signature skills that fire in the seed-7 roster.
  expect(sim.eventFrames).toHaveProperty('zoomies:activate');
  expect(sim.eventFrames).toHaveProperty('banana:activate');

  // Catwalk is reactive (cat dodges an incoming attack) → capture + assert it from
  // a seed where the cat actually reacts, so we still prove the catwalk FX.
  const catSim = await page.evaluate((seed) => window.__woodada.simulate({ seed }), CATWALK_SEED);
  expect(catSim.eventFrames).toHaveProperty('catwalk:activate');
  expect(catSim.eventFrames).toHaveProperty('catwalk:dodge'); // the dodge it reacted to
  await page.evaluate(
    ([f, seed]) => window.__woodada.showRaceAt(f as number, { seed: seed as number }),
    [catSim.eventFrames['catwalk:activate'], CATWALK_SEED] as const,
  );
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/race-catwalk-activate.png` });
});

test('FX & facing proof shots (curve / icefield / roar / divebomb self-botch)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');

  // Side-profile facing on the curves: dog/cat must look the way they travel
  // (left on the top straight + curves), front-facing & flyer unaffected.
  const sim = await page.evaluate((seed) => window.__woodada.simulate({ seed }), SEED);
  for (const [name, frac] of [['curve-top', 0.62], ['curve-left', 0.78]] as const) {
    const f = Math.floor(sim.totalFrames * frac);
    await page.evaluate(([ff, seed]) => window.__woodada.showRaceAt(ff as number, { seed: seed as number }), [f, SEED] as const);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-${name}.png` });
  }

  // Penguin icefield: capture a few frames after activation (patch is laid ahead)
  // so the slick cyan band is clearly on the track.
  if (sim.eventFrames['icefield:activate'] !== undefined) {
    await page.evaluate(([ff, seed]) => window.__woodada.showRaceAt((ff as number) + 16, { seed: seed as number }), [sim.eventFrames['icefield:activate'], SEED] as const);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-icefield-laid.png` });
  }

  // Penguin belly-slide: a frame where a penguin is actually inside an active
  // ice zone (prone, flippers back, gliding) — scan seeds for one.
  for (const seed of [SEED, 2, 5, 11, 19, 27, 33, 44]) {
    const s = await page.evaluate((sd) => window.__woodada.simulate({ seed: sd }), seed);
    if (s.penguinIceFrame < 0) continue;
    // A few frames in so the prone belly-slide pose has fully blended.
    await page.evaluate(([ff, sd]) => window.__woodada.showRaceAt((ff as number) + 6, { seed: sd as number }), [s.penguinIceFrame, seed] as const);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-penguin-slide.png` });
    break;
  }

  // Cat ice-hop: the nimble cat bounds clear over a penguin's icefield (engine
  // flags iceJumping) instead of slipping. Seed 35 puts the leading cat alone on
  // a fresh ice patch (others far back) → an unobstructed shot of the airborne
  // bound. Two frames straddle the hop arc (apex + lower) to prove it oscillates.
  {
    const s = await page.evaluate(() => window.__woodada.simulate({ seed: 35 }));
    if (s.catJumpFrame >= 0) {
      for (const [name, frameAt] of [['apex', 668], ['low', 672]] as const) {
        await page.evaluate((f) => window.__woodada.showRaceAt(f, { seed: 35 }), frameAt);
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/race-cat-icehop-${name}.png` });
      }
    }
  }

  // Eagle divebomb screen-space action: capture the rise → apex → plunge by
  // seeking a few frames past the activation (seek replays frames, advancing the
  // dive arc deterministically). +10≈rising, +26≈apex/plunge with the impact.
  if (sim.eventFrames['divebomb:activate'] !== undefined) {
    const a = sim.eventFrames['divebomb:activate'];
    for (const [name, off] of [['rise', 8], ['apex', 20], ['impact', 40]] as const) {
      await page.evaluate(([ff, seed]) => window.__woodada.showRaceAt(ff as number, { seed: seed as number }), [a + off, SEED] as const);
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/race-divebomb-${name}.png` });
    }
  }

  // Bear roar: a bear-led pack so the shockwave catches several at once; capture
  // a beat after the hit so the per-victim dizzy stagger develops (≠ banana).
  const ROAR_IDS = ['bear', 'dog', 'cat', 'monkey', 'penguin', 'spider'];
  for (const seed of [2, 5, 13, 21, 33, 41]) {
    const s = await page.evaluate((sd) => window.__woodada.simulate({ seed: sd, characterIds: ['bear', 'dog', 'cat', 'monkey', 'penguin', 'spider'] }), seed);
    if (s.eventFrames['roar:hit'] === undefined) continue;
    await page.evaluate(([ff, sd, ids]) => window.__woodada.showRaceAt((ff as number) + 2, { seed: sd as number, characterIds: ids as string[] }), [s.eventFrames['roar:hit'], seed, ROAR_IDS] as const);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-roar-hit.png` });
    break;
  }

  // Eagle divebomb self-botch (lost gamble, crashes itself): scan seeds for it,
  // capture a couple frames after so the self-crash dust/dizzy reads.
  for (let seed = 1; seed <= 60; seed++) {
    const s = await page.evaluate((sd) => window.__woodada.simulate({ seed: sd }), seed);
    if (s.divebombSelfFrame < 0) continue;
    // +30 frames ≈ the bottom of the screen-space dive, where the self-crash
    // dust/dizzy impact lands.
    await page.evaluate(([ff, sd]) => window.__woodada.showRaceAt((ff as number) + 30, { seed: sd as number }), [s.divebombSelfFrame, seed] as const);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-divebomb-self.png` });
    break;
  }
});

test('lap counter + final-lap banner on a multi-lap race', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');
  const sim = await page.evaluate((seed) => window.__woodada.simulate({ seed, laps: 2 }), SEED);
  expect(sim.finalLapFrame).toBeGreaterThan(0);
  await page.evaluate(
    ([f, seed]) => window.__woodada.showRaceAt(f as number, { seed: seed as number, laps: 2 }),
    [sim.finalLapFrame + 8, SEED] as const,
  );
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/race-lastlap.png` });
});

test('post-finish coast → free scatter → emote by rank (#33)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');
  const sim = await page.evaluate((seed) => window.__woodada.simulate({ seed }), SEED);
  // Seek PAST the last finish (so every racer has crossed) then advance the
  // renderer's display-only finish-clock so all have coasted past the line,
  // scattered freely, and settled into their rank emote (top-3 cheer / dead-last
  // slump / middle idle). Display-only — the engine outcome is unchanged.
  await page.evaluate(
    ([f, seed]) => window.__woodada.showRaceAt(f as number, { seed: seed as number, settleFrames: 70 }),
    [sim.totalFrames + 5, SEED] as const,
  );
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/race-finish-scatter.png` });
});

test('death-match: centre knock-out pile + first/last emotion', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');
  // Death-match eliminates one racer per lap boundary, so it needs several laps.
  const LAPS = 5;
  for (const mode of ['first', 'last'] as const) {
    const sim = await page.evaluate(
      ([m, l]) => window.__woodada.simulate({ elimination: m as 'first' | 'last', laps: l as number, seed: 7 }),
      [mode, LAPS] as const,
    );
    // The first knock-out fires at the first lap boundary → an `eliminate:out`
    // event. seek() stops one frame before its target (renders frameIndex-1), so
    // seek to outFrame + a few frames to actually render the knock-out frame and
    // let the impact FX (환호/좌절), head bubble, and elimination subtitle develop.
    const outFrame = sim.eventFrames['eliminate:out'];
    expect(outFrame, `${mode} should produce an eliminate:out event`).toBeGreaterThan(0);
    await page.evaluate(
      ([f, m, l]) => window.__woodada.showRaceAt((f as number) + 6, { elimination: m as 'first' | 'last', laps: l as number, seed: 7 }),
      [outFrame, mode, LAPS] as const,
    );
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-deathmatch-${mode}-knockout.png` });

    // Near the end: most of the field is knocked out and settled into the centre
    // horizontal row (ordered by eliminationOrder), holding the mode's emotion.
    await page.evaluate(
      ([f, m, l]) => window.__woodada.showRaceAt(f as number, { elimination: m as 'first' | 'last', laps: l as number, seed: 7 }),
      [sim.totalFrames - 2, mode, LAPS] as const,
    );
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/race-deathmatch-${mode}-pile.png` });
  }
});

test('reduced-motion renders without particles but same field', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');
  const sim = await page.evaluate((seed) => window.__woodada.simulate({ seed }), SEED);
  await page.evaluate(
    ([f, seed]) => window.__woodada.showRaceAt(f as number, { seed: seed as number, reducedMotion: true }),
    [Math.floor(sim.totalFrames / 2), SEED] as const,
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/race-reduced-motion.png` });
});
