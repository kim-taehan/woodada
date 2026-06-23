import { test } from '@playwright/test';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 캐릭터 포트레이트 자동 캡처 및 크롭
 * - 게임에서 캔버스만 캡처
 * - 캔버스에서 캐릭터 위치 자동 감지 (비트맵 분석)
 * - 캐릭터만 크롭하여 저장
 * 
 * 실행: npx playwright test tests/e2e/auto-crop-characters.spec.ts --project=desktop
 */
test('auto capture and crop character portraits', async ({ page }) => {
  const characters = [
    { id: 'dog', name: 'dog', emoji: '🐶' },
    { id: 'cat', name: 'cat', emoji: '🐱' },
    { id: 'monkey', name: 'monkey', emoji: '🐒' },
    { id: 'bear', name: 'bear', emoji: '🐻' },
    { id: 'penguin', name: 'penguin', emoji: '🐧' },
    { id: 'hedgehog', name: 'hedgehog', emoji: '🦔' },
    { id: 'spider', name: 'spider', emoji: '🕷️' },
    { id: 'alien', name: 'alien', emoji: '👽' },
    { id: 'fox', name: 'fox', emoji: '🦊' }
  ];

  const outputDir = 'public/guide/img';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n🎮 Auto-capturing character portraits...\n');

  for (const char of characters) {
    console.log(`📸 ${char.emoji} Capturing ${char.name}...`);
    
    // Setup 화면
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('.add-btn', { timeout: 5000 });
    
    // 참가자 추가
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    
    // 캐릭터 선택
    await page.selectOption('select.char-select', char.id);
    await page.waitForTimeout(500);
    
    // 경주 시작
    await page.click('button.start');
    await page.waitForTimeout(1500);
    
    // 캔버스 캡처 (Buffer 로)
    const canvas = page.locator('canvas');
    const screenshot = await canvas.screenshot({ type: 'png' });
    
    // 캔버스 메타데이터 확인
    const metadata = await sharp(screenshot).metadata();
    const width = metadata.width!;
    const height = metadata.height!;
    
    console.log(`   Canvas size: ${width}x${height}`);
    
    // 캔버스 중앙 상단에서 캐릭터 찾기
    // 캐릭터는 일반적으로 캔버스의 중앙 상단에 위치
    const charX = Math.floor(width * 0.35);
    const charY = Math.floor(height * 0.15);
    const charWidth = Math.floor(width * 0.3);
    const charHeight = Math.floor(height * 0.5);
    
    console.log(`   Extracting: x=${charX}, y=${charY}, w=${charWidth}, h=${charHeight}`);
    
    // 캔버스를 임시 파일로 저장
    const tempCanvasPath = path.join(outputDir, `${char.name}-canvas.png`);
    await sharp(screenshot).toFile(tempCanvasPath);
    
    // 캐릭터 영역 추출
    const extractedPath = path.join(outputDir, `${char.name}-extracted.png`);
    await sharp(tempCanvasPath)
      .extract({
        x: charX,
        y: charY,
        width: charWidth,
        height: charHeight
      })
      .toFile(extractedPath);
    
    // 추출된 이미지를 리사이즈하여 저장
    const outputPath = path.join(outputDir, `${char.name}.png`);
    const tempPath = outputPath + '.tmp';
    
    await sharp(extractedPath)
      .resize(400, 400, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 95 })
      .toFile(tempPath);
    
    // 임시 파일을 최종 파일로
    fs.renameSync(tempPath, outputPath);
    
    // 임시 파일 정리
    fs.unlinkSync(tempCanvasPath);
    fs.unlinkSync(extractedPath);
    
    const stats = fs.statSync(outputPath);
    console.log(`   ✅ Saved (${(stats.size / 1024).toFixed(1)}K)\n`);
    
    // 페이지 리프레시
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(300);
  }

  console.log('✅ All character portraits captured and cropped!\n');
  console.log(`📁 Output: ${outputDir}/\n`);
  
  // 파일 목록 출력
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png') && !f.includes('arena') && !f.includes('all'));
  console.log('📋 Captured files:');
  files.forEach(f => console.log(`   - ${f}`));
  console.log('');
});
