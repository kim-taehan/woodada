import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';

// End-to-end: setup → start → countdown → race → finish gate → result + records.
test('plays a full race and shows results with records', async ({ page }, info) => {
  test.setTimeout(45_000);
  await page.goto('/');

  // Individual mode (default): add 3 participants via the "+ 참가자 추가" button.
  const addBtn = page.locator('.add-btn');
  for (let i = 0; i < 3; i++) await addBtn.click();
  await expect(page.locator('.participant')).toHaveCount(3);

  await page.locator('button.start').click();

  // Skip the countdown for a faster, deterministic-ish test.
  const skip = page.locator('button.skip');
  await skip.click().catch(() => {});

  // Feature C: the race ends on a "시상식 보러가기" gate, not the podium directly.
  const gate = page.locator('button.podium-gate');
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.result-overlay')).toHaveCount(0);
  // force: the gate gently bobs (CSS animation), which Playwright reads as unstable.
  await gate.click({ force: true });

  const overlay = page.locator('.result-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.rank-row')).toHaveCount(3);
  // Feature B: this-race + best-time records are shown.
  await expect(page.locator('.records .record-time')).toHaveCount(2);

  if (info.project.name === 'desktop') {
    await page.waitForTimeout(600); // let the podium celebration animate
    await page.screenshot({ path: `${SHOTS}/result.png` });
  }
});
