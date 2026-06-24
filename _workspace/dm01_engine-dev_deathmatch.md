# 데스매치(탈락) 모드 — 엔진 구현 보고

## 추가/변경한 타입 계약 (렌더러·셸이 의존)

### `src/engine/types.ts`
- `RaceConfig.elimination?: 'first' | 'last'` — 없으면 일반전. (relay 선례와 동일 위치)
- `RacerPhase`에 `'eliminated'` 추가.
- `SkillEvent.variant`에 `'out'` 추가. 탈락 이벤트는 `{ type: 'eliminate', variant: 'out', racerId }`.
- `RacerState.eliminatedAt?: number` — 탈락한 프레임 인덱스. 생존자/일반전은 undefined.
- `RacerState.eliminationOrder?: number` — 1-based 탈락 순번(1=가장 먼저 탈락). 생존자/일반전은 undefined.
  - **렌더러/셸은 이 두 필드로 어느 프레임에서든 탈락 순서를 복원 가능** (이벤트 히스토리 스캔 불필요).

## 랩 경계 판정 방식
- 엔진은 랩을 세지 않으므로 내부 카운터 `elimLapTarget`(1부터 시작)을 둠.
- 매 프레임 `advance` 직후 `applyEliminations()` 실행:
  - 활성 레이서(phase가 finished/waiting/eliminated 아님)의 **최대 progress(선두)**가 `elimLapTarget × trackLength` 이상이면 랩 경계 도달 → 1명 탈락, `elimLapTarget++`.
  - `while` 루프라 선두가 한 프레임에 여러 랩을 넘겨도 경계당 정확히 1명씩.
  - `first`=현재 1등(max progress), `last`=현재 꼴찌(min progress) 탈락. 동률은 고정 `procKey`로 결정론적 타이브레이크(RNG 없음).
- 활성 1명 남으면 루프 종료 → 그 1명이 생존자.
- 일반 골인(goal 통과) 비활성화: elimination 모드에서 `advance`는 goal 도달해도 finish 안 함 — 선두가 N-1번째 랩까지 계속 돌아야 하므로.

## 순위(rank)
`buildResult()`에서 `assignEliminationRanks()` 호출 (N=총원):
- `first`(선두탈락): rank = eliminationOrder (1번째 탈락=rank 1, 최고). 생존자=rank N(최하).
- `last`(꼴찌탈락): rank = N − eliminationOrder + 1 (1번째 탈락=rank N, 최하). 생존자=rank 1(우승).

## 종료 조건
`isRaceFinished()`: elimination 모드면 "활성 레이서 ≤ 1"로 분기. (relay/일반전 분기 보존)

## 변경한 파일
- `src/engine/types.ts` — 위 계약 전부.
- `src/engine/RaceEngine.ts`:
  - Internals에 `elimLapTarget`, `elimCount` 추가/초기화.
  - 7곳 비활성 제외에 `eliminated` 추가: resolveTimer, fireSkill, activeRunnerCount, activeMeanProgress, advance, applyItemPickup(active 술어), updateBoxes(박스 픽업 가드).
  - `applyEliminations()` 신규 + step()에서 advance/overtakeHooks 직후 호출.
  - `advance`에 elimination 모드 골인 비활성화.
  - `isRaceFinished`/`buildResult`/`assignEliminationRanks` 분기.
  - `autoMaxFrames`: elimination 모드는 laps 무시, 거리 = (N-1 + offset)×trackLength로 산정(시뮬 타임아웃 방지).
- **스킬/추월의 타깃·블로커 필터에도 `eliminated` 제외 추가**(중요 — 안 하면 탈락자가 banana/roar/mimic에 stun되어 부활 → 결정론·"경계당 1명" 위반):
  - `src/engine/skills/banana.ts`, `roar.ts`, `mimic.ts`, `abduct.ts`, `bristle.ts`
  - `src/engine/overtake.ts` (nearestRival, nearestAhead)

## 테스트
- `tests/unit/helpers.ts`: `makeConfig`에 `elimination?` 옵션(기본 undefined).
- `tests/unit/engine-determinism.test.ts`: "every racer finishes…" 테스트에 비-elimination 한정 주석.
- `tests/unit/engine-deathmatch.test.ts` 신규 5케이스:
  1. 결정론(같은 seed 2회 동일 탈락순서/order)
  2. 매 랩 정확히 1명 탈락 + 활성 1명 종료 + out 이벤트 N-1개 + 프레임당 ≤1
  3. first 모드 rank 방향(먼저 탈락=상위, 생존자=최하)
  4. last 모드 rank 방향(먼저 탈락=하위, 생존자=우승)
  5. 탈락자 progress 동결(탈락 후 전진 0)

## 결과
- `npm run typecheck`: 통과
- `npx vitest run`: **62 passed (9 files)**, 회귀 없음(일반전/팀전/릴레이/공정성 전부 그대로).

## 협업 노트
- content-designer: `GameMode.elimination?`/`modes.ts`의 값은 `'first'|'last'`로 고정(본 계약과 동일). 파일 겹침 없음.
- renderer-dev/shell-dev에 통지 필요:
  - 새 이벤트 `{type:'eliminate', variant:'out', racerId}` 소비.
  - `RacerState.phase==='eliminated'`, `eliminatedAt`, `eliminationOrder`로 탈락 연출/중앙배치/순서 복원.
  - `config.elimination`('first'|'last')로 감정 분기(선두탈락 vs 꼴찌탈락).
- qa-verifier: 결정론 영향 변경 = 스킬/추월 타깃 필터에 eliminated 제외 추가. elimination 전용 결정론 테스트로 커버됨.
