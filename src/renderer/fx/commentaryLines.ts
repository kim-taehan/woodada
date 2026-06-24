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

  // — 거미 거미줄 납치(abduct): 앞선 표적을 뒤로 끌어내림 —
  'abduct:activate': ['{n} 거미줄 슈웅— 앞에 누가 걸리려나 ㅋㅋ', '{n} 줄 쫙 던졌다! 누구 하나 낚으려고!', '{n} 거미줄 발사! 표적 조준 중!'],
  'abduct:hit': ['{n}가 {t}를 거미줄로 콱! 뒤로 휙 끌어내렸다 ㅋㅋ', '{n}의 거미줄에 {t} 낚여서 뒷줄로 슉— ㅋㅋㅋ', '{n}가 1등 {t}를 줄로 잡아당겼다! {t} 엉켜서 허우적 ㅋㅋ'],
  'abduct:dodge': ['{n}가 {t} 노리고 줄 던졌지만 {t} 쏙 빠져나갔다 ㅋㅋ', '{n}의 거미줄, {t}가 요리조리 피했다! 헛줄 ㅋㅋ'],

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

// 데스매치(탈락) 실황 자막. content-designer(dm02) 풀을 {n}=탈락자 이름으로 토큰화.
// 선두탈락(first): 1등이 먼저 빠지는 반전 — 의기양양·약올림 톤.
const ELIM_FIRST_BAR = [
  '1등? 축하해요~ {n} 가장 먼저 집에 가세요!',
  '선두 {n}, 박수받으며 퇴장입니다 짝짝짝',
  '앞서가던 {n}, 가장 먼저 사라지다…',
  '1등 자리는 함정이었어! {n} 빠빠이~',
  '{n} 너무 잘 달렸어요. 그래서 탈락입니다 ^^',
  '선두 탈락! 꼴찌들이 환호하는 소리가 들리네요',
  '역시 모난 돌이 정 맞는 법, {n} 먼저 아웃!',
];
// 꼴찌탈락(last): 끝까지 살아남기 — 불쌍·안쓰러움 톤.
const ELIM_LAST_BAR = [
  '꼴찌 {n}… 오늘은 여기까지예요 ㅠㅠ',
  '마지막 주자 {n}, 조용히 트랙을 떠납니다…',
  '{n} 조금만 더 빨랐어도… 안녕히 가세요',
  '꼴찌 탈락! {n} 다음 생엔 다리가 길길 바라요',
  '{n} 열심히 했는데… 결과는 냉정하네요',
  '{n} 한 명 또 별이 되었습니다…☆',
  '살아남은 자들이여, {n}를 기억해주세요',
];
// 탈락 당한 캐릭터 머리 위 말풍선 (짧게).
const ELIM_FIRST_BUBBLE = ['엥, 내가 1등인데?!', '이게 무슨 룰이야!', '잘한 게 죄야…', '앞서간 게 잘못이라고?!'];
const ELIM_LAST_BUBBLE = ['다리가 짧아서…', '여기까지인가 봐 ㅠ', '잘 가, 친구들…', '다음엔 꼭 살아남을게!'];

/**
 * 데스매치 탈락 실황 자막. mode='first'(선두탈락)면 약올림 톤, 'last'(꼴찌탈락)면
 * 안쓰러움 톤. {n} = 탈락한 레이서 이름.
 */
export function eliminationLine(mode: 'first' | 'last', name: string, seed: number): string {
  const pool = mode === 'first' ? ELIM_FIRST_BAR : ELIM_LAST_BAR;
  return pick(pool, seed).replace(/\{n\}/g, name);
}

/** 데스매치 탈락 당한 캐릭터의 머리 위 말풍선. first=억울/황당, last=시무룩/포기. */
export function eliminationBubble(mode: 'first' | 'last', seed: number): string {
  return pick(mode === 'first' ? ELIM_FIRST_BUBBLE : ELIM_LAST_BUBBLE, seed);
}

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

/**
 * Head-bubble text overrides for dodge outcomes that the engine/data can't tell
 * apart (renderer-only; engine emits a bare `*:dodge`, data lines stay generic).
 * Three branches, all keyed off the dodge event + who dodged:
 *   • 원숭이 바나나가 빗나감 → 시전자(원숭이) 머리 위 '실패/빗나감' 버블.
 *   • 고양이가 거미줄/바나나를 쳐냄 → 고양이 머리 위 '냥펀치!!' 버블.
 *   • 고양이가 그 외(roar/bristle…)를 흘림 → 고양이 머리 위 '캣워크' 버블.
 * (얼음/방구 등 환경효과는 회피 불가라 dodge 이벤트가 없으니 자연히 제외.)
 */
const BANANA_FAIL = ['어? 빗나갔다!', '에이~ 피했네 🍌', '아 깝다… 헛던졌다 ㅋㅋ', '으악 안 맞았어!'];
const CAT_PUNCH = ['냥펀치!!', '냥펀치! 탁 쳐냈다 🐾', '그런 거 안 통해! 냥펀치!'];
const CAT_WALK = ['냐옹~ 사뿐', '캣워크로 슉 흘림 😼', '냐옹, 안 맞지롱'];

