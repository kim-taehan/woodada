import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';
const SEED = 7;

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
  for (const key of ['zoomies:activate', 'catwalk:activate', 'banana:activate', 'banana:hit', 'banana:dodge', 'snatch:activate', 'snatch:hit', 'roar:activate']) {
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

  // At least the three signature skills must have fired in this seed.
  expect(sim.eventFrames).toHaveProperty('zoomies:activate');
  expect(sim.eventFrames).toHaveProperty('catwalk:activate');
  expect(sim.eventFrames).toHaveProperty('banana:activate');
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
