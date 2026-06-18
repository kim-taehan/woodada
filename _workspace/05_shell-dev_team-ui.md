# 05 shell-dev — 편 나누기 UI + RoomStore 팀 배정 (Phase 1)

설계: `docs/specs/2026-06-18-team-relay-vests-design.md` §2(store), §3(편 나누기 UI).
범위: **비릴레이 팀전(동시출발 랭크합산)**까지. 릴레이는 Phase 2 → 릴레이 토글 UI 미구현, store에 `relay` 필드만 기본 false로 추가.

## 변경 파일
- `src/shell/store.ts` — 팀 상태 필드 + 배정 메서드.
- `src/shell/screens/SetupScreen.ts` — 팀 UI(팀 수 셀렉터·자동 편성·팀 색 칩·검증).
- `src/shell/styles.css` — 팀 칩/컨트롤/안내 텍스트 스타일.

## 새 store API (`RoomStore`)
- `teamCount: number` — 기본 2, 활성 팀 수(2~4).
- `relay: boolean` — 기본 false (Phase 2용, 아직 UI/엔진 미연결).
- `DraftParticipant.teamId: TeamId | undefined` (string → `TeamId` 좁힘).
- `setTeam(index, teamId: TeamId)` — 해당 인원 팀 지정.
- `autoAssign()` — 활성 팀(`teamOrder` 앞 `teamCount`개)에 `i % teamCount` 라운드로빈 균등 배분.
- `setTeamCount(n)` — 2~4 클램프. 범위 밖(또는 미배정) teamId 가진 인원만 `i % teamCount`로 재배분(이미 유효한 배정은 보존).
- (private) `activeTeams()` — `teamOrder.slice(0, teamCount)`.

직렬화: 추가 필드 전부 primitive → `RoomState`/직렬화 영향 없음. `buildRaceConfig`는 **미변경**(엔진 `RaceConfig`에 아직 `relay`/`teamCount` 필드 없음 = Phase 2). 필요 시 Phase 2에서 config에 실으면 됨.

## SetupScreen 상호작용
- 모드 셀렉트 `change` → `store.modeId` 갱신. **team 진입 시 `autoAssign()` 1회 자동 호출**(빈 팀 없이 시작) 후 팀 블록 표시/`refresh()`.
- 팀 블록(`.team-block`)은 **team 모드일 때만** 표시(`syncTeamBlock()`), 개인전이면 `display:none`.
- **팀 수 셀렉터**(2팀/3팀/4팀) → `setTeamCount()` + refresh.
- **`자동 편성 🎲` 버튼** → `autoAssign()` + refresh.
- 각 참가자 행: 기존 캐릭터 칩 옆에 **팀 색 칩 행**(`.team-chips`), 활성 팀 수만큼. 라벨 = 색 이모지(🔴🔵⚪⚫). 현재 `d.teamId` 칩에 `active`. 칩 클릭 = `setTeam(i, id)` + refresh. (기존 `mk()` 칩 패턴과 동일 구조.)
- **검증**(`teamValidationError()`, 팀 모드 한정, 비릴레이): 미배정 0명 & 각 활성 팀 ≥1명이어야 출발 활성. 불균등은 허용. 미충족 시 `출발` 비활성 + 짧은 안내 텍스트(`.team-hint`). 개인전은 기존대로 인원 ≥2만 확인.
- "3초 출발" 철학·progressive disclosure(`<details class="options">`)·IME 가드 모두 유지. 개인전 흐름·첫 화면 불변.

## renderer-dev / qa 회부
- **참가자에 teamId가 실리는 경로**: `RoomStore.resolveParticipants(seed)` 가 각 draft를 매핑하며 `{ id, name, characterId, teamId: d.teamId }` 로 `teamId`를 `RaceParticipant`에 그대로 실음 (`store.ts`). → 렌더러는 `participant.teamId` → `teamPalette[teamId]` 로 조끼 색 매핑.

## 자가검증
- `npm run typecheck` → 0 error.
- `npx playwright test shell.spec.ts --project=desktop` → 4 passed (회귀 없음; 기본 모드 individual이라 팀 UI는 첫 화면에서 숨김).
