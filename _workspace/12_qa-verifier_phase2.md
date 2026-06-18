# Phase 2 (릴레이) 최종 품질 게이트 + 경계면 교차검증

검증일: 2026-06-18 · 대상: engine(릴레이 분기·scoring/relay·waiting 제외) + shell(릴레이 토글·균등검증) + renderer(대기열·바통·레그카운터)
결과: **전부 통과. 비릴레이 회귀 0. 릴레이 흐름 4개 계약 실측 일치. Phase 2 완료 가능.**

## 품질 게이트

| # | 게이트 | 결과 |
|---|---|---|
| 1 | `npm run typecheck` | 통과 — 타입 오류 0 |
| 2 | `npm run test` (Vitest) | 통과 — 33/33 (8 파일) |
| 3 | `npx playwright test --project=desktop` | 통과 — 9/9 |
| 4 | 스크린샷 육안 | 통과 — 릴레이 3장 + 비릴레이 회귀 3장 모두 정상 |

### Gate 2 상세 (비릴레이 회귀 0 + 신규 relay)
- overtake 4, prng 6, schema 2, scoring 5, skills 4 → 비릴레이 전부 green
- engine-determinism 4, engine-bias 2(모든 캐릭터·슬롯 승리 가능, 독주 없음) → green
- **relay.test.ts 6/6** (결정론·핸드오프순서·앤커스코어링·waiting면역·teamRelay전략·1인팀)

### Gate 3 상세
- relay-visual.spec 1, race-visual 3, play(풀레이스) 1, shell 4 → 전부 green
- e2e 콘솔 eventFrames에 `relay:handoff` 이벤트 실제 emit 확인 (frame 682)

## 경계면 교차검증 (실측)

셸 `RoomStore.buildRaceConfig` 경로로 릴레이 config(team모드·relay:true·2팀×2명, autoAssign)를 만들어 엔진 구동해 직접 측정:

- **셸↔엔진 ① scoringId 분기**: `relay && mode.team` → `scoringId='teamRelay'` 실측 일치 (store.ts:135,145).
- **셸↔엔진 ② 동시 활성 주자 = 팀 수**: 주행 중 활성 러너 max=2(=팀 수), 팀당 동시 활성 ≤1 위반 0건.
- **셸↔엔진 ③ 레그 교대(결승선·참가순)**: handoff 2건(= 인원합 4 − 팀 2). 각각 finisher progress≈1000(트랙길이)에서 leg 0→leg 1로, 참가순서 큐의 다음 주자에게. red: p0(1000)→p2 @563, blue: p1(1001)→p3 @660.
- **셸↔엔진 ④ 팀 순위 = 앤커 골인 순**: 앤커 red:p2 blue:p3. finishFrame red:1273 blue:1289 → scoring.order=[red,blue] = 기대값 MATCH. scoring.type='team'.
- **엔진↔렌더러 핸드오프**: 엔진 emit `{type:'relay',variant:'handoff',racerId,targetId}`(RaceEngine.ts:268, targetId 항상 존재) → 렌더러 `relay:handoff` 수신(RaceRenderer.ts:215) → `fx.baton(...)`(FxLayer.ts:97) + commentary `relay:handoff`(commentaryLines.ts:12). 연결 확인.
- **엔진↔렌더러 waiting/leg**: `phase==='waiting'`는 본선 미표시·대기열 파킹(RaceRenderer.ts:336,370), `RacerState.leg`로 "n/total 주자" 레그카운터(465-470). 연결 확인.
- **셸 검증 로직**: `teamValidationError()`(SetupScreen.ts:27) — 릴레이 ON & 불균등이면 '릴레이는 팀 인원이 같아야 해요 🏃' 반환→`startBtn.disabled=true`(88). 균등이면 null→활성. 비릴레이는 불균등 통과(빈 팀·미배정만 차단). 로직 일치.

## 비릴레이 불변 재확인 (골인 주자 부활 차단)
- 부활 차단 가드가 4개 변이 경로(resolveTimer:159, tryActivateSkill:192-193, advance:227, updateBoxes:281) 일관 적용. 추가된 `'waiting'` 절은 비릴레이에선 no-op(비릴레이는 waiting 페이즈 부재)이므로 비릴레이 결정론에 영향 없음 — engine-determinism·engine-bias green이 이를 입증.
- 엔진 순수성: src/engine/에 DOM/Pixi/Math.random 0건(prng.ts의 유일한 매치는 "never Math.random()" 주석).

## 스크린샷 육안
- **relay-start.png**: 본선에 팀당 1명(원숭이4·코끼리5·곰6 + 결승선 곰1)만, 대기 주자는 결승선 옆 줄서기. 헤더 "1/2 주자". 대기열↔본선 분리 정상.
- **relay-handoff.png**: 헤더 "2/2 주자" + "🔔 마지막 주자!" 배너 + 종, 앤커 주행. 레그 카운터 전환 정상.
- **relay-leg.png**: 앤커 주행 중, 곰 조끼(파란 vest) 식별. 조끼 렌더 정상.
- **race-mid.png / result.png / race-start.png** (비릴레이): 선두교체 자막·시상대·출발 정상 — 회귀 없음.

## 결론
3개 영역 변경이 계약을 깨지 않음. 팀편성 + 조끼 + 릴레이 전체 기능 **완료 가능**. 회부할 실패 없음.
