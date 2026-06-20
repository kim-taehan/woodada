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
  // Prankster all-rounder: balanced cruise and toughness.
  speed: 3,
  power: 3,
  skill: {
    type: 'banana',
    cooldownMs: [2100, 3800],
    // Targets front or back neighbour by progress; hitStun freezes them; dodgeChance misses.
    // immuneMs: anti-stack window after the stun lifts (blocks relay chain-stuns).
    params: { target: 'front', hitStunMs: 1200, dodgeChance: 0.06, range: 0.32, immuneMs: 900 },
  },
  lines: { skill: '받아라! (까득)', win: '우끼끼!', lose: '끼…', dodge: '어… 빗나갔네' },
};
