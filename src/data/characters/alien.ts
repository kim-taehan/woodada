import type { CharacterData } from '../schema.ts';

export const alien: CharacterData = {
  id: 'alien',
  name: '외계인',
  visualType: 'parts',
  visualRef: 'woodada-alien.svg',
  partModelId: 'alien',
  proportions: { headBody: '2등신', bigEyes: true },
  palette: {
    base: '#7FD98C', // classic little-green-man body
    point: '#C8F2CE', // lighter belly
    outline: '#2E5B36',
    cheek: '#E89AA0',
    eye: '#1C2233', // big black almond eyes
    antenna: '#FFD45E', // antenna bulb glow
  },
  // Glide runStyle: hovers/bobs along (UFO scout vibe). All-rounder build —
  // neutral on both axes; its identity comes from the variable copy skill.
  runStyle: 'glide',
  renderScale: 0.88,
  // Variable copycat: balanced cruise + toughness; outcome swings with whoever
  // it scans.
  speed: 3,
  power: 3,
  skill: {
    // Mimic scan (의태 스캔, 변수형 카피): copy & fire the nearest racer's skill
    // using THEIR character's params, sourced from the alien. New role: a
    // variable wildcard (no fixed effect of its own). Engine owns the nearest-
    // racer scan + copy dispatch; alien carries only scanRange. Fizzles (dodge
    // line) when no one is in range or the target has no usable skill.
    // Units: scanRange is ABSOLUTE progress (trackLength=1000) — NOT a lap fraction.
    // Wider than divebomb's range (per engine-dev's mimic contract) so the wildcard
    // usually finds someone to copy; balance-tuner does the final tuning.
    type: 'mimic',
    cooldownMs: [3000, 4600],
    params: { scanRange: 350 },
  },
  lines: {
    skill: '스캔 완료… 카피한다! 🛸',
    win: '지구 기술, 접수 완료.',
    lose: '본진으로 후퇴…',
    dodge: '스캔 실패… 신호 없음',
  },
};
