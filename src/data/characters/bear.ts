import type { CharacterData } from '../schema.ts';

export const bear: CharacterData = {
  id: 'bear',
  name: '곰',
  visualType: 'parts',
  visualRef: 'woodada-bear.svg',
  partModelId: 'bear',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#7B5536',
    point: '#E6CDA6',
    outline: '#4A3320',
    cheek: '#E89AA0',
    nose: '#3A2A1E',
  },
  runStyle: 'biped',
  renderScale: 1.15,
  // Tank: slowest cruise, but immovable — shrugs off disruption and traffic.
  speed: 1,
  power: 5,
  skill: {
    type: 'roar',
    // Roar that staggers every racer within range for staggerMs.
    cooldownMs: [3500, 6000],
    params: { range: 16, staggerMs: 320 },
  },
  lines: { skill: '크아앙!!', win: '으르렁!', lose: '끄응…' },
};
