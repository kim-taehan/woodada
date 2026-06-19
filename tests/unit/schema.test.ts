import { describe, it, expect } from 'vitest';
import { characterCatalog } from '../../src/data/characters/index.ts';

const KNOWN_SKILL_TYPES = ['zoomies', 'catwalk', 'banana', 'divebomb', 'roar', 'icefield', 'bristle'];

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

  it('ships the active characters', () => {
    expect(Object.keys(characterCatalog).sort()).toEqual(['bear', 'cat', 'dog', 'eagle', 'hedgehog', 'monkey', 'penguin']);
  });
});
