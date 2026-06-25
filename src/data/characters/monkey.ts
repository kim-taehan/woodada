import type { CharacterData } from '../schema.ts';

export const monkey: CharacterData = {
  id: 'monkey',
  name: '원숭이',
  visualType: 'parts',
  visualRef: 'woodada-monkey.svg',
  partModelId: 'monkey',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#A9743C',
    point: '#F0CDA0',
    outline: '#6E4421',
    cheek: '#E89AA0',
    banana: '#F5C84A',
  },
  runStyle: 'scamper',
  renderScale: 0.82,
  // Prankster all-rounder: neutral on both straights and bends.
  cornering: 4,
  skill: {
    type: 'banana',
    cooldownMs: [1800, 3000],  // 2.1~3.8 초 → 1.8~3.0 초 (더 자주)
    // Targets the nearest neighbour ahead OR behind (random each throw, 'either');
    // hitStun freezes them; dodgeChance misses. Bidirectional so a leading monkey can
    // still throw backward — always has a target + adds variety.
    // immuneMs: anti-stack window after the stun lifts (blocks relay chain-stuns).
    params: { target: 'either', hitStunMs: 1050, dodgeChance: 0.10, range: 0.45, immuneMs: 900 },
  },
  lines: { skill: '받아라! (까득)', win: '우끼끼!', lose: '끼…', dodge: '어… 빗나갔네' },
};
