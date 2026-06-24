import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 강아지 우다다 (spec §2.1): a sudden uncontrollable burst forward; sometimes
 * veers off the line (strays outward). Big, visible, readable (spec §2.3).
 * 충돌 시 정면 상대를 스턴시킴 (스턴 지속시간: 0.5~1 초).
 */
export const zoomiesHandler: SkillHandler = (ctx) => {
  const { self, rng, params, frame, all, hitLines } = ctx;
  const burst = rng.range(Number(params.burstMin), Number(params.burstMax));
  const burstFrames = Math.round(Number(params.burstMs) / DT_MS);
  const stunMs = rng.range(Number(params.stunMinMs), Number(params.stunMaxMs));
  const stunFrames = Math.round(stunMs / DT_MS);

  self.skill.burst = burst;
  self.skill.effectUntil = frame + burstFrames;
  self.phase = 'straying';

  // 강아지는 레인 유지 (stray 제거)

  // 충돌 감지: 정면 ahead 의 상대 중 같은 레인 밴드 내에서 접촉 시 아웃코스로 밀어냄
  const COLLIDE_DIST = 40;  // 25 → 40 units (적당히 넓게)
  const LANE_NEAR = 0.16;
  let hitCount = 0;
  for (const target of all) {
    if (target.id === self.id) continue;
    if (target.phase !== 'running') continue;
    const gap = target.progress - self.progress;
    if (gap < 0 || gap > COLLIDE_DIST) continue;
    if (Math.abs(target.lane - self.lane) > LANE_NEAR) continue;

    // 상대를 끝레인 (lane 1) 으로 날려보냄 (아웃코스)
    target.lane = 1.0;
    target.phase = 'straying';  // 레인 변경 애니메이션용
    // 감속 추가: 0.5 초간 50% 감속 (실제 저지 효과 확보)
    const slowFrames = Math.round(500 / DT_MS);
    target.skill.slowUntil = frame + slowFrames;
    target.skill.slowMul = 0.5;

    hitCount++;
  }

  // 충돌 시 강아지의 랜덤 말풍선 발동 (하나만)
  if (hitCount > 0 && hitLines && hitLines.length > 0) {
    const line = hitLines[rng.int(hitLines.length)];
    ctx.emit({ variant: 'hit', line });
  }

  ctx.emit({ variant: 'activate' });
};
