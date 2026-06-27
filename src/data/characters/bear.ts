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
  // cornering 2→3: 팀/릴레이에서 구조적 약점(코너 손실) 완화. 스트레이트 강함 identity 유지.
  cornering: 3,
  skill: {
    type: 'roar',
    // Roar that staggers every racer within range for staggerMs.
    // range 45 유지(80 시 fox decoy 부작용 발생), cooldown 소폭 단축, stagger 소폭 증가.
    cooldownMs: [2200, 4000],
    params: { range: 45, staggerMs: 780 },
  },
  lines: { skill: '크아앙!!', win: '으르렁!', lose: '끄응…' },
};
