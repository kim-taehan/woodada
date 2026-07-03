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
  // cornering 1→2: 팀/릴레이에서 코너 페널티 완화. 스트레이트 특화 identity 유지.
  cornering: 2,
  // 스턴 떨치기: 스턴당하면 남은 시간을 20%로 줄여 남들보다 빨리 일어난다.
  stunRecover: 0.2,

  skill: {
    type: 'zoomies',
    // cooldown 4~7→3.5~6 초, burstMs 600→750, burstMax 0.75→0.88: 팀/릴레이 보완 (과강화 방지).
    cooldownMs: [3500, 6000],
    // burst = extra forward speed (units/frame) for burstMs.
    params: { burstMin: 0.35, burstMax: 0.88, burstMs: 750 },
  },
  lines: { skill: '우다다다다!!!', win: '왈왈!', lose: '깨갱…' },
  hitLines: ['받아!', '꺼져!', '비켜!', '으악!'],
};
