import { test, expect } from '@playwright/test';

const OUT = 'tests/e2e/__screens__/relay-podium';

// Live verification of the relay podium: whole winning TEAM celebrates (not just
// the anchor). Drive setup → 팀전 + 이어달리기 + members per team → 출발 → skip →
// finish gate → 시상식 보러가기 → podium. Then confirm a cluster of same-team
// animals celebrates on the 1st block. (Also captures a race frame to eyeball the
// finish tape.) Uses the config's webServer/baseURL like the other specs.
test('relay winning team celebrates on the podium', async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  // Team mode + relay. Relay is now the '이어달리기' team-scoring option (no
  // separate toggle). Keep it short (2 laps → 2 legs) so the race finishes fast.
  await page.locator('button.mode-btn', { hasText: '팀전' }).click();
  await page.locator('select[aria-label="팀 모드"]').selectOption('relay');
  await page.locator('select[aria-label="바퀴 수"]').selectOption('2');

  // Add 3 members to each of the 2 default teams.
  const teamBoxes = page.locator('.team-box');
  await expect(teamBoxes).toHaveCount(2);
  for (let t = 0; t < 2; t++) {
    const add = teamBoxes.nth(t).locator('button.add-btn');
    for (let i = 0; i < 3; i++) {
      await add.click();
      await page.waitForTimeout(40);
    }
  }

  const start = page.locator('button.start');
  await expect(start).toBeEnabled({ timeout: 5000 });
  await start.click();

  // Skip countdown.
  await page.locator('button.skip').click({ timeout: 5000 }).catch(() => {});

  // Mid-race: grab a frame to eyeball the finish tape position (~0.21).
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}-race.png` });

  // Wait for finish, then open the podium.
  const gate = page.locator('button.podium-gate');
  await expect(gate).toBeVisible({ timeout: 90000 });
  await page.screenshot({ path: `${OUT}-gate.png` });
  // The gate button has a pulsing CSS animation → never "stable" for Playwright.
  // Force the click (we only need to trigger its handler).
  await gate.click({ force: true });

  // Podium tableau: let the celebrate animation run a beat, then two frames apart.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}-A.png` });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}-B.png` });
  console.log('relay podium captured');
});
