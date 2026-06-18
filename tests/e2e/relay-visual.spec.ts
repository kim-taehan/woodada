import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';
const SEED = 7;
// 2 teams x 3 members. Legs = laps (cycle members[i % 3]). With laps=5 the
// per-team leg order is p0,p1,p2,p0,p1 — members p0/p1 re-enter (waiting again).
const TEAM_IDS = ['red', 'blue', 'red', 'blue', 'red', 'blue'];
const LAPS = 5;

test('relay: cycle legs, waiting queue, baton hand-off, leg counter', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'capture once on desktop');
  await page.goto('/');

  const sim = await page.evaluate(
    ([seed, teamIds, laps]) =>
      window.__woodada.simulate({ seed: seed as number, teamIds: teamIds as string[], relay: true, laps: laps as number }),
    [SEED, TEAM_IDS, LAPS] as const,
  );
  expect(sim.totalFrames).toBeGreaterThan(60);
  console.log('relay eventFrames', JSON.stringify(sim.eventFrames), 'total', sim.totalFrames);

  const handoff = sim.eventFrames['relay:handoff'];

  const captures: Record<string, number> = {
    'relay-start': 2,
    'relay-leg': Math.floor(sim.totalFrames * 0.5),
    'relay-final-leg': Math.floor(sim.totalFrames * 0.92),
  };
  if (handoff !== undefined) captures['relay-handoff'] = handoff + 1;

  for (const [name, frame] of Object.entries(captures)) {
    await page.evaluate(
      ([f, seed, teamIds, laps]) =>
        window.__woodada.showRaceAt(f as number, {
          seed: seed as number,
          teamIds: teamIds as string[],
          relay: true,
          laps: laps as number,
        }),
      [frame, SEED, TEAM_IDS, LAPS] as const,
    );
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }

  expect(sim.eventFrames).toHaveProperty('relay:handoff');
});
