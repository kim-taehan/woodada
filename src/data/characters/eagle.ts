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
  // Ground runner: front-facing biped (talon feet, folded wings swing like the
  // penguin's flippers). renderer 'biped' runStyle drives the leg/wing cycle.
  runStyle: 'biped',
  renderScale: 0.95,
  skill: {
    // type stays 'divebomb' — mechanic unchanged, only the flavor is now a
    // ground hop + headbutt (see src/engine/skills/divebomb.ts).
    type: 'divebomb',
    cooldownMs: [4500, 7000],
    // Hops up and headbutts the nearest racer just ahead within `range`. A 50/50
    // gamble (`selfRiskChance`): win → stun the target + the eagle keeps the
    // hop's momentum (diveBurst for diveBurstMs); lose → the eagle crashes itself.
    params: { range: 70, stunMs: 720, selfRiskChance: 0.47, diveBurst: 0.92, diveBurstMs: 850 },
  },
  lines: { skill: '받아랏! 🦅', win: '1등은 내 거다!', lose: '끼…욱…', dodge: '휘릭, 안 맞지롱~' },
};
