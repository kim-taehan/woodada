/**
 * Procedural fun race-nicknames (귀여움 × 병맛). A compact prefix × noun product
 * yields 40 × 40 = 1600 meaningful-ish combos — shown as the name-input
 * placeholder so empty "add" registers a random participant (handy for testing).
 */

const PREFIX = [
  '빠른', '느림보', '행운의', '번개', '무적', '우승각', '꼴찌탈출', '날쌘', '게으른', '귀여운',
  '사나운', '엉뚱한', '폭주', '졸린', '배고픈', '신난', '도망치는', '용감한', '까부는', '든든한',
  '잽싼', '통통한', '쪼끄만', '거대한', '황금', '전설의', '초보', '고수', '럭키', '불꽃',
  '그림자', '천하제일', '동네', '슈퍼', '울트라', '메가', '수상한', '우아한', '멋쟁이', '미친',
];

const NOUN = [
  '발', '돌이', '순이', '대장', '에이스', '발바닥', '질주', '로켓', '치타', '황소',
  '천재', '폭주족', '막내', '챔피언', '다크호스', '복병', '선수', '주자', '스타', '영웅',
  '탱크', '미사일', '총알', '회오리', '돌풍', '질풍', '광속', '자유', '번개', '호랑이',
  '다람쥐', '거북이', '토깽이', '댕댕이', '냥이', '발냄새', '꼬마', '방귀', '슈터', '짱',
];

/** Total distinct combos available. */
export const NAME_COMBOS = PREFIX.length * NOUN.length;

/** A random fun nickname, e.g. "빠른발", "행운의다크호스". */
export function randomName(): string {
  const p = PREFIX[Math.floor(Math.random() * PREFIX.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return p + n;
}
