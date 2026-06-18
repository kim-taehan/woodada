import type { CharacterData } from '../schema.ts';

export const eagle: CharacterData = {
  id: 'eagle',
  name: '독수리',
  visualType: 'parts',
  visualRef: 'woodada-eagle.svg',
  partModelId: 'eagle',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#6B4F36',
    point: '#F1EEE8',
    outline: '#3E2D1C',
    cheek: '#E89AA0',
    beak: '#F2B33A',
    wing: '#5A4129',
  },
  // Airborne racer: renderer applies a hover bob + wing flap for 'fly'.
  runStyle: 'fly',
  renderScale: 0.95,
  skill: {
    type: 'divebomb',
    cooldownMs: [4500, 7000],
    // Plunges at the nearest racer just ahead within `range`. A 50/50 gamble
    // (`selfRiskChance`): win → stun the target + the eagle keeps the dive's
    // momentum (diveBurst for diveBurstMs); lose → the eagle crashes itself.
    params: { range: 70, stunMs: 700, selfRiskChance: 0.5, diveBurst: 0.9, diveBurstMs: 800 },
  },
  lines: { skill: '급강하!! 🦅', win: '하늘은 내 거다!', lose: '끼…욱…', dodge: '바람을 타고 휘익~' },
};
