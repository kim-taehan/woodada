import { test, expect } from '@playwright/test';

const SHOTS = 'tests/e2e/__screens__';

test.describe('setup shell', () => {
  test('first paint shows only name input + start (3-second principle)', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.locator('input[aria-label="participant name"]')).toBeVisible();
    await expect(page.locator('button.start')).toBeVisible();
    // Options are collapsed by default.
    await expect(page.locator('details.options')).toHaveJSProperty('open', false);
    // Start is disabled until 2+ participants.
    await expect(page.locator('button.start')).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/setup-${info.project.name}.png` });
  });

  test('add names by Enter and enable start', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[aria-label="participant name"]');
    await input.fill('철수');
    await input.press('Enter');
    await input.fill('영희');
    await input.press('Enter');
    await expect(page.locator('.participant')).toHaveCount(2);
    await expect(page.locator('button.start')).toBeEnabled();
  });

  test('Korean IME Enter does not double-add the trailing syllable', async ({ page }) => {
    await page.goto('/');
    const r = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="participant name"]') as HTMLInputElement;
      input.value = '심상준';
      // Enter that confirms the IME composition must be ignored.
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
      const afterComposing = document.querySelectorAll('.participant').length;
      // The following (non-composing) Enter submits once.
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, bubbles: true }));
      return {
        afterComposing,
        afterFinal: document.querySelectorAll('.participant').length,
        name: (document.querySelector('.participant .pname') as HTMLInputElement | null)?.value ?? '',
      };
    });
    expect(r.afterComposing).toBe(0);
    expect(r.afterFinal).toBe(1);
    expect(r.name).toBe('심상준');
  });

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
