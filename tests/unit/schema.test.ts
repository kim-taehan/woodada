import { describe, it, expect } from 'vitest';
import { characterCatalog } from '../../src/data/characters/index.ts';

const KNOWN_SKILL_TYPES = ['zoomies', 'catwalk', 'banana', 'roar', 'icefield', 'bristle', 'abduct', 'mimic', 'illusionClone'];

describe('character catalog schema', () => {
  it('each character has required fields and a known skill type', () => {
    for (const [id, c] of Object.entries(characterCatalog)) {
      expect(c.id).toBe(id);
      expect(c.name).toBeTruthy();
      expect(c.palette.base).toMatch(/^#/);
      expect(c.palette.outline).toMatch(/^#/);
      expect(KNOWN_SKILL_TYPES).toContain(c.skill.type);
      expect(c.skill.cooldownMs[0]).toBeLessThanOrEqual(c.skill.cooldownMs[1]);
      expect(c.lines.skill).toBeTruthy();
    }
  });

  it('every character has inverse speed/power flavor stats (1–5 ints, sum ≈ 6)', () => {
    for (const [id, c] of Object.entries(characterCatalog)) {
      expect(c.speed, `${id}.speed`).toBeDefined();
      expect(c.power, `${id}.power`).toBeDefined();
      for (const v of [c.speed!, c.power!]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
      // Inverse design: the two roughly trade off so no one is strong at both.
      expect(Math.abs(c.speed! + c.power! - 6)).toBeLessThanOrEqual(1);
    }
  });

  it('ships the active characters', () => {
    expect(Object.keys(characterCatalog).sort()).toEqual(['alien', 'bear', 'cat', 'dog', 'fox', 'hedgehog', 'monkey', 'penguin', 'spider']);
  });
});
