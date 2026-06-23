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
  cornering: 3,
  skill: {
    type: 'banana',
    cooldownMs: [2100, 3800],
    // Targets the nearest neighbour ahead OR behind (random each throw, 'either');
    // hitStun freezes them; dodgeChance misses. Bidirectional so a leading monkey can
    // still throw backward — always has a target + adds variety.
    // immuneMs: anti-stack window after the stun lifts (blocks relay chain-stuns).
    params: { target: 'either', hitStunMs: 1050, dodgeChance: 0.10, range: 0.32, immuneMs: 900 },
  },
  lines: { skill: '받아라! (까득)', win: '우끼끼!', lose: '끼…', dodge: '어… 빗나갔네' },
};
