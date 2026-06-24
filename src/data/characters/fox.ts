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
  // Sly dasher: sharp through bends, trades straight-line pace for agility.
  cornering: 4,
  // 작은 표적: 교묘하게 힘을 숨겨 원거리 방해 (바나나/거미줄/등껍질) 를 15% 회피.
  rangedEvade: 0.15,
  skill: {
    type: 'illusionClone',
    cooldownMs: [5000, 7000],  // 4~5.5 초 → 5~7 초 (빈도 감소)
    params: {
      cloneCount: 2,
      cloneDuration: 2000,  // 3000ms → 2000ms (지속시간 단축)
      collisionStun: 500,
      laneSpread: 0,
      bodyLenUnits: 38,
      gapJitter: 0.4,
    },
  },
  lines: {
    skill: '허허… (실은 나야)',
    win: '진짜는 어디였을까?',
    lose: '이번엔 빗나갔네...',
    dodge: '퐁! (분신 사라짐)',
  },
};
