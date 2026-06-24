# s25 — 팀전 3모드 선택 UI (shell-dev)

#28 2단계. scoremode(s24)가 만든 계약을 셸에서 소비. 엔진/데이터/렌더러 무수정.

## 한 일
1. **store** (`src/shell/store.ts`)
   - `relay: boolean` 필드를 **제거**하고 `teamScoringId: TeamScoringId`(기본 `defaultTeamScoringId='rankSum'`) 도입 → 단일 출처.
   - `buildRoomState`: 팀전이면 `scoringId = TEAM_SCORING_TO_ID[teamScoringId]`, 개인전은 `mode.scoringId`(individual). 기존엔 항상 `mode.scoringId`(고정 teamRankSum)였음 → 이제 선택 반영.
   - `buildRaceConfig`: `relay = mode.team && teamScoringId === 'relay'`로 파생. `scoringId`는 room에서 가져옴(relay 분기 제거 — room.scoringId가 이미 teamRelay).
   - import에 `schema.ts`의 `defaultTeamScoringId, TEAM_SCORING_TO_ID, TeamScoringId` 추가.

2. **SetupScreen** (`src/shell/screens/SetupScreen.ts`)
   - 기존 릴레이 체크박스(`relay-toggle`)를 **3택1 `<select>`**로 대체. `modes.ts`의 `teamScoringOptions` 라벨 사용(1등 보유 / 등수 합 / 이어달리기).
   - teamGroup(팀전일 때만 표시) 안에 `팀 수` select + `모드` select 나란히. 기존 select 관용구(teamCountSelect/arenaSelect)와 동일 패턴.
   - 개인전이면 teamGroup 통째로 `display:none`(기존 syncModeUI 그대로) → 모드 select도 안 보임.

3. **main.ts** 캡처훅 (`configFor`)
   - `scoringId` 분기를 `team ? TEAM_SCORING_TO_ID[relay ? 'relay' : 'rankSum'] : 'individual'`로 일반화. 캡처훅은 relay/non-relay만 구분하므로 동작 보존(기존: relay→teamRelay, 팀→teamRankSum, 개인→individual과 동일).
   - `relay` 불리언 파라미터·호출부(simulate/showRaceAt)는 그대로 유지.

4. **styles.css**: 내 변경으로 고아가 된 `.relay-toggle` / `.relay-toggle input` 규칙 2줄 삭제(체크박스 제거로 미사용). 다른 스타일 미수정.

## 검증
- `npm run typecheck` 통과 (에러 0).
- vite-node로 `buildRaceConfig` 직접 점검:
  - rankSum → scoringId=teamRankSum, relay=false
  - firstPlace → scoringId=teamFirstPlace, relay=false
  - relay → scoringId=teamRelay, relay=true
  - 개인전 → scoringId=individual, relay=false
  - 4경로 모두 teamMode 정확.

## 직렬화/결정론
- `teamScoringId`는 문자열 → RoomState.scoringId로 직렬화됨. 비직렬화 값 없음.
- 시드/random 미사용. 같은 (config+seed) 같은 경주 유지.

## 건드리지 않은 것
- 엔진/데이터(s24 완성분)/렌더러 전부. 특히 `RaceRenderer.ts` 무수정(introfx와 충돌 회피).
- 기존 _workspace 파일.

## 참고 (계약 변동 — 다운스트림 주의)
- `RoomStore.relay` 필드는 **사라짐**. 외부에서 `store.relay`를 읽던 곳이 있으면 `store.teamScoringId === 'relay'`로 바꿔야 함(현재 셸 내 사용처 없음 확인). `RaceConfig.relay` 필드는 그대로 존재(records.ts 등 소비처 영향 없음).