const BANANA_HIT = ['맞았다!! 🍌', '으하하, 직빵~! 🐒', '찰떡 명중! ㅋㅋ', '바나나 성공! 가랏!'];

export function bananaFailBubble(seed: number): string {
  return pick(BANANA_FAIL, seed);
}
export function bananaHitBubble(seed: number): string {
  return pick(BANANA_HIT, seed);
}

/** 고양이가 막 회피한 공격 종류로 버블 갈래를 고른다. 거미줄/바나나는 냥펀치, 나머지는 캣워크. */
export function catDodgeBubble(attackType: string, seed: number): string {
  const pool = attackType === 'abduct' || attackType === 'banana' ? CAT_PUNCH : CAT_WALK;
  return pick(pool, seed);
}

/**
 * 하단 실황자막도 같은 갈래로. 고양이({t})가 막 회피했을 때, 거미줄/바나나는 '냥펀치로
 * 쳐냄' 톤, 그 외는 '캣워크로 흘림' 톤. {n}=공격자, {t}=고양이.
 */
const CAT_PUNCH_BAR = [
  '{t} 냥펀치! {n}의 공격을 탁 쳐냈다 ㅋㅋ',
  '{n}가 노렸지만 {t} 냥펀치로 받아쳤다! 🐾',
  '{t} 앞발 휙— {n} 공격 튕겨냈다 ㅋㅋㅋ',
];
const CAT_WALK_BAR = [
  '{t} 캣워크로 {n}의 방해 사뿐히 흘렸다~ 😼',
  '{n}가 흔들어도 {t}는 냐옹~ 끄떡없다 ㅋㅋ',
  '{t} 우아하게 슥— {n} 공격 안 통한다!',
];

export function catDodgeLine(attackType: string, attacker: string, cat: string, seed: number): string {
  const pool = attackType === 'abduct' || attackType === 'banana' ? CAT_PUNCH_BAR : CAT_WALK_BAR;
  return pick(pool, seed)
    .replace(/\{n\}/g, attacker)
    .replace(/\{t\}/g, cat);
}

export function lastLapLine(seed: number): string {
  return pick(LASTLAP, seed);
}

/**
 * 외계인 의태 스캔(mimic): the engine emits a `mimic:activate` marker (actor =
 * alien, targetId = the racer being copied) BEFORE the copied skill's own events.
 * The renderer derives the copied skill type from the target's character and calls
 * this to announce the copy — "🛸 외계인이 {owner}의 {skill} 스캔·복제!". The copied
 * skill's follow-up events still surface their own hit/dodge lines. `copiedType`
 * maps via SKILL_LABEL (falls back to '스킬'); `owner` is the copied racer's name.
 */
const SKILL_LABEL: Record<string, string> = {
  zoomies: '강아지 폭주',
  catwalk: '고양이 캣워크',
  banana: '원숭이 바나나',
  divebomb: '독수리 박치기',
  roar: '곰 포효',
  bristle: '고슴도치 가시',
  icefield: '펭귄 빙판',
  nap: '토끼 낮잠',
  brace: '코끼리 버티기',
  abduct: '거미 거미줄',
};

const MIMIC: string[] = [
  '🛸 {n}가 {o}의 {s} 스캔·복제! 그대로 따라한다 ㅋㅋ',
  '🛸 {n} 의태 발동 — {o}의 {s} 똑같이 베꼈다 ㄷㄷ',
  '🛸 {n}가 {o} 스캔 완료! {s} 카피해서 발동 ㅋㅋㅋ',
];

/**
 * 의태 카피 머리 위 말풍선용 SHORT 라벨 ('거미 거미줄'→'거미줄'). SKILL_LABEL의
 * 소유자 접두어를 뗀 기술명만. 외계인 머리 위에 "[기술명] copy" 로 띄운다.
 */
const SKILL_SHORT: Record<string, string> = {
  zoomies: '폭주',
  catwalk: '캣워크',
  banana: '바나나',
  divebomb: '박치기',
  roar: '포효',
  bristle: '가시',
  icefield: '빙판',
  nap: '낮잠',
  brace: '버티기',
  abduct: '거미줄',
};

/** 외계인 의태: 복사한 기술의 짧은 표시명 + " copy" (예: "바나나 copy!"). 머리 위 버블용. */
export function mimicCopyBubble(copiedType: string): string {
  const label = SKILL_SHORT[copiedType] ?? '스킬';
  return `${label} copy!`;
}

export function mimicLine(name: string, owner: string, copiedType: string, seed: number): string {
  const label = SKILL_LABEL[copiedType] ?? '스킬';
  return pick(MIMIC, seed)
    .replace(/\{n\}/g, name)
    .replace(/\{o\}/g, owner || '상대')
    .replace(/\{s\}/g, label);
}
