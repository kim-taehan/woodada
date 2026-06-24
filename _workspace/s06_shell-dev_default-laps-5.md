# s06 shell-dev — 기본 바퀴 수 5로 변경

## 요구
앱 첫 진입 시 바퀴 셀렉트가 5바퀴로 선택돼 있게 한다.

## 변경
- `src/shell/store.ts:36` — `RoomStore.laps` 기본값 `1` → `5` (한 줄, 외과수술식).

## 동작 흐름
- `SetupScreen.ts:140` 에서 `lapsSelect.value = String(store.laps)` 로 초기 선택값을 store에서 읽음 → 첫 화면에서 "5바퀴" 선택됨.
- 1~10 옵션 생성(139), change 핸들러(141) 그대로. 사용자가 다른 값 고르면 `store.laps`에 반영됨.
- 결정론/시드 무관. seedDefaults 등 다른 줄 미수정.

## 검증
- `npm run typecheck`: 본 변경으로 인한 신규 오류 0.
  - 남은 3개 오류는 기존/타 영역(`src/data/partmodels/cat.ts`, `tests/e2e/cat-black-tmp.spec.ts`)로 본 작업과 무관.
