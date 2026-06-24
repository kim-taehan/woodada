import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 강아지 우다다 (spec §2.1): a sudden uncontrollable burst forward; sometimes
 * veers off the line (strays outward). Big, visible, readable (spec §2.3).
 */
export const zoomiesHandler: SkillHandler = (ctx) => {
  const { self, rng, params, frame } = ctx;
  const burst = rng.range(Number(params.burstMin), Number(params.burstMax));
  const burstFrames = Math.round(Number(params.burstMs) / DT_MS);

  self.skill.burst = burst;
  self.skill.effectUntil = frame + burstFrames;
  self.phase = 'straying';

  // Sometimes the zoomies fling it off the inside line.
  if (rng.bool(Number(params.strayChance))) {
    self.lane = Math.min(1, self.lane + Number(params.strayLane));
  }

  ctx.emit({ variant: 'activate' });
};
