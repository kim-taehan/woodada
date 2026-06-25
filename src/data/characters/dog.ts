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
  // Dog parts are natively larger than the other side-runners (head r36 / body
  // 31×25 vs cat's 33 / 27×19), so without a scale it renders biggest. Pull it a
  // touch below the cat (0.88) so it reads at a similar size on the track.
  renderScale: 0.86,
  // Zoomies mascot: straight sprinter — surges down the straights, drops back through the bends.
  cornering: 1,

  skill: {
    type: 'zoomies',
    cooldownMs: [4000, 7000],
    // burst = extra forward speed (units/frame) for burstMs.
    params: { burstMin: 0.35, burstMax: 0.75, burstMs: 600 },
  },
  lines: { skill: '우다다다다!!!', win: '왈왈!', lose: '깨갱…' },
  hitLines: ['받아!', '꺼져!', '비켜!', '으악!'],
};
