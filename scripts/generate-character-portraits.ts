/**
 * 캐릭터 포트레이트 전용 이미지 생성 스크립트
 * 게임 화면 없이 캐릭터만 렌더링하여 순수 포트레이트 생성
 * 
 * 실행: npx tsx scripts/generate-character-portraits.ts
 */
import { Application, Container, Graphics } from 'pixi.js';
import { characterCatalog } from '../src/data/characters/index.ts';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = 'public/guide/img';
const CANVAS_SIZE = 400;

interface CharacterPortrait {
  id: string;
  name: string;
  emoji: string;
}

const characters: CharacterPortrait[] = [
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

async function renderCharacter(charId: string): Promise<Buffer> {
  const charData = characterCatalog[charId];
  
  if (!charData) {
    throw new Error(`Character ${charId} not found`);
  }

  const { base, point, cheek, eye, accent } = charData.palette;
  
  // Pixi 애플리케이션 생성 (Node.js 환경)
  const app = new Application();
  await app.init({
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundAlpha: 0, // 투명 배경
  });

  const stage = app.stage as Container;
  const graphics = new Graphics();
  
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  
  // 캐릭터별 고유한 모양 그리기
  switch (charId) {
    case 'dog':
      // 강아지: 귀, 코, 수염
      graphics.circle(cx, cy, 80, base);
      graphics.circle(cx - 50, cy - 60, 25, base); // 왼쪽 귀
      graphics.circle(cx + 50, cy - 60, 25, base); // 오른쪽 귀
      graphics.circle(cx, cy + 20, 15, '#000000'); // 코
      graphics.circle(cx - 30, cy - 10, 8, eye || '#000000'); // 왼쪽 눈
      graphics.circle(cx + 30, cy - 10, 8, eye || '#000000'); // 오른쪽 눈
      if (cheek) {
        graphics.circle(cx - 45, cy + 15, 12, cheek);
        graphics.circle(cx + 45, cy + 15, 12, cheek);
      }
      break;
      
    case 'cat':
      // 고양이: 뾰족한 귀, 수염
      graphics.circle(cx, cy, 75, base);
      graphics.moveTo(cx - 55, cy - 55);
      graphics.lineTo(cx - 70, cy - 90);
      graphics.lineTo(cx - 35, cy - 70);
      graphics.fill({ color: base });
      graphics.moveTo(cx + 55, cy - 55);
      graphics.lineTo(cx + 70, cy - 90);
      graphics.lineTo(cx + 35, cy - 70);
      graphics.fill({ color: base });
      graphics.circle(cx - 25, cy - 15, 10, eye || '#000000');
      graphics.circle(cx + 25, cy - 15, 10, eye || '#000000');
      graphics.circle(cx, cy + 15, 6, point || '#FFC0CB');
      break;
      
    case 'monkey':
      // 원숭이: 큰 귀, 코
      graphics.circle(cx, cy, 70, base);
      graphics.circle(cx - 75, cy, 20, base); // 왼쪽 귀
      graphics.circle(cx + 75, cy, 20, base); // 오른쪽 귀
      graphics.circle(cx - 25, cy - 10, 12, '#FFFFFF');
      graphics.circle(cx + 25, cy - 10, 12, '#FFFFFF');
      graphics.circle(cx - 25, cy - 10, 6, eye || '#000000');
      graphics.circle(cx + 25, cy - 10, 6, eye || '#000000');
      graphics.ellipse(cx, cy + 25, 30, 20, point || '#FFC0CB');
      break;
      
    case 'bear':
      // 곰: 둥근 귀, 코
      graphics.circle(cx, cy, 85, base);
      graphics.circle(cx - 50, cy - 65, 20, base);
      graphics.circle(cx + 50, cy - 65, 20, base);
      graphics.circle(cx - 25, cy - 15, 10, eye || '#000000');
      graphics.circle(cx + 25, cy - 15, 10, eye || '#000000');
      graphics.ellipse(cx, cy + 20, 25, 18, point || '#A0522D');
      graphics.circle(cx, cy + 20, 10, '#000000');
      break;
      
    case 'penguin':
      // 펭귄: 검은 몸, 흰 배
      graphics.circle(cx, cy, 75, base);
      graphics.ellipse(cx, cy + 10, 50, 45, '#FFFFFF');
      graphics.circle(cx - 25, cy - 20, 8, eye || '#000000');
      graphics.circle(cx + 25, cy - 20, 8, eye || '#000000');
      graphics.moveTo(cx, cy + 10);
      graphics.lineTo(cx - 15, cy + 35);
      graphics.lineTo(cx + 15, cy + 35);
      graphics.fill({ color: accent || '#FFA500' });
      break;
      
    case 'hedgehog':
      // 고슴도치: 가시
      graphics.circle(cx, cy, 65, base);
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const x = cx + Math.cos(angle) * 65;
        const y = cy + Math.sin(angle) * 65;
        graphics.moveTo(cx, cy);
        graphics.lineTo(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
        graphics.lineTo(x + Math.cos(angle + 0.2) * 15, y + Math.sin(angle + 0.2) * 15);
        graphics.fill({ color: point || '#8B4513' });
      }
      graphics.circle(cx - 20, cy - 10, 6, eye || '#000000');
      graphics.circle(cx + 20, cy - 10, 6, eye || '#000000');
      graphics.circle(cx, cy + 15, 5, point || '#000000');
      break;
      
    case 'spider':
      // 거미: 몸, 다리
      graphics.circle(cx, cy - 20, 50, base);
      graphics.circle(cx, cy + 40, 35, point || '#2F4F4F');
      // 다리
      for (let i = 0; i < 4; i++) {
        const y = cy - 30 + i * 20;
        graphics.moveTo(cx - 40, y);
        graphics.lineTo(cx - 80, y - 10);
        graphics.lineTo(cx - 75, y + 10);
        graphics.fill({ color: base });
        graphics.moveTo(cx + 40, y);
        graphics.lineTo(cx + 80, y - 10);
        graphics.lineTo(cx + 75, y + 10);
        graphics.fill({ color: base });
      }
      graphics.circle(cx - 15, cy - 25, 5, eye || '#FF0000');
      graphics.circle(cx + 15, cy - 25, 5, eye || '#FF0000');
      break;
      
    case 'alien':
      // 외계인: 큰 머리, 큰 눈
      graphics.ellipse(cx, cy, 70, 85, base);
      graphics.circle(cx - 25, cy - 10, 18, eye || '#000000');
      graphics.circle(cx + 25, cy - 10, 18, eye || '#000000');
      graphics.circle(cx - 25, cy - 10, 8, '#FFFFFF');
      graphics.circle(cx + 25, cy - 10, 8, '#FFFFFF');
      if (accent) {
        graphics.moveTo(cx, cy + 40);
        graphics.lineTo(cx - 20, cy + 60);
        graphics.lineTo(cx + 20, cy + 60);
        graphics.fill({ color: accent });
      }
      break;
      
    case 'fox':
      // 여우: 뾰족한 귀, 주황색
      graphics.circle(cx, cy, 70, base);
      graphics.moveTo(cx - 55, cy - 50);
      graphics.lineTo(cx - 75, cy - 95);
      graphics.lineTo(cx - 30, cy - 70);
      graphics.fill({ color: base });
      graphics.moveTo(cx + 55, cy - 50);
      graphics.lineTo(cx + 75, cy - 95);
      graphics.lineTo(cx + 30, cy - 70);
      graphics.fill({ color: base });
      graphics.circle(cx - 25, cy - 15, 9, eye || '#000000');
      graphics.circle(cx + 25, cy - 15, 9, eye || '#000000');
      graphics.moveTo(cx - 15, cy + 30);
      graphics.lineTo(cx, cy + 45);
      graphics.lineTo(cx + 15, cy + 30);
      graphics.fill({ color: point || '#FFFFFF' });
      break;
  }

  stage.addChild(graphics);

  // 렌더링
  const renderer = app.renderer;
  const canvas = renderer.extract.canvas(stage);
  const buffer = (canvas as any).toBuffer('image/png');

  // 정리
  graphics.destroy();
  app.destroy();

  return buffer;
}

async function main() {
  console.log('\n🎨 Generating character portraits...\n');

  // 출력 디렉토리 생성
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const char of characters) {
    console.log(`📸 ${char.emoji} Rendering ${char.name}...`);
    
    try {
      const buffer = await renderCharacter(char.id);
      const outputPath = path.join(OUTPUT_DIR, `${char.name}.png`);
      fs.writeFileSync(outputPath, buffer);
      
      const stats = fs.statSync(outputPath);
      console.log(`   ✅ Saved: ${char.name}.png (${(stats.size / 1024).toFixed(1)}K)\n`);
    } catch (error) {
      console.error(`   ❌ Error rendering ${char.name}:`, error);
    }
  }

  console.log('✅ All character portraits generated!\n');
  console.log(`📁 Output: ${OUTPUT_DIR}/\n`);
}

main().catch(console.error);
