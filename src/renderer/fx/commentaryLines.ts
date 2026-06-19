/** 병맛 commentary line pools, keyed by `${type}:${variant}`. {n} = racer name. */
const LINES: Record<string, string[]> = {
  'zoomies:activate': ['{n} 폭주 시작! 우다다다!', '{n} 통제불능이다 ㅋㅋ', '{n} 또 어디 가는 거야!'],
  'catwalk:activate': ['{n} 캣워크 시동! 사뿐사뿐~', '{n} 우아하게 슉! 다 비켜!', '{n} 도도하게 미끄러진다 ㅋㅋ'],
  'catwalk:dodge': ['{n} 냐옹~ 방해 무효!', '{n} 사뿐 회피! 안 통한다 ㅋㅋ', '{n} 그런 거 안 맞아요~'],
  'divebomb:activate': ['{n} 폴짝 점프! 도박 한 방 간다!', '{n} 머리로 들이받는다! 누구냐 표적은!', '{n} 슈웅— 박치기 돌격!'],
  'divebomb:hit': ['{n} 명중! 앞주자 처박혔다 ㅋㅋ', '{n} 박치기 적중! 깃털 흩날린다!', '{n} 도박 성공! 표적 스턴 + 본인은 가속!'],
  'divebomb:self': ['어이쿠! {n} 자기가 처박혔다 ㅋㅋ', '{n} 도박 실패! 혼자 땅에 꼴아박았다 ㅋㅋㅋ', '{n} 헛박치기로 자폭! 별이 빙글빙글~'],
  'divebomb:dodge': ['{n} 헛박았다! 고양이가 쏙 빠졌다 ㅋㅋ', '{n} 머리로 허공만 들이받았다!'],
  'banana:hit': ['{n} 바나나 명중! 미끄덩~', '{n} 바나나로 한 방 먹였다!'],
  'banana:dodge': ['{n} 바나나 헛던짐 ㅋㅋ', '아깝다, {n} 빗나갔어!'],
  'item:star': ['{n} 무적 발동! 별빛 두르고 폭주! ⭐', '{n} 지금은 못 막아! 반짝반짝 무적이다!', '{n} 레인보우 무적! 다 비켜라 ㅋㅋ'],
  'item:lightning': ['{n} 번개 발사! 나 빼고 다 감전 ㅋㅋ', '⚡ {n} 번쩍! 전원 처진다!', '{n} 천벌이다! 다들 느려졌어!'],
  'item:fart': ['{n} 뿌웅~ 뒤따라오던 애들 기절 ㅋㅋ', '{n} 가스 공격! 뒤에 구름 자욱하다 💨', '{n} 방귀 한 방에 추격조 멈췄다!'],
  'item:shell': ['{n} 등껍질 장전! 1등 노린다 🐢', '{n} 거북 등껍질 발사 준비!', '{n} 등껍질 슉— 어디로 날아갈까!'],
  'item:shellhit': ['{n} 등껍질 명중! 1등 봉크당했다 ㅋㅋ', '{n} 거북 등껍질로 선두 스턴! 별이 빙글빙글~', '{n} 1등 처박혔다! 등껍질 직격 ㅋㅋㅋ'],
  'roar:activate': ['{n} 크아앙! 다 같이 움찔!', '{n} 포효! 주변이 얼어붙었다!'],
  'relay:handoff': ['{n} 바통 터치! 다음 주자 출발! 🔁', '{n} 배턴 넘겼다! 이어달려! 🏃', '{n} 손바닥 짝! 다음 주자 폭주 준비!'],
};

const LEAD = ['선두 교체! {n} 1등!', '{n} 치고 나간다!', '{n} 선두 등극!'];
const LASTLAP = ['마지막 바퀴! 대역전 간다!', '마지막 바퀴! 끝까지 모른다!'];

function pick(pool: string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length];
}

export function eventLine(type: string, variant: string, name: string, seed: number): string | null {
  const pool = LINES[`${type}:${variant}`];
  return pool ? pick(pool, seed).replace('{n}', name) : null;
}

export function leadLine(name: string, seed: number): string {
  return pick(LEAD, seed).replace('{n}', name);
}

export function lastLapLine(seed: number): string {
  return pick(LASTLAP, seed);
}
