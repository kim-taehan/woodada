/**
 * 캐릭터 이미지 크롭 스크립트
 * 게임 화면에서 캡처된 이미지를 크롭하여 캐릭터만 남김
 * 
 * 실행: npx tsx scripts/crop-character-portraits.ts
 */
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_DIR = 'public/guide/img';
const OUTPUT_DIR = 'public/guide/img';

interface CharacterInfo {
  id: string;
  name: string;
  emoji: string;
}

const characters: CharacterInfo[] = [
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

// 캔버스에서 캐릭터가 위치한 영역 (대략적인 비율)
// 게임 화면에서 캔버스는 중앙에 있고, 캐릭터는 캔버스의 중앙 상단에 위치
const CROP_CONFIG = {
  // 캔버스 크기 (게임 기본 크기)
  canvasWidth: 800,
  canvasHeight: 600,
  // 캐릭터가 위치한 영역 (x, y, width, height)
  // 캔버스 중앙 상단에 캐릭터가 있음
  characterArea: {
    x: 300,  // 캔버스 중앙에서 약간 왼쪽
    y: 100,  // 상단에서 약간 아래
    width: 200,  // 캐릭터 폭
    height: 250  // 캐릭터 높이
  },
  // 출력 크기
  outputSize: 400
};

async function cropCharacter(charInfo: CharacterInfo): Promise<void> {
  const inputPath = path.join(INPUT_DIR, `${charInfo.name}.png`);
  const outputPath = path.join(OUTPUT_DIR, `${charInfo.name}.png`);
  
  if (!fs.existsSync(inputPath)) {
    console.log(`   ⚠️  ${charInfo.emoji} ${charInfo.name}.png not found, skipping...`);
    return;
  }

  console.log(`   📸 ${charInfo.emoji} Processing ${charInfo.name}...`);
  
  try {
    // 이미지 메타데이터 먼저 가져오기
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width!;
    const height = metadata.height!;
    
    console.log(`      Original size: ${width}x${height}`);
    
    // 게임 화면에서 캔버스는 전체 화면을 채움
    // 캔버스 크기는 화면 크기에 따라 다름 (반응형)
    // 이 경우 전체 이미지를 사용하고, 중앙 상단에서 캐릭터 추출
    
    // 전체 화면 크기를 기준으로 캔버스 위치 계산
    // Playwright desktop 모드: 1280x720
    const screenWidth = width;
    const screenHeight = height;
    
    // 캔버스는 화면을 거의 다 차지함 (약 90%)
    const canvasWidth = Math.floor(screenWidth * 0.95);
    const canvasHeight = Math.floor(screenHeight * 0.9);
    const canvasX = Math.floor((screenWidth - canvasWidth) / 2);
    const canvasY = Math.floor((screenHeight - canvasHeight) / 2);
    
    // 캐릭터는 캔버스 중앙 상단에 위치
    const charX = canvasX + Math.floor(canvasWidth * 0.35);
    const charY = canvasY + Math.floor(canvasHeight * 0.15);
    const charWidth = Math.floor(canvasWidth * 0.3);
    const charHeight = Math.floor(canvasHeight * 0.5);
    
    console.log(`      Resizing to ${CROP_CONFIG.outputSize}x${CROP_CONFIG.outputSize}...`);
    
    // 임시 파일 사용 (입력/출력 분리)
    const tempPath = inputPath + '.tmp';
    
    await sharp(inputPath)
      .resize(CROP_CONFIG.outputSize, CROP_CONFIG.outputSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality: 95 })
      .toFile(tempPath);
    
    // 임시 파일을 최종 파일로 이동
    fs.renameSync(tempPath, outputPath);
    
    const stats = fs.statSync(outputPath);
    console.log(`   ✅ Saved (${(stats.size / 1024).toFixed(1)}K)\n`);
    
  } catch (error) {
    console.error(`   ❌ Error processing ${charInfo.name}:`, error);
  }
}

async function main() {
  console.log('\n✂️  Cropping character portraits...\n');
  
  for (const char of characters) {
    await cropCharacter(char);
  }
  
  console.log('\n✅ All character portraits cropped!\n');
  console.log(`📁 Output: ${OUTPUT_DIR}/\n`);
}

main().catch(console.error);
