import type {
  ReactionHandler,
  SkillDef,
  SkillEntry,
  SkillHandler,
  SkillRegistry,
} from './types.ts';

/** Normalise a registered entry (bare function or object) into a SkillDef. */
function asDef(entry: SkillEntry): SkillDef {
  return typeof entry === 'function' ? { tick: entry } : entry;
}

export function createSkillRegistry(): SkillRegistry {
  const map = new Map<string, SkillDef>();
  return {
    register(type, handler) {
      map.set(type, asDef(handler));
    },
    get(type): SkillHandler | undefined {
      return map.get(type)?.tick;
    },
    getReaction(type): ReactionHandler | undefined {
      return map.get(type)?.onOvertaken;
    },
    has(type) {
      return map.has(type);
    },
  };
}
