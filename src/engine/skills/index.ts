import type { SkillRegistry } from './types.ts';
import { createSkillRegistry } from './registry.ts';
import { zoomiesHandler } from './zoomies.ts';
import { catwalkHandler } from './catwalk.ts';
import { bananaHandler } from './banana.ts';
import { roarHandler } from './roar.ts';
import { icefieldHandler } from './icefield.ts';
import { bristleHandler } from './bristle.ts';
import { abductHandler } from './abduct.ts';
import { mimicHandler } from './mimic.ts';
import { illusionCloneHandler } from './illusionClone.ts';

/** Register skill handlers (spec §2.4 pool). */
export function registerDefaultSkills(r: SkillRegistry): void {
  r.register('zoomies', zoomiesHandler);
  r.register('catwalk', catwalkHandler);
  r.register('banana', bananaHandler);
  r.register('roar', roarHandler);
  r.register('icefield', icefieldHandler);
  r.register('bristle', bristleHandler);
  r.register('abduct', abductHandler);
  r.register('mimic', mimicHandler);
  r.register('illusionClone', illusionCloneHandler);
}

export function createDefaultSkillRegistry(): SkillRegistry {
  const r = createSkillRegistry();
  registerDefaultSkills(r);
  return r;
}

export { createSkillRegistry } from './registry.ts';
export type { SkillRegistry, SkillHandler, SkillContext } from './types.ts';
