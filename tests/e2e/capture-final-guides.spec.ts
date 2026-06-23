import { test } from '@playwright/test';

test('capture final guide images with proper sizes', async ({ page }) => {
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

  const arenas = [
    { id: 'grassland', name: 'grassland' },
    { id: 'desert', name: 'desert' },
    { id: 'beach', name: 'beach' },
    { id: 'citynight', name: 'citynight' },
    { id: 'snow', name: 'snow' },
    { id: 'jungle', name: 'jungle' }
  ];

  // --- Capture Character Close-ups (Fixed size, centered) ---
  for (const char of characters) {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('button.start');
    
    await page.click('.add-btn');
    await page.waitForTimeout(300);
    await page.selectOption('select.char-select', char.id);
    await page.waitForTimeout(500);
    await page.click('button.start');
    await page.waitForTimeout(1500);
    
    // Wait for character to appear and settle
    await page.waitForTimeout(500);
    
    // Capture a fixed 400x400 area in the center of the viewport
    // This should show the character prominently without the full UI
    await page.screenshot({
      path: `docs/img/${char.name}.png`,
      clip: {
        x: 200,
        y: 150,
        width: 400,
        height: 400
      }
    });
    
    console.log(`Captured ${char.name}`);
    await page.waitForTimeout(300);
  }

  // --- Capture Empty Arenas (during countdown, no characters on track) ---
  for (const arena of arenas) {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('button.start');
    
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('select[aria-label="경기장"]', arena.id);
    await page.waitForTimeout(300);
    await page.click('button.start');
    
    // Capture during countdown (around 1.5s after start, before race begins)
    // At this point, the track is visible but characters haven't started running
    await page.waitForTimeout(1200);
    
    // Capture the canvas area (skip the UI overlay if any)
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      // Capture the full canvas
      await page.screenshot({
        path: `docs/img/arena-${arena.id}.png`,
        clip: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        }
      });
    }
    
    console.log(`Captured arena-${arena.id}`);
    await page.waitForTimeout(300);
  }
  
  console.log('All guide images captured successfully!');
});
