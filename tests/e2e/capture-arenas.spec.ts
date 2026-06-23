import { test } from '@playwright/test';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 운동장 (Arena) 가이드 이미지 캡처
 * 게임 화면에서 캐릭터 없이 운동장만 캡처
 * 
 * 실행: npx playwright test tests/e2e/capture-arenas.spec.ts --project=desktop
 */
test('capture arena backgrounds without characters', async ({ page }) => {
  const arenas = [
    { id: 'grassland', name: 'Grassland', emoji: '🌿' },
    { id: 'desert', name: 'Desert', emoji: '🏜️' },
    { id: 'beach', name: 'Beach', emoji: '🏖️' },
    { id: 'citynight', name: 'Citynight', emoji: '🌃' },
    { id: 'snow', name: 'Snow', emoji: '❄️' },
    { id: 'jungle', name: 'Jungle', emoji: '🌴' }
  ];

  const outputDir = 'public/guide/img';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n🏟️  Capturing arena backgrounds...\n');

  for (const arena of arenas) {
    console.log(`📸 ${arena.emoji} Capturing ${arena.name}...`);
    
    // Setup 화면으로 이동
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('.add-btn', { timeout: 5000 });
    
    // 참가자 추가 (하지만 운동장만 캡처할 것이므로 캐릭터는 중요하지 않음)
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    
    // 임의의 캐릭터 선택 (나중에 숨길 것)
    await page.selectOption('select.char-select', 'dog');
    await page.waitForTimeout(300);
    
    // 경기장 선택
    const arenaSelect = page.locator('select.arena-select');
    if (await arenaSelect.count() > 0) {
      await arenaSelect.selectOption(arena.id);
      await page.waitForTimeout(300);
    }
    
    // 경주 시작
    await page.click('button.start');
    await page.waitForTimeout(1000);
    
    // 캔버스 캡처
    const canvas = page.locator('canvas');
    const screenshot = await canvas.screenshot();
    
    // 이미지 메타데이터 확인
    const metadata = await sharp(screenshot).metadata();
    const width = metadata.width!;
    const height = metadata.height!;
    
    console.log(`   Canvas size: ${width}x${height}`);
    
    // 운동장은 캔버스 전체를 사용 (캐릭터는 중앙에 있으므로 제외)
    // 대신 캔버스의 가장자리 부분 (배경이 보이는 부분) 을 사용
    const cropX = Math.floor(width * 0.1);
    const cropY = Math.floor(height * 0.05);
    const cropWidth = Math.floor(width * 0.8);
    const cropHeight = Math.floor(height * 0.6);
    
    console.log(`   Extracting background: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight}`);
    
    const extractedPath = path.join(outputDir, `${arena.name}-temp.png`);
    const outputPath = path.join(outputDir, `arena-${arena.id}.png`);
    const tempPath = outputPath + '.tmp';
    
    // 배경 영역 추출
    await sharp(screenshot)
      .extract({
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight
      })
      .toFile(extractedPath);
    
    // 리사이즈
    await sharp(extractedPath)
      .resize(800, 600, {
        fit: 'cover'
      })
      .png({ quality: 95 })
      .toFile(tempPath);
    
    // 임시 파일 이동
    fs.renameSync(tempPath, outputPath);
    fs.unlinkSync(extractedPath);
    
    const stats = fs.statSync(outputPath);
    console.log(`   ✅ Saved arena-${arena.id}.png (${(stats.size / 1024).toFixed(1)}K)\n`);
    
    // 페이지 리프레시
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(300);
  }

  console.log('✅ All arena backgrounds captured!\n');
  console.log(`📁 Output: ${outputDir}/\n`);
  
  // 파일 목록 출력
  const files = fs.readdirSync(outputDir).filter(f => f.startsWith('arena-'));
  console.log('📋 Captured arena files:');
  files.forEach(f => console.log(`   - ${f}`));
  console.log('');
});
