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
  catchupBoost: 0.08,
  skill: {
    // Bristle (주기적 뒤 저격): 매 2~3 초마다 바로 뒤 등수의 레이서를 가시로 밀쳐냄.
    // 최하위 (뒤에 상대 없음) 일 때는 발동 안 함. 방어적 카운터에서 능동적 저격으로 변경.
    type: 'bristle',
    cooldownMs: [2000, 3000],
    params: { pushBack: 30, slowMs: 1000, slowMul: 0.4, recoilBurst: 0.75, recoilMs: 900 },
  },
   lines: {
     skill: '따끔! 붙지 마! 🦔',
     win: '가까이 오지 말랐지?',
     lose: '으… 가시가 무뎌졌나…',
     dodge: '내 등은 못 건드려~',
   },
   hitLines: ['따끔!', '쏘네!', '닿지마!', '아파!'],
 };
