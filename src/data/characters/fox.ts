import type { CharacterData } from '../schema.ts';

export const fox: CharacterData = {
  id: 'fox',
  name: '구미호',
  visualType: 'parts',
  visualRef: 'woodada-fox.svg',
  partModelId: 'fox',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#DEB887',    // sandy buff — fennec-fox warmth, lighter than red-fox orange
    point: '#F5DEB3',   // wheat cream — inner ears, chest highlight
    outline: '#8B6914', // warm dark brown outline
    cheek: '#E8A87C',   // apricot blush — softer than the old vivid red
    tailTip: '#FFFAF0', // floral white — just off-white for the tail tips
    eye: '#3D2B1F',     // deep warm brown
  },
  runStyle: 'sly',
  renderScale: 1.0,
  speed: 3,
  power: 2,
  skill: {
    type: 'illusionClone',
    cooldownMs: [5000, 7000],
    params: {
      cloneCount: 2,
      cloneDuration: 3000,
      collisionStun: 500,
      laneSpread: 0,    // inline — clones trail/lead on the same lane as the body
      bodyLenUnits: 38, // tightened from 57 (too far apart per user) — ~0.67 body so heads sit near tails, no overlap
      gapJitter: 0.4,   // random extra gap on top (0.4 → 1.0~1.4× spread); lowered with the tighter base
    },
  },
  lines: {
    skill: '허허… (실은 나야)',
    win: '진짜는 어디였을까?',
    lose: '이번엔 빗나갔네...',
    dodge: '퐁! (분신 사라짐)',
  },
};
