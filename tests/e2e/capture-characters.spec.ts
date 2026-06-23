import { test, expect } from '@playwright/test';

test('capture all character images for guide', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForSelector('button.start');
  
  // Add 8 participants, one for each character
  const characters = [
    { id: 'dog', name: '강아지' },
    { id: 'cat', name: '고양이' },
    { id: 'monkey', name: '원숭이' },
    { id: 'bear', name: '곰' },
    { id: 'penguin', name: '펭귄' },
    { id: 'hedgehog', name: '고슴도치' },
    { id: 'spider', name: '거미' },
    { id: 'alien', name: '외계인' }
  ];
  
  for (let i = 0; i < characters.length; i++) {
    // Add participant
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    
    // Select character
    const select = page.locator('select.char-select').nth(i);
    await select.selectValue(characters[i].id);
    await page.waitForTimeout(200);
  }
  
  // Start the race
  await page.click('button.start');
  
  // Wait for countdown and race start
  await page.waitForTimeout(2000);
  
  // Capture each character during the race
  for (let i = 0; i < characters.length; i++) {
    await page.screenshot({
      path: `docs/img/${characters[i].id}-race.png`,
      clip: { x: 50, y: 50, width: 200, height: 200 }
    });
    await page.waitForTimeout(500);
  }
  
  // Capture full race scene
  await page.screenshot({
    path: 'docs/img/characters-all-race.png',
    fullPage: true
  });
});
