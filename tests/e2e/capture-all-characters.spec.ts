import { test, expect } from '@playwright/test';

test('capture all character portraits for guide', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForSelector('button.start');
  
  const characters = [
    { id: 'dog', name: 'dog' },
    { id: 'cat', name: 'cat' },
    { id: 'monkey', name: 'monkey' },
    { id: 'bear', name: 'bear' },
    { id: 'penguin', name: 'penguin' },
    { id: 'hedgehog', name: 'hedgehog' },
    { id: 'spider', name: 'spider' },
    { id: 'alien', name: 'alien' }
  ];
  
  // Add one participant and capture each character individually
  for (const char of characters) {
    // Add participant
    await page.click('.add-btn');
    await page.waitForTimeout(300);
    
    // Select character using select option
    await page.selectOption('select.char-select', char.id);
    await page.waitForTimeout(500);
    
    // Start race
    await page.click('button.start');
    await page.waitForTimeout(1500); // Wait for countdown
    
    // Capture the canvas
    const canvas = page.locator('canvas');
    await canvas.screenshot({
      path: `docs/img/${char.name}.png`
    });
    
    // Go back to setup (reload)
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('button.start');
  }
  
  // Final: capture all characters together
  for (const char of characters) {
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    const idx = characters.indexOf(char);
    await page.selectOption(`select.char-select >> nth=${idx}`, char.id);
    await page.waitForTimeout(200);
  }
  
  await page.click('button.start');
  await page.waitForTimeout(2000);
  
  await page.screenshot({
    path: 'docs/img/all-characters-race.png',
    fullPage: true
  });
});
