# dm02 — content-designer: 데스매치(탈락) 모드 데이터

## 작업 범위
개인전 '데스매치' 탈락 모드의 데이터/모드/실황·말풍선 대사 담당.
동결 계약대로 개인전은 단일 모드 유지(modeId='individual'), 탈락 종류는 옵션 셀렉트로 표현.

## 1. 추가한 데이터 구조/필드

### `src/data/schema.ts`
- `GameMode`에 `elimination?: 'first' | 'last'` 추가 (옵션, 없으면 일반전).
  - 엔진 `RaceConfig.elimination`과 **필드명·값 동일**.
  - `'first'` = 선두탈락(매 바퀴 1등 탈락, 먼저 빠질수록 상위)
  - `'last'` = 꼴찌탈락(매 바퀴 꼴찌 탈락, 끝까지 남으면 우승)
- `EliminationId = 'none' | 'first' | 'last'` 타입 추가 (셀렉트 옵션 id용).
- **새 `ScoringId` 추가 안 함.** 계약대로 데스매치 최종 순위는 엔진 rank로 직접 표현되므로 별도 scoringId 불필요(단순 우선).

### `src/data/modes.ts`
- `gameModes` 구조는 유지(개인전+옵션 방식, 별도 최상위 gameMode 만들지 않음).
- `eliminationOptions: { id: EliminationId; label }[]` 추가 (teamScoringOptions 패턴 복제).

## 2. 셀렉트 옵션 목록 (shell-dev가 셋업 UI에 사용)

```ts
export const eliminationOptions = [
  { id: 'none',  label: '일반전' },
  { id: 'first', label: '선두탈락 (1등이 먼저 빠져요)' },
  { id: 'last',  label: '꼴찌탈락 (끝까지 살아남기)' },
];
```

shell-dev: 개인전 선택 시 이 셀렉트를 노출하고, 선택값이
- `'none'` → `GameMode.elimination` 미설정(또는 undefined), 일반전.
- `'first' | 'last'` → `GameMode.elimination` 및 `RaceConfig.elimination`에 그대로 전달.

## 3. renderer-dev에 넘길 실황 중계 자막 (commentaryLines.ts)

병맛 톤. 직접 수정 안 함 — renderer-dev가 탈락 상황용으로 가져다 씀.
(렌더러 쪽에서 탈락 이벤트 발생 시점에 노출하면 됨)

### 선두탈락(`first`) — 의기양양·약올림 톤 (1등이 먼저 빠지는 게 핵심 반전)
1. "1등? 축하해요~ 가장 먼저 집에 가세요!"
2. "선두는 박수받으며 퇴장입니다 짝짝짝"
3. "앞서가던 자, 가장 먼저 사라지다…"
4. "1등 자리는 함정이었어! 빠빠이~"
5. "너무 잘 달렸어요. 그래서 탈락입니다 ^^"
6. "선두 탈락! 꼴찌들이 환호하는 소리가 들리네요"
7. "역시 모난 돌이 정 맞는 법, 1등 먼저 아웃!"

### 꼴찌탈락(`last`) — 불쌍·안쓰러움 톤
1. "꼴찌… 오늘은 여기까지예요 ㅠㅠ"
2. "마지막 주자, 조용히 트랙을 떠납니다…"
3. "조금만 더 빨랐어도… 안녕히 가세요"
4. "꼴찌 탈락! 다음 생엔 다리가 길길 바라요"
5. "열심히 했는데… 결과는 냉정하네요"
6. "한 명 또 별이 되었습니다…☆"
7. "살아남은 자들이여, 저 친구를 기억해주세요"

## 4. renderer-dev에 넘길 머리 위 말풍선 탈락 대사 (짧게, 캐릭터 톤)

데이터(`CharacterLines`)에 새 필드를 강제로 박지 않고(단순 우선·전 캐릭터 작성 부담),
공용 탈락 말풍선 풀로 제안. renderer-dev가 탈락 연출 말풍선에 랜덤으로 사용.

### 선두탈락 당한 캐릭터 (억울/황당 톤)
- "엥, 내가 1등인데?!"
- "이게 무슨 룰이야!"
- "잘한 게 죄야…"
- "앞서간 게 잘못이라고?!"

### 꼴찌탈락 당한 캐릭터 (시무룩/포기 톤)
- "다리가 짧아서…"
- "여기까지인가 봐 ㅠ"
- "잘 가, 친구들…"
- "다음엔 꼭 살아남을게!"

> 비고: 캐릭터별 고유 톤이 필요하면 추후 `CharacterLines`에 `eliminated?: string` 옵션 필드를
> 추가하는 안이 있으나, 현 계약 범위 밖이라 **이번엔 공용 풀만** 제안. (단순 우선)

## 5. typecheck 결과
- `npm run typecheck` → 통과 (에러 0).
- `tests/unit/schema.test.ts` → 3 passed (GameMode/eliminationOptions는 이 테스트 대상 아님, 영향 없음).
- 캐릭터 카탈로그 목록·KNOWN_SKILL_TYPES는 손대지 않음(무관).

## 협업 메모
- engine-dev: `RaceConfig.elimination?: 'first' | 'last'` — 내 `GameMode.elimination`과 동일 필드명·값. (engine-dev가 엔진 타입/룰 담당)
- shell-dev: `eliminationOptions` 사용(위 2절). 개인전 셀렉트로 `none/first/last` 노출.
- renderer-dev: 위 3·4절 대사 풀.
