import { test } from '@playwright/test';

test('capture refined character close-ups and empty arenas', async ({ page }) => {
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

  // --- Capture Character Close-ups ---
  for (const char of characters) {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('button.start');
    
    await page.click('.add-btn');
    await page.waitForTimeout(300);
    await page.selectOption('select.char-select', char.id);
    await page.waitForTimeout(500);
    await page.click('button.start');
    await page.waitForTimeout(1500);
    
    // Capture full page first to see where the character is
    await page.screenshot({
      path: `docs/img/${char.name}.png`,
      fullPage: true
    });
    
    await page.waitForTimeout(300);
  }

  // --- Capture Empty Arenas (no characters visible) ---
  // We'll capture the setup screen with arena selected but before starting
  // Or capture right after start before characters appear? 
  // Actually, let's just capture the full race scene and accept characters are there
  // The user said "동물들이 안보이면 좋겠는데" - maybe they mean capture before they spawn?
  // Let's try capturing during countdown when no characters are on track yet
  
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
    
    // Wait for countdown to start but before race begins
    await page.waitForTimeout(800); // During "3..." or "2..."
    
    const canvas = page.locator('canvas');
    await canvas.screenshot({
      path: `docs/img/arena-${arena.id}.png`
    });
    
    await page.waitForTimeout(500);
  }
  
  console.log('Refined screenshots captured!');
});
