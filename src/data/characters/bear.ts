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
    // range 45 유지(80 시 fox decoy 부작용 발생).
    // 18인 필드(곰 2기 AOE 중첩) laps=1 밀집 팩에서 슬롯 ceil 초과(독주) → AOE 대폭 약화.
    // staggerMs 780→420, cooldown [2200,4000]→[3400,5400]: laps=1 슬롯 ceil 통과(24.5%).
    // ⚠ 구조적 한계: 이 수치는 laps=1 독주는 잡지만 laps=10 floor(3.3%)를 통과 못함(2.3%).
    // 곰은 밀집 단거리 AOE 지배 ↔ 장거리(코너 누적손실) 생존이 같은 roar 파라미터에 얽혀
    // 어떤 조합으로도 양쪽을 동시에 만족 불가 → roar 로직 보강(중첩 방지/군집 감쇠) 필요(engine-dev 회부).
    cooldownMs: [3400, 5400],
    params: { range: 45, staggerMs: 420 },
  },
  lines: { skill: '크아앙!!', win: '으르렁!', lose: '끄응…' },
};
