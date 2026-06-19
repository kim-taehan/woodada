/**
 * 병맛 commentary line pools, keyed by `${type}:${variant}`.
 * {n} = the acting racer (event.racerId), {t} = the target (event.targetId).
 * Lines keep the playful ㅋㅋ tone but spell out who did what to whom + result.
 *
 * {t} is only safe where the event carries a targetId (see eventLine + the
 * engine emits): *:hit and *:dodge for banana/divebomb/bristle/roar, and
 * item:shellhit. Self-buffs / AoE-activations / self-botch use {n} only. When a
 * {t} line is somehow rendered without a target name, {t} falls back to '상대'.
 */
const LINES: Record<string, string[]> = {
  // — self buffs / activations (target not yet decided): {n} only —
  'zoomies:activate': ['{n} 폭주 시작! 우다다다!', '{n} 통제불능이다 ㅋㅋ', '{n} 갑자기 가속! 어디 가는 거야!'],
  'catwalk:activate': ['{n} 캣워크 시동! 사뿐사뿐 미끄러진다~', '{n} 우아하게 슉! 다 비켜!', '{n} 도도하게 치고 나간다 ㅋㅋ'],
  'catwalk:dodge': ['{n} 냐옹~ 방해 무효!', '{n} 사뿐 회피! 안 통한다 ㅋㅋ', '{n} 그런 거 안 맞아요~'],
  'divebomb:activate': ['{n} 폴짝 점프! 박치기 도박 한 방 간다!', '{n} 머리 들이밀고 표적 조준 중!', '{n} 슈웅— 박치기 돌격 준비!'],
  'divebomb:self': ['어이쿠! {n} 도박 실패로 자기가 처박혔다 ㅋㅋ', '{n} 헛박치기! 혼자 땅에 꼴아박았다 ㅋㅋㅋ', '{n} 박치기 빗나가 자폭! 별이 빙글빙글~'],
  'banana:activate': ['{n} 바나나 장전! 누구한테 던질까~', '{n} 바나나 꺼내 들었다! 조준 중 ㅋㅋ'],
  'roar:activate': ['{n} 크아앙! 주변 다 같이 움찔!', '{n} 포효 발동! 근처가 얼어붙는다!'],
  'bristle:activate': ['{n} 등 가시 곤두세웠다! 붙지 말라잖아 ㅋㅋ', '{n} 까칠모드 발동! 뒤에 누구냐!', '{n} 따끔 주의보! 가시 쫙 폈다!'],

  // — disruptions that LAND on a target: {n} did it to {t} —
  'banana:hit': ['{n}가 {t}한테 바나나 투척 — 명중! {t} 미끄덩 ㅋㅋ', '{n}의 바나나가 {t} 발밑에! {t} 쭉 미끄러졌다!', '{n}가 {t}한테 한 방 먹였다! 바나나 직격 ㅋㅋㅋ'],
  'banana:dodge': ['{n}가 {t}한테 바나나 던졌지만 {t} 쏙 피했다! ㅋㅋ', '{n}의 바나나, {t}가 폴짝 회피! 헛던짐 ㅋㅋ', '아깝다! {n}가 노린 {t} 안 맞고 지나갔다!'],
  'divebomb:hit': ['{n}가 {t}한테 박치기 다이브 — 적중! {t} 나가떨어졌다!', '{n}의 헤드 다이브가 {t} 직격! {t} 휘청 ㅋㅋ', '{n}가 {t} 들이받고 본인은 그대로 가속! 도박 성공!'],
  'divebomb:dodge': ['{n}가 {t} 노리고 박았지만 {t} 쏙 빠졌다 ㅋㅋ', '{n}의 박치기, {t}가 슥 피해 허공만 들이받았다!'],
  'bristle:hit': ['{n} 가시 카운터! 따라붙던 {t} 뒤로 톡 ㅋㅋ', '{n} 등 가시에 {t} 찔려 튕겨나갔다!', '{n}한테 붙던 {t}, 따끔 한 방에 주춤 ㅋㅋ'],
  'bristle:dodge': ['{n} 가시 세웠지만 {t} 안 찔리고 쏙 지나갔다 ㅋㅋ', '{n}의 따끔, {t}가 요리조리 피했다!'],
  'roar:hit': ['{n}의 포효에 {t} 움찔 — 발 묶였다 ㅋㅋ', '{n} 크아앙! {t} 깜짝 놀라 주춤!'],
  'roar:dodge': ['{n} 포효에도 {t}는 끄떡없다! ㅋㅋ', '{n}의 으르렁, {t}한텐 안 통했다!'],

  // — items: self/AoE use {n}; the shell bonk lands on the leader {t} —
  'item:star': ['{n} 무적 발동! 별빛 두르고 폭주! ⭐', '{n} 지금은 못 막아! 반짝반짝 무적이다!', '{n} 레인보우 무적! 다 비켜라 ㅋㅋ'],
  'item:lightning': ['{n} 번개 발사! 나 빼고 다 감전 ㅋㅋ', '⚡ {n} 번쩍! 전원 처진다!', '{n} 천벌이다! 다들 느려졌어!'],
  'item:fart': ['{n} 뿌웅~ 뒤따라오던 애들 기절 ㅋㅋ', '{n} 가스 공격! 뒤에 구름 자욱하다 💨', '{n} 방귀 한 방에 추격조 멈췄다!'],
  'item:shell': ['{n} 등껍질 장전! 1등 노린다 🐢', '{n} 거북 등껍질 발사 준비!', '{n} 등껍질 슉— 선두로 날아간다!'],
  'item:shellhit': ['{n}의 등껍질이 선두 {t} 직격! {t} 봉크당했다 ㅋㅋ', '{n}가 1등 {t} 등껍질로 스턴! {t} 별이 빙글빙글~', '{n}의 거북 등껍질에 {t} 처박혔다 ㅋㅋㅋ'],

  // — relay handoff: {n} only —
  'relay:handoff': ['{n} 바통 터치! 다음 주자 출발! 🔁', '{n} 배턴 넘겼다! 이어달려! 🏃', '{n} 손바닥 짝! 다음 주자 폭주 준비!'],
};

const LEAD = ['선두 교체! {n} 1등!', '{n} 치고 나간다!', '{n} 선두 등극!'];
const LASTLAP = ['마지막 바퀴! 대역전 간다!', '마지막 바퀴! 끝까지 모른다!'];

function pick(pool: string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length];
}

/**
 * @param name acting racer name ({n})
 * @param targetName target racer name ({t}) — omit for self/AoE variants;
 *   any stray {t} then falls back to '상대' so the line never renders broken.
 */
export function eventLine(type: string, variant: string, name: string, seed: number, targetName?: string): string | null {
  const pool = LINES[`${type}:${variant}`];
  if (!pool) return null;
  return pick(pool, seed)
    .replace(/\{n\}/g, name)
    .replace(/\{t\}/g, targetName ?? '상대');
}

export function leadLine(name: string, seed: number): string {
  return pick(LEAD, seed).replace(/\{n\}/g, name);
}

export function lastLapLine(seed: number): string {
  return pick(LASTLAP, seed);
}
