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
    // 엔진 보강(engine-dev): roar에 (1) anti-stack 면역(roarImmuneUntil, immuneMs) — 밀집 팩/
    // 2기 곰이 같은 대상을 연쇄 재기절시키지 못하게 막음. (2) 바퀴 수 비례 자기 반동 부스트
    // (selfBurst × (1 + lapsDone×selfBurstGrowth)) — roar는 순수 디버프라 장거리에서 곰 자신은
    // 코너링 누적손실만 지고 아무 보상이 없던 구조적 약점을 보완. laps=1은 완주 전 끝나
    // lapsDone=0(부스트 = 기본값)이라 기존 laps=1 페어니스(특히 여우 floor)에 영향 없음.
    // collateral(range/staggerMs/cooldown)은 원래 안전 수치 그대로 유지.
    cooldownMs: [3400, 5400],
    params: {
      range: 45,
      staggerMs: 420,
      immuneMs: 700,
      selfBurst: 0.45,
      selfBurstMs: 1200,
      selfBurstGrowth: 0.4,
      lapDistance: 1000,
    },
  },
  lines: { skill: '크아앙!!', win: '으르렁!', lose: '끄응…' },
};
