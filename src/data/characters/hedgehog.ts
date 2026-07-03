import type { CharacterData } from '../schema.ts';

export const hedgehog: CharacterData = {
  id: 'hedgehog',
  name: '고슴도치',
  visualType: 'parts',
  visualRef: 'woodada-hedgehog.svg',
  partModelId: 'hedgehog',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#9C6B3F', // brown spikes running down the back
    point: '#F3E2C7', // cream face / belly / legs
    outline: '#4A3320',
    cheek: '#E89AA0',
    nose: '#3A2A1E',
  },
  // Side-profile prickly defender: gallop runStyle gives a low four-legged scurry
  // (front pair + rear pair), spikes bristling along the back.
  runStyle: 'gallop',
  renderScale: 0.95,
  // Prickly defender: tiny body hugs the bends — corner specialist.
  cornering: 5,
  // 역전 특화: 꼴등일수록 빨라짐 (선두와 거리 멀수록 최대 8% 속도 부스트).
  // 가시 자기부스트 축소로 추진력이 줄어 바닥권 → 역전 아이덴티티 값(0.08)으로 원복해 보완.
  catchupBoost: 0.08,
  skill: {
    // Bristle (주기적 뒤 저격): 매 3~5 초마다 바로 뒤 등수의 레이서를 가시로 밀쳐냄.
    // 최하위 (뒤에 상대 없음) 일 때는 발동 안 함. 방어적 카운터에서 능동적 저격으로 변경.
    type: 'bristle',
    cooldownMs: [2300, 3800],
    // maxGap: 바로 뒤 상대가 이 progress 거리(trackLength=1000) 안에 있어야 발동.
    // 멀리 떨어져 있으면 (거리 차이) 가시가 닿지 않아 발동 안 함. collideDist=10(≈⅔몸길이) 기준 ~8몸길이.
    // 60은 개인전(솔로 분산)에서 발동=추진력을 굶겨 바닥권 → 110으로 완화(먼 표적 차단 의도는 유지).
    // recoilBurst: 발동 시 자기 반동 부스트. baseSpeed≈1.4 대비 0.75는 과해 주 추진력화 → 0.45로 축소.
    // 전 모드 최약체(개인전 스타브) → 자기 추진력(recoilBurst) 위주 상향.
    // recoilBurst 0.45→0.92, recoilMs 900→1280, cooldown 단축으로 발동 빈도↑.
    // → 전 랩 floor 통과(laps=1 ~5%, laps=3 ~9%, laps=10 ~19%, ceil 45% 미만).
    params: { pushBack: 30, slowMs: 1000, slowMul: 0.4, maxGap: 110, recoilBurst: 0.92, recoilMs: 1280 },
  },
   lines: {
     skill: '따끔! 붙지 마! 🦔',
     win: '가까이 오지 말랐지?',
     lose: '으… 가시가 무뎌졌나…',
     dodge: '내 등은 못 건드려~',
   },
   hitLines: ['따끔!', '쏘네!', '닿지마!', '아파!'],
 };
