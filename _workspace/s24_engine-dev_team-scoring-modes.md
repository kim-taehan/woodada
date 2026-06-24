# s24 — 팀전 3모드 스코어링 계약 (engine-dev)

## 한 일
1. **teamFirstPlace 스코어링 신규** — `src/engine/scoring/firstPlace.ts`
   - 1등 완주 동물이 속한 팀이 우승. 나머지 팀은 각 팀의 최상위(최소 등수) 멤버로 정렬, 동률은 다음 멤버로(오름차순 랭크 lexicographic). 승자 규칙은 `teamAce`와 동일하나, 팀모드 선택 → 스코어링 id 1:1 매핑을 위해 별도 분리.
   - `detail[teamId]` = 팀의 최상위 완주 등수.
   - 팀없는 참가자는 1인 팀(`?? p.id`), team.ts/relay.ts와 동일 fallback.
2. **레지스트리 등록** — `src/engine/scoring/index.ts`에 `r.register('teamFirstPlace', teamFirstPlace)` 추가.
3. **선택 가능한 팀 플레이버 도입** — `src/data/schema.ts`
   - `ScoringId`에 `'teamFirstPlace' | 'teamRelay'` 추가(기존 누락분 포함).
   - `TeamScoringId = 'firstPlace' | 'rankSum' | 'relay'` (셸이 셋업에서 고르는 식별자).
   - `defaultTeamScoringId = 'rankSum'` (기존 고정 teamRankSum 동작 보존).
   - `TEAM_SCORING_TO_ID` 매핑: firstPlace→teamFirstPlace, rankSum→teamRankSum, relay→teamRelay.
4. **모드 데이터** — `src/data/modes.ts`에 `teamScoringOptions`(셋업 라벨: 1등 보유 / 등수 합 / 이어달리기) 추가.
5. **단위테스트** — `tests/unit/scoring.test.ts`에 teamFirstPlace 2케이스(1등 보유 팀 승리, 1등 뺏기면 승자 뒤집힘).

## 후속 단계용 계약 명세 (셸/렌더러가 소비)

### 모드 전달 흐름
- 셸은 팀전 셋업에서 `TeamScoringId`('firstPlace'|'rankSum'|'relay')를 store에 보관(예: `store.teamScoringId`, 기본 `defaultTeamScoringId='rankSum'`).
- config 빌드 시 `TEAM_SCORING_TO_ID[teamScoringId]`로 `RaceConfig.scoringId`를 결정.
- **릴레이 연동**: teamScoringId==='relay'일 때 `RaceConfig.relay = true` + (기존처럼) `config.relay` 경로/대기열 사용. 나머지 둘은 `relay=false`.
- 즉 main.ts의 `configFor` 분기(`relay ? 'teamRelay' : team ? 'teamRankSum' : 'individual'`)를 셸은 `team ? TEAM_SCORING_TO_ID[teamScoringId] : 'individual'`로 일반화하면 됨. (※ main.ts 캡처훅은 이번에 미수정 — 셸 작업자가 store 연결할 때 함께 일반화 권장. 기존 동작은 그대로 유지됨.)

### 필드 요약
- `RaceConfig.scoringId: string` — 엔진이 레지스트리에서 strategy를 꺼내는 키. 값: `individual | teamRankSum | teamFirstPlace | teamRelay`.
- `RaceConfig.teamMode: boolean`, `RaceConfig.relay: boolean` — 기존 그대로.

### winner 획득법 (렌더러)
- `result.scoring.order` 는 **승자 우선** 배열. 팀전이면 teamId 배열, 개인전이면 racerId 배열.
- **우승팀 = `result.scoring.order[0]`**, 2등팀 = `order[1]` … (3모드 모두 동일 계약).
- `result.scoring.detail[teamId]` = 모드별 점수: teamRankSum=등수합, teamFirstPlace=최상위 등수, teamRelay=anchor 등수.
- `result.scoring.type` = 'team' | 'individual'.

## 검증
- `npm run typecheck` 통과.
- `npx vitest run scoring.test.ts relay.test.ts schema.test.ts` → 20/20 통과(신규 teamFirstPlace 포함).
- 전체 `npm run test`: 56/57 통과. 유일 실패는 `engine-bias.test.ts`의 slot-fairness 통계 경계(173 < 165 기대) — **RaceEngine.ts 구동**이며 내 변경(scoring/data/test)과 무관. 해당 파일은 spread2 engine-dev가 #25로 동시 수정 중(git status상 이미 modified). 내 스코어링/데이터는 시뮬레이션 루프에 영향 없음.

## 건드리지 않은 것
- `src/engine/RaceEngine.ts`, `src/engine/tuning.ts` — 제약대로 미수정.
- `src/main.ts` — 캡처훅은 셸 통합 시점에 일반화(현재 동작 보존). 기존 _workspace 파일 미수정.
