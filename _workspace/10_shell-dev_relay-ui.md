# Phase 2 셸 — 릴레이 토글 UI + 균등 팀 검증 (shell-dev)

## 범위
UI/검증만. 엔진·렌더러·`buildRaceConfig`는 손대지 않음(이미 동작 확인됨).

## 변경 파일
1. `src/shell/store.ts`
   - `activeTeams()` private → public (검증 헬퍼에서 재사용).
   - `teamCounts(): Map<TeamId, number>` 신규 — 활성 팀별 인원 수(미배정 제외). 균등 판정에 사용.
2. `src/shell/screens/SetupScreen.ts`
   - `teamValidationError()`를 `store.teamCounts()` 기반으로 정리. 릴레이 분기 추가:
     - 미배정 0 & 각 팀 ≥1 (기존 유지, 불균등 허용).
     - **릴레이 ON일 때만** 모든 활성 팀 인원이 동일해야 통과. 불균등이면 `'릴레이는 팀 인원이 같아야 해요 🏃'` 안내 + 출발 비활성.
   - 팀 블록(`team-block`) 안에 릴레이 체크박스 토글 추가: `🔁 릴레이 (이어달리기)`. `change` 시 `store.relay = checked` + `refresh()`.
   - 토글은 `teamBlock` 내부에 있어 `syncTeamBlock()`이 개인전에서 블록째 숨김 → 릴레이 토글도 자동 숨김.
3. `src/shell/styles.css`
   - `.relay-toggle` / `.relay-toggle input` 최소 스타일 추가(체크박스 + 라벨 가로 정렬).

## 동작 요약
- 개인전: 릴레이 토글·팀 컨트롤 전부 숨김. 검증 통과(팀 검증 null).
- 팀전 릴레이 OFF: 미배정0 & 각 팀≥1 이면 출발 활성(불균등 허용).
- 팀전 릴레이 ON: 위 + 활성 팀 인원이 모두 같아야 출발 활성. 다르면 출발 비활성 + 안내 자막.
- 모드/팀수/팀배정/릴레이 변경 모두 `refresh()` 경로로 검증 재평가.

## 자가검증
- `npm run typecheck` → 0 에러.
- `npx playwright test shell.spec.ts --project=desktop` → 4/4 통과(회귀 없음).

## 비고
- 균등 판정 헬퍼는 store에 (`teamCounts`) 배치 — 직렬화 상태와 무관한 순수 파생값, drafts 단일 출처 유지.
- `buildRaceConfig`의 relay→scoringId='teamRelay' 자동설정은 engine-dev 기존 동작 그대로 사용.
