# 08 · qa-verifier · Phase 1 (팀전 기반: 모드구조 + 편나누기 UI + 조끼) 최종 품질 게이트

설계: `docs/specs/2026-06-18-team-relay-vests-design.md` Phase 1
검증일: 2026-06-18 · **릴레이(Phase 2)는 검증 대상 아님**

## 결론: 전부 통과 ✅ — Phase 2(릴레이) 진입 가능

---

## 품질 게이트 (순서대로)

| 게이트 | 결과 | 비고 |
|---|---|---|
| 1. `npm run typecheck` | ✅ 0 errors | |
| 2. `npm run test` (Vitest) | ✅ **27/27** (7 files) | scoring 5(4팀 teamRankSum 포함)·determinism 4·bias 2·skills 4·schema 2·prng 6·overtake 4 |
| 3. `npx playwright test --project=desktop` | ✅ **8/8** | shell 4·race-visual 3·play 1 |
| 4. 스크린샷 육안 | ✅ team-vest 또렷·비가림, race-start/mid/result 회귀 없음 | 아래 코멘트 |

새 4팀 테스트 (`scoring.test.ts:43`) 통과: red/blue/white/black 8명 → `{red:6,blue:8,white:10,black:12}`, order `red>blue>white>black`. 합 36 = Σ1..8 검산 OK.

---

## 경계면 교차검증 (정합성 — 존재 확인 아님)

### 데이터 ↔ 셸 ✅
- `SetupScreen.ts`가 `teamOrder.slice(0, teamCount)`로 active 팀 산출, `TEAM_EMOJI`(🔴🔵⚪⚫)로 색칩 렌더 — `teamPalette`/`teamOrder` 올바로 소비.
- `modeSelect`는 `Object.values(gameModes)` = **individual·team 두 개만** 노출. 팀 모드 진입 시 `store.autoAssign()` 자동 호출로 빈 팀 없이 시작.
- `teamValidationError()`: 미배정·빈 팀이면 출발 버튼 disable + 힌트. team 모드 검증 동작.
- **옛 모드 id(2v2/3v3/2v2v2) 잔재 0건** (src/·tests/ grep clean).

### 셸 ↔ 엔진 ✅ (실측)
store에서 team 모드 RaceConfig 빌드 후 엔진 실제 구동:
- `teamCount=4` + `autoAssign()` → 8명 teamIds = `red,blue,white,black,red,blue,white,black`.
- `buildRaceConfig()` → `teamMode:true, scoringId:'teamRankSum', modeId:'team'`.
- `simulateRace()` → `result.scoring`: `type:'team'`, order `black>red>white>blue`, detail `{black:5,red:9,white:9,blue:13}` (합 36 검산 OK).
- `teamCount=2` 케이스도 `blue>red {blue:4,red:6}` (합 10 = Σ1..4 검산 OK).
- 흐름 확인: `resolveParticipants`(store.ts:97)가 `teamId` 실음 → `RaceEngine.ts:92` RacerState에 전달 → `scoring/team.ts:17` `teamId ?? id` 그룹핑. 완전 연결.

### 엔진/데이터 ↔ 렌더러 ✅
- `RaceRenderer.ts:261` → `new PartsCharacter(..., p.teamId)` 전달.
- `PartsCharacter.ts:92` `if (part.name==='body' && isTeamId(teamId))` 일 때만 vest 추가 → `teamPalette[teamId].fill/trim` 소비.
- **teamId 없으면 vest 미표시** = 개인전 외형 보존. race-start/mid/result 골든(DEFAULT_IDS, teamId 없음)에 조끼 0개로 실증.

### shell 범위결정 확인 (relay/teamCount 미탑재) ✅ 문제없음
- `buildRaceConfig`는 relay/teamCount를 RaceConfig에 **안 싣음** (엔진 RaceConfig에 필드 없음). 실측 결과 `cfg.relay/teamCount = undefined`.
- 이게 Phase 1 팀전(랭크합산)을 **막지 않음**: 팀 결과는 participant별 `teamId`만으로 산출되며 위 실측에서 정상 동작. teamCount는 셸 UI 분배 로직에만, relay는 Phase 2 토글이라 현재 무의미.

---

## 스크린샷 육안 코멘트

- **team-vest.png (골든, 단일팀)**: 강아지가 파란 조끼 착용. 몸통(가슴/등)에만 얹혀 얼굴·눈·귀·다리·꼬리 안 가림. 치비 귀여움 보존.
- **4색 검증(추가 캡처, mid-race)**: red(강아지)·blue(원숭이)·white(토끼)·black(코끼리) 4색 상호 구분 확인. 흰/검 조끼는 trim 외곽선 덕에 동색 몸통(흰 토끼/회색 코끼리)에서도 경계 또렷 — 설계 의도대로 작동. 어느 캐릭터도 안 가림.
  - 참고: 골든 team-vest.png는 단일팀(blue)만 담아 4색 구분 자체는 검증 못 함. 자동 회귀로 4색을 묶고 싶으면 race-visual.spec에 teamIds 캡처 1컷 추가 권장(차단 아님, 개선 제안).
- **race-start / race-mid / result**: 모두 조끼 0개(개인전), 회귀 없음. mid는 중계자막·말풍선·아이템박스·리더보드 정상, result는 파란필드 시상대 정상.

---

## 부수 관찰 (차단 아님)
- `schema.ts:67` `teamLayout?: {teams,perTeam}` — 옵셔널 레거시 필드, **소비자 0건**, 주석으로 "Unused now" 명시. 계약 위반 아니므로 그대로 둠(외과수술 원칙: 요청 없이 제거 안 함).

## Phase 2 진입 가능 여부
**가능.** 모든 게이트 통과 + 경계면 정합. 팀 랭크합산 파이프라인(store→engine→scoring→renderer vest)이 실측으로 닫힘. relay 필드는 store에 자리만 잡혀 있고 RaceConfig 미탑재 상태이므로, Phase 2에서 엔진 RaceConfig에 relay 필드 추가 시 buildRaceConfig 연결만 하면 됨.
