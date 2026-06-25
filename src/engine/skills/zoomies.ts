import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 강아지 우다다 (spec §2.1): a sudden uncontrollable burst forward; sometimes
 * veers off the line (strays outward). Big, visible, readable (spec §2.3).
 */
export const zoomiesHandler: SkillHandler = (ctx) => {
  const { self, rng, params, frame, all, hitLines } = ctx;
  const burst = rng.range(Number(params.burstMin), Number(params.burstMax));
  const burstFrames = Math.round(Number(params.burstMs) / DT_MS);

  self.skill.burst = burst;
  self.skill.effectUntil = frame + burstFrames;
  self.phase = 'straying';

  // 강아지는 레인 유지 (stray 제거)

  // 충돌 감지: 정면 ahead 의 상대 중 같은 레인 밴드 내에서 접촉 시 아웃코스로 밀어냄
  const COLLIDE_DIST = 40;
  const LANE_NEAR = 0.16;
  let hitCount = 0;
  for (const target of all) {
    if (target.id === self.id) continue;
    if (target.phase !== 'running') continue;
    const gap = target.progress - self.progress;
    if (gap < 0 || gap > COLLIDE_DIST) continue;
    if (Math.abs(target.lane - self.lane) > LANE_NEAR) continue;

    // 충돌 시 카운트만 (효과 없음)
    hitCount++;
  }

  // 충돌 시 강아지의 랜덤 말풍선 발동 (하나만)
  if (hitCount > 0 && hitLines && hitLines.length > 0) {
    const line = hitLines[rng.int(hitLines.length)];
    ctx.emit({ variant: 'hit', line });
  }

  ctx.emit({ variant: 'activate' });
};
