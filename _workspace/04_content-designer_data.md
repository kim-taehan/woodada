# 04 content-designer — Phase 1 데이터 토대

## 작업 범위
team-relay-vests 설계(`docs/specs/2026-06-18-team-relay-vests-design.md`)의 §1(모드 구조)·§2(데이터 모델) 중 **데이터 계약**만. 셸/렌더러/엔진은 후속 에이전트.

## 변경/신설 파일
| 파일 | 상태 | 내용 |
|---|---|---|
| `src/data/teams.ts` | 신설 | 팀 팔레트 단일 출처 (4팀 고정) |
| `src/data/modes.ts` | 재정의 | 고정 팀모드 제거 → `individual`/`team` |
| `src/data/schema.ts` | 최소 수정 | `teamLayout` 주석만 갱신(타입은 optional 유지, 더 이상 사용 안 함) |

## teams.ts — export API (후속 import 대상)

```ts
export type TeamId = 'red' | 'blue' | 'white' | 'black';

export interface TeamPalette {
  id: TeamId;
  label: string;
  fill: string;   // 조끼 색
  trim: string;   // 가독성 외곽/트림
}

export const teamPalette: Record<TeamId, TeamPalette>;
export const teamOrder: TeamId[]; // ['red','blue','white','black']
```

색상값:
| id | label | fill | trim |
|---|---|---|---|
| red | 레드 | `#E2483D` | `#8E2A23` (자체 어두운 외곽) |
| blue | 블루 | `#2F6BE0` | `#1C3F87` (자체 어두운 외곽) |
| white | 화이트 | `#F4F4F4` | `#444444` |
| black | 블랙 | `#2B2B2B` | `#DDDDDD` |

red/blue의 trim은 스펙의 "자체 어두운 외곽" 지시대로 각 fill의 어두운 음영으로 산출.

## modes.ts — 변화
- 제거: `2v2`, `3v3`, `2v2v2` (고정 `teamLayout` 포함).
- 신설: `team` = `{ id:'team', label:'팀전', team:true, scoringId:'teamRankSum' }`. 고정 layout 없음(팀 수·릴레이는 런타임 store/RaceConfig 보유).
- 유지: `individual` (그대로), `defaultModeId='individual'`.
- `gameModes` 시그니처 `Record<string, GameMode>` 불변 → 기존 소비자 무수정.

## schema.ts
- `GameMode.teamLayout`은 optional 그대로 유지(타입 깨짐 방지). 주석만 "legacy, unused" 로 갱신.
- `RaceParticipant.teamId`(엔진 types)는 미접촉 — engine-dev 영역.
- `TeamId`로 schema를 좁히지 않음(과한 결합 회피). 렌더러/셸이 `teams.ts`에서 직접 import.

## 옛 모드 id / teamLayout grep 결과 (변경 후)
```
src/data/schema.ts:67  teamLayout?: { teams: number; perTeam: number };   ← 의도적 잔존(optional 타입)
src/data/modes.ts:6    주석 내 "teamLayout" 언급                          ← 주석
```
**코드 레벨로 옛 모드 id(`2v2`/`3v3`/`2v2v2`)를 참조하는 곳 0건.** 깨진 외부 참조 없음.

### 소비자 정합 확인 (참조 추적)
- `src/shell/screens/SetupScreen.ts:94` — `Object.values(gameModes)`로 드롭다운 구성. 새 두 모드 자동 반영. OK.
- `src/shell/store.ts:75,94` — `gameModes[modeId].scoringId` 소비. `team` 모드가 `teamRankSum` 제공. OK.
- `src/engine/scoring/*`·`tests/unit/scoring.test.ts`·`skills.test.ts` — `teamRankSum` 문자열을 직접 쓰며 모드 id에 무관. 영향 없음.

## 후속 에이전트 회부
- **shell-dev**: `store.ts`에 `teamCount`/`relay` 추가, `SetupScreen` 편 나누기 UI는 `teams.ts`의 `teamPalette`/`teamOrder` 소비. `DraftParticipant.teamId`를 `TeamId`로 채움.
- **renderer-dev**: 조끼 색은 `teamPalette[teamId].fill`, 외곽은 `.trim`.
- **engine-dev**: `RaceConfig.relay`, `RacerPhase 'waiting'`는 Phase 2. 이번 데이터 작업과 분리.
- **qa-verifier**: schema.test.ts의 catalog/모드 목록에 옛 id 가정이 있으면 갱신 필요(현재 grep상 없음). 별도 점검 권장.

## 자가검증
- `npm run typecheck` → 0 error.
