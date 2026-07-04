import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';

// End-to-end: setup → start → countdown → race → finish gate → result + records.
test('plays a full race and shows results with records', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto('/');

  // 1 lap so the real-time race finishes fast (default is 5 → gate never appears
  // inside the timeout).
  await page.locator('select[aria-label="바퀴 수"]').selectOption('1');

  // Individual mode (default) seeds 2 participants on load — clear first, then
  // add exactly 3 so the count is deterministic regardless of the seed.
  await page.locator('.reset-all').click();
  const addBtn = page.locator('.add-btn');
  for (let i = 0; i < 3; i++) await addBtn.click();
  await expect(page.locator('.participant')).toHaveCount(3);

  await page.locator('button.start').click();

  // Two skippable phases now precede the race: the lane-intro reel, then the
  // countdown. Skip both (each has its own button; intro-skip also carries .skip).
  await page.locator('button.intro-skip').click({ timeout: 5_000 }).catch(() => {});
  await page.locator('button.skip').click({ timeout: 5_000 }).catch(() => {});

  // Feature C: the race ends on a "시상식 보러가기" gate, not the podium directly.
  const gate = page.locator('button.podium-gate');
  await expect(gate).toBeVisible({ timeout: 60_000 });
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
