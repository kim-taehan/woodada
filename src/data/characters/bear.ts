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
  // Heavyweight charger: thunders down the straights, slow through bends.
  // (Passive body-check identity now lives in the engine as a passive — engine-dev.)
  cornering: 2,
  skill: {
    type: 'roar',
    // Roar that staggers every racer within range for staggerMs. Widened range +
    // longer stagger so the tank's AOE actually impacts the pack.
    cooldownMs: [3000, 5200],
    params: { range: 45, staggerMs: 650 },
  },
  lines: { skill: '크아앙!!', win: '으르렁!', lose: '끄응…' },
};
