import type { CharacterData } from '../schema.ts';

export const dog: CharacterData = {
  id: 'dog',
  name: '강아지',
  visualType: 'parts',
  visualRef: 'woodada-dog.svg',
  partModelId: 'dog',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#F6D9A8',
    point: '#E89B4C',
    outline: '#B5702E',
    nose: '#5B3A24',
    cheek: '#F4A6A0',
    tongue: '#EF8E8E',
  },
  runStyle: 'gallop',
  skill: {
    type: 'zoomies',
    cooldownMs: [3000, 6000],
    // burst = extra forward speed (units/frame) for burstMs; strayChance pushes lane outward.
    params: { burstMin: 0.5, burstMax: 1.1, burstMs: 520, strayChance: 0.32, strayLane: 0.45 },
  },
  lines: { skill: '우다다다다!!!', win: '왈왈!', lose: '깨갱…' },
};
