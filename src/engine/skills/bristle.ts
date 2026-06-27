import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 고슴도치 가시 저격 (bristle): 주기적으로 바로 뒤 등수의 레이서를 가시로 밀쳐냄.
 * - 쿨다운 (3~5 초) 마다 자동 발동
 * - 타겟: 바로 뒤 등수 (progress 가 가장 가까운 뒤 레이서)
 * - 최하위 (뒤에 상대 없음) 거나 타겟이 maxGap 밖이면 발동 안 함
 * - 효과: 뒤로 밀쳐내기 + 감속 + 고슴도치自身 반동 부스트(축소판)
 */
export const bristleHandler: SkillHandler = (ctx) => {
  const { self, rng, params, frame, all, hitLines } = ctx;

  // 뒤 등수 타겟 찾기: progress 가 self 보다 조금 작은 레이서 중 가장 가까운 것
  let target: typeof self | undefined;
  let minGap = Infinity;

  for (const other of all) {
    if (other.id === self.id) continue;
    if (other.phase !== 'running') continue;
    // self 보다 뒤인 레이서만 (progress 가 작은 것)
    const gap = self.progress - other.progress;
    if (gap <= 0) continue; // 앞에 있거나 같은 위치
    // 팀메이트는 제외 (팀모드에서 팀메이트 저격 방지)
    if (self.teamId !== undefined && other.teamId === self.teamId) continue;
    // 가장 가까운 뒤 레이서 찾기
    if (gap < minGap) {
      minGap = gap;
      target = other;
    }
  }

  // 뒤에 상대가 없으면 (최하위) 발동 안 함
  if (!target) {
    // 쿨다운만 소모하고 발동 안 함 (재시도 쿨다운 사용)
    return;
  }

  // 바로 뒤 상대가 가시 사거리(maxGap) 밖이면 (거리 차이) 발동 안 함.
  // 가시는 근접 저격 — 멀리 떨어진 뒤 등수는 건드리지 못함.
  const maxGap = Number(params.maxGap);
  if (maxGap > 0 && minGap > maxGap) {
    return;
  }

  // 타겟이 이미 finished/waiting/stunned/eliminated 이면 발동 안 함
  if (
    target.phase === 'finished' ||
    target.phase === 'waiting' ||
    target.phase === 'stunned' ||
    target.phase === 'eliminated'
  ) {
    return;
  }

  // 팀메이트는 저격 안 함
  if (self.teamId !== undefined && target.teamId === self.teamId) {
    return;
  }

  ctx.emit({ variant: 'activate' });

  // 무적/회피 체크
  if ((target.skill.starUntil ?? 0) > frame) { // ⭐ star
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if ((target.skill.skillInvulnUntil ?? 0) > frame) { // skill i-frames
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDecoyGuard(target)) { // 구미호 분신
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDodge(target)) { // 고양이 catwalk
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  // 타겟 밀쳐내기 + 감속
  target.progress = Math.max(0, target.progress - Number(params.pushBack));
  const slowFrames = Math.round(Number(params.slowMs) / DT_MS);
  target.skill.slowUntil = frame + slowFrames;
  target.skill.slowMul = Number(params.slowMul);

  // 고슴도치自身 반동 부스트 (대폭 축소: 가시가 주 추진력이 되지 않도록 0.75→0.25)
  self.skill.burst = Number(params.recoilBurst);
  self.skill.effectUntil = frame + Math.round(Number(params.recoilMs) / DT_MS);
  self.phase = 'straying';

  // 랜덤 hit 멘트 (상대 머리 위에 표시)
  const line = hitLines && hitLines.length > 0 ? hitLines[rng.int(hitLines.length)] : undefined;
  ctx.emit({ variant: 'hit', targetId: target.id, line });
};
