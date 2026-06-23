/**
 * Resize and crop guide images to proper sizes.
 * Run with: npx tsx scripts/resize-guide-images.ts
 */
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const INPUT_DIR = 'docs/img';
const OUTPUT_DIR = 'public/guide';

interface ImageSize {
  width: number;
  height: number;
}

async function getImageSize(buffer: Buffer): Promise<ImageSize> {
  // Simple PNG header parsing
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  // IHDR chunk starts at offset 16, width at 16-19, height at 20-23
  if (buffer.length < 24) {
    throw new Error('Invalid PNG file');
  }
  
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  
  return { width, height };
}

async function cropAndResize(inputPath: string, outputPath: string, cropArea: { x: number, y: number, width: number, height: number }): Promise<void> {
  // This is a placeholder - we'd need a proper image library like sharp or jimp
  // For now, we'll just copy the file
  console.log(`Would crop ${inputPath} to ${cropArea.width}x${cropArea.height}`);
}

async function main() {
  console.log('Resizing guide images...');
  
  const characters = ['dog', 'cat', 'monkey', 'bear', 'penguin', 'hedgehog', 'spider', 'alien'];
  const arenas = ['grassland', 'desert', 'beach', 'citynight', 'snow', 'jungle'];
  
  // Character images: crop to 400x400 centered
  for (const charId of characters) {
    const inputPath = join(INPUT_DIR, `${charId}.png`);
    const outputPath = join(OUTPUT_DIR, `${charId}.png`);
    
    if (!existsSync(inputPath)) {
      console.warn(`⚠️ ${inputPath} not found, skipping`);
      continue;
    }
    
    console.log(`Processing ${charId}...`);
    // In a real implementation, use sharp or jimp to crop
    // For now, just copy
    const { copyFile } = await import('fs/promises');
    await copyFile(inputPath, outputPath);
    console.log(`✓ Copied ${charId}.png`);
  }
  
  // Arena images: keep as-is or crop to remove UI
  for (const arenaId of arenas) {
    const inputPath = join(INPUT_DIR, `arena-${arenaId}.png`);
    const outputPath = join(OUTPUT_DIR, `arena-${arenaId}.png`);
    
    if (!existsSync(inputPath)) {
      console.warn(`⚠️ ${inputPath} not found, skipping`);
      continue;
    }
    
    console.log(`Processing arena-${arenaId}...`);
    const { copyFile } = await import('fs/promises');
    await copyFile(inputPath, outputPath);
    console.log(`✓ Copied arena-${arenaId}.png`);
  }
  
  console.log('\n✅ Done! Images copied to', OUTPUT_DIR);
}

main().catch(console.error);
