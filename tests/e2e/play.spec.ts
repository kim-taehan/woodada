import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';

// End-to-end: setup → start → countdown → race → result, with a lottery mapping.
test('plays a full race and shows results with lottery mapping', async ({ page }, info) => {
  test.setTimeout(45_000);
  await page.goto('/');

  const input = page.locator('input[aria-label="participant name"]');
  for (const name of ['철수', '영희', '민수']) {
    await input.fill(name);
    await input.press('Enter');
  }

  // Set a lottery result for 1st place (spec §6).
  await page.locator('details.options summary').click();
  const firstPrize = page.locator('.mapping-grid input').first();
  await firstPrize.fill('커피 쏘기');

  await page.locator('button.start').click();

  // Skip the countdown for a faster, deterministic-ish test.
  const skip = page.locator('button.skip');
  await skip.click().catch(() => {});

  const overlay = page.locator('.result-overlay');
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.rank-row')).toHaveCount(3);
  // The winner row shows the lottery prize.
  await expect(page.locator('.rank-row.first .prize')).toHaveText('커피 쏘기');

  if (info.project.name === 'desktop') {
    await page.waitForTimeout(600); // let the podium celebration animate
    await page.screenshot({ path: `${SHOTS}/result.png` });
  }
});
