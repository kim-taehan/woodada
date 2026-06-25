import type { SkillHandler } from './types.ts';
import { DT_MS } from '../types.ts';

/**
 * 원숭이 바나나 던지기 (spec §2.1): targets the nearest racer in front or behind
 * (by progress), excluding same-team and finished/stunned racers. On hit the
 * target slips and freezes (hitStun); the target may dodge (dodgeChance), a
 * visible whiffed-throw gag. A catwalk cat in its dodge window may also avoid it
 * with its own probability (ctx.tryDodge) → dodge gag. Disruptive → never hits a
 * teammate.
 *
 * Anti-stack: a banana hit grants the target brief immunity to *further bananas*
 * (`bananaImmuneUntil` = end of stun + `immuneMs`). This stops a relay team from
 * chain-stunning one victim leg after leg (the monkey runaway); individual mode is
 * barely affected since a lone monkey rarely re-targets the same racer that fast.
 */
export const bananaHandler: SkillHandler = (ctx) => {
  const { self, all, rng, params, frame } = ctx;

  // 🐵 원숭이 바나나: 자기보다 순위가 높은 동물들에게만 던짐 (1 등일 때만 랜덤 앞/뒤)
  // 현재 내 progress 를 기준으로 순위 계산
  const sorted = all.filter(r => r.phase === 'running' && r.id !== self.id).sort((a, b) => b.progress - a.progress);
  const myRank = sorted.findIndex(r => r.id === self.id) + 1;
  const isLeader = myRank <= 0; // 1 등인 경우

  let dir: number;
  if (isLeader) {
    // 1 등일 때만 랜덤 앞/뒤
    dir = rng.bool(0.5) ? 1 : -1;
  } else {
    // 1 등 아닐 때: 자기보다 순위가 높은 동물들 (progress 가 더 큰 사람들) 만 타겟
    dir = 1; // 앞쪽으로만 던짐
  }

  const candidates = all
    .filter(
      (r) =>
        r.id !== self.id &&
        r.phase !== 'finished' &&
        r.phase !== 'waiting' &&
        r.phase !== 'stunned' &&
        r.phase !== 'eliminated' &&
        frame >= (r.skill.bananaImmuneUntil ?? 0) && // still immune from a recent banana
        (self.teamId === undefined || r.teamId !== self.teamId) &&
        (dir === 1 ? r.progress > self.progress : r.progress < self.progress),
    )
    .sort((a, b) =>
      dir === 1 ? a.progress - b.progress : b.progress - a.progress,
    );

  const target = candidates[0];
  ctx.emit({ variant: 'activate' });
  if (!target) {
    const noTargetLines = [
      '누구한테 던질 사람이 없네…',
      '에잇, 다 갔어?!',
      '허공에 던지나… 🍌',
      '상대가 없군 ㅋ',
      '쓸데없이 던졌다…',
    ];
    ctx.emit({ variant: 'whiff', line: noTargetLines[frame % noTargetLines.length] });
    return;
  }

  if ((target.skill.starUntil ?? 0) > frame) { // ⭐ star deflects the banana
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if ((target.skill.skillInvulnUntil ?? 0) > frame) { // skill i-frames: shrugs it off
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDecoyGuard(target)) { // gumiho decoy takes the hit instead (퐁!)
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryDodge(target)) {
    // catwalk slips the banana — dodge gag (renderer shows the target's line).
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }
  if (ctx.tryRangedEvade(target)) { // 🦔 작은 표적: the throw misses the small low hedgehog
    ctx.emit({ variant: 'dodge', targetId: target.id });
    return;
  }

  if (rng.bool(Number(params.dodgeChance))) {
    ctx.emit({ variant: 'dodge', targetId: target.id, line: ctx.lines.dodge ?? '어… 빗나갔네' });
    return;
  }

  const stunFrames = Math.round(Number(params.hitStunMs) / DT_MS);
  target.phase = 'stunned';
  target.speed = 0;
  target.skill.burst = 0;
  target.skill.effectUntil = frame + stunFrames;
  // Anti-stack immunity: no further banana until the stun lifts + a short buffer,
  // so a teammate can't re-stun the same victim the instant it recovers.
  const immuneFrames = Math.round(Number(params.immuneMs ?? 900) / DT_MS);
  target.skill.bananaImmuneUntil = frame + stunFrames + immuneFrames;
  ctx.emit({ variant: 'hit', targetId: target.id });
};
