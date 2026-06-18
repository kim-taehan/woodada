/** 병맛 commentary line pools, keyed by `${type}:${variant}`. {n} = racer name. */
const LINES: Record<string, string[]> = {
  'zoomies:activate': ['{n} 폭주 시작! 우다다다!', '{n} 통제불능이다 ㅋㅋ', '{n} 또 어디 가는 거야!'],
  'catwalk:activate': ['{n} 캣워크 시동! 사뿐사뿐~', '{n} 우아하게 슉! 다 비켜!', '{n} 도도하게 미끄러진다 ㅋㅋ'],
  'catwalk:dodge': ['{n} 냐옹~ 방해 무효!', '{n} 사뿐 회피! 안 통한다 ㅋㅋ', '{n} 그런 거 안 맞아요~'],
  'snatch:activate': ['{n} 급강하! 발톱 펼친다!', '{n} 하늘에서 덮친다! 누구냐 표적은!', '{n} 슈웅— 낚아채러 간다!'],
  'snatch:hit': ['{n} 낚아챘다! 뒤로 끌려간다 ㅋㅋ', '{n} 발톱에 걸렸다! 순위 강탈!', '{n} 공중납치 성공! 깃털 흩날린다!'],
  'snatch:dodge': ['{n} 헛챔! 표적이 쏙 빠졌다 ㅋㅋ', '{n} 발톱 허공만 긁었다!'],
  'banana:hit': ['{n} 바나나 명중! 미끄덩~', '{n} 바나나로 한 방 먹였다!'],
  'banana:dodge': ['{n} 바나나 헛던짐 ㅋㅋ', '아깝다, {n} 빗나갔어!'],
  'item:boost': ['{n} 아이템 부스트! 쌩!', '{n} 아이템 먹고 가속!'],
  'item:slip': ['{n} 아이템 잘못 걸렸다 ㅋㅋ', '{n} 미끄덩… 자업자득!'],
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
