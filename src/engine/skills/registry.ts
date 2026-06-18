import type { SkillHandler, SkillRegistry } from './types.ts';

export function createSkillRegistry(): SkillRegistry {
  const map = new Map<string, SkillHandler>();
  return {
    register(type, handler) {
      map.set(type, handler);
    },
    get(type) {
      return map.get(type);
    },
    has(type) {
      return map.has(type);
    },
  };
}
