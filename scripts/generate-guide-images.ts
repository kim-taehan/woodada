/**
 * Generate guide images for characters and arenas using PixiJS directly in Node.js.
 * Run with: npx tsx scripts/generate-guide-images.ts
 */
import { Application, Rectangle, Texture, Container, Graphics } from 'pixi.js';
import { partModels } from '../src/data/partmodels/index.ts';
import { trackCatalog } from '../src/data/tracks/index.ts';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = 'public/guide';
const CHAR_SIZE = 400;
const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple circle drawing helper
function drawCircle(g: Graphics, x: number, y: number, radius: number, color: string, alpha = 1) {
  g.circle(x, y, radius);
  g.fill({ color, alpha });
}

function drawCharacter(charId: string): Buffer {
  console.log(`Rendering character: ${charId}`);
  
  const charData = partModels[charId];
  if (!charData) {
    console.warn(`Character ${charId} not found`);
    return Buffer.from([]);
  }

  const app = new Application();
  // @ts-ignore - Pixi in Node.js might have different init signature
  app.init({ width: CHAR_SIZE, height: CHAR_SIZE, backgroundAlpha: 0 });
  
  const stage = app.stage as Container;
  const graphics = new Graphics();
  
  // Center position
  const cx = CHAR_SIZE / 2;
  const cy = CHAR_SIZE / 2;
  
  // Draw a simple representation based on palette
  // In a full implementation, you'd use your PartsCharacter logic here
  const baseColor = charData.palette.base || '#CCCCCC';
  const pointColor = charData.palette.point || '#FFFFFF';
  
  // Body
  drawCircle(graphics, cx, cy + 50, 80, baseColor);
  
  // Head
  drawCircle(graphics, cx, cy - 20, 60, baseColor);
  
  // Eyes (simple dots)
  drawCircle(graphics, cx - 20, cy - 30, 10, '#000000');
  drawCircle(graphics, cx + 20, cy - 30, 10, '#000000');
  
  // Point color accent (cheek or nose)
  if (charData.palette.cheek) {
    drawCircle(graphics, cx - 30, cy, 15, charData.palette.cheek);
    drawCircle(graphics, cx + 30, cy, 15, charData.palette.cheek);
  }
  
  stage.addChild(graphics);
  
  // Render to buffer
  const renderer = app.renderer;
  const canvas = renderer.extract.canvas(stage);
  const buffer = (canvas as any).toBuffer('image/png');
  
  app.destroy();
  return buffer;
}

function drawArena(arenaId: string): Buffer {
  console.log(`Rendering arena: ${arenaId}`);
  
  const arena = trackCatalog[arenaId];
  if (!arena) {
    console.warn(`Arena ${arenaId} not found`);
    return Buffer.from([]);
  }

  const app = new Application();
  // @ts-ignore
  app.init({ width: ARENA_WIDTH, height: ARENA_HEIGHT, backgroundAlpha: 0 });
  
  const stage = app.stage as Container;
  const graphics = new Graphics();
  
  // Draw a simple track representation
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  
  // Outer track
  graphics.circle(cx, cy, 200);
  graphics.fill({ color: arena.decor?.trackColor || '#E0A060' });
  graphics.stroke({ width: 80, color: '#FFFFFF', alpha: 0.3 });
  
  // Inner field
  graphics.circle(cx, cy, 120);
  graphics.fill({ color: arena.decor?.fieldColor || '#60C040' });
  
  // Start/Finish line
  graphics.rect(cx - 10, cy - 200, 20, 40);
  graphics.fill({ color: '#FFFFFF' });
  
  stage.addChild(graphics);
  
  const renderer = app.renderer;
  const canvas = renderer.extract.canvas(stage);
  const buffer = (canvas as any).toBuffer('image/png');
  
  app.destroy();
  return buffer;
}

async function main() {
  try {
    const characters = ['dog', 'cat', 'monkey', 'bear', 'penguin', 'hedgehog', 'spider', 'alien'];
    const arenas = ['grassland', 'desert', 'beach', 'citynight', 'snow', 'jungle'];
    
    // Generate character images
    for (const charId of characters) {
      const buffer = drawCharacter(charId);
      if (buffer.length > 0) {
        fs.writeFileSync(path.join(OUTPUT_DIR, `${charId}.png`), buffer);
        console.log(`✓ Saved ${charId}.png`);
      }
    }
    
    // Generate arena images
    for (const arenaId of arenas) {
      const buffer = drawArena(arenaId);
      if (buffer.length > 0) {
        fs.writeFileSync(path.join(OUTPUT_DIR, `arena-${arenaId}.png`), buffer);
        console.log(`✓ Saved arena-${arenaId}.png`);
      }
    }
    
    console.log('\n✅ All guide images generated!');
    console.log(`Output directory: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Error generating images:', error);
    process.exit(1);
  }
}

main();
