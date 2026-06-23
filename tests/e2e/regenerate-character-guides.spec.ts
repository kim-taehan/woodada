import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 캐릭터 포트레이트 가이드 이미지 재생성
 * 
 * 실행 방법:
 * 1. 개발 서버 시작: npm run dev
 * 2. 이 스크립트 실행: npx playwright test tests/e2e/regenerate-character-guides.spec.ts
 * 
 * 결과: public/guide/img/ 에 캐릭터 이미지 저장
 */
test('regenerate character guide images', async ({ page }) => {
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

  // public/guide/img 디렉토리 생성
  const outputDir = 'public/guide/img';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n🎮 Starting character guide image capture...\n');

  for (const char of characters) {
    console.log(`📸 Capturing ${char.emoji} ${char.name}...`);
    
    // Setup 화면으로 이동
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('.add-btn', { timeout: 5000 });
    
    // 참가자 추가
    await page.click('.add-btn');
    await page.waitForTimeout(200);
    
    // 캐릭터 선택
    await page.selectOption('select.char-select', char.id);
    await page.waitForTimeout(300);
    
    // 경주 시작 (캔버스를 위해)
    await page.click('button.start');
    await page.waitForTimeout(1500); // 카운트다운 대기
    
    // 캔버스 캡처
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible', timeout: 5000 });
    
    await canvas.screenshot({
      path: `${outputDir}/${char.name}.png`
    });
    
    console.log(`   ✅ Saved ${outputDir}/${char.name}.png\n`);
    
    // 페이지 리프레시
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(300);
  }

  console.log('✅ All character guide images captured successfully!');
  console.log(`\n📁 Output directory: ${outputDir}/\n`);
  
  // 파일 목록 출력
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
  console.log('📋 Captured files:');
  files.forEach(f => console.log(`   - ${f}`));
  console.log('');
});
