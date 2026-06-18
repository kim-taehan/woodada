# Phase 2 (엔진) — 릴레이(이어달리기) 시뮬레이션 모델

작성: engine-dev / 2026-06-18
범위: `config.relay` 게이트로만 분기하는 릴레이 엔진. 비릴레이 경로 무변경(회귀 0).

## 릴레이 모델 요약

- **레그 큐**: teamId별 참가 순서 = 레그 순서(앤커 = 마지막). teamId 없으면 `?? p.id`로 1인 1팀(방어적). 순수 파생, RNG 무관, 드로 순서 비의존.
- **goal**: 릴레이 = `trackLength`(주자당 정확히 1바퀴). 비릴레이 = `trackLength * laps`(기존).
- **초기 상태**: 각 팀 leg0만 `running`, 나머지 `waiting`(progress 0, speed 0, 트랙 밖).
- **핸드오프**: 활성 주자가 goal 도달 → `finished`(파킹, finishedAt/rank 부여) → 다음 레그 팀원을 `waiting`→`running`으로 결승선(progress 0)에서 출발 + `relay/handoff` 이벤트 emit. 앤커(마지막 레그) 골인은 핸드오프 없음(= 팀 골인).
- **팀 완주/순위**: 앤커 골인 프레임 순(`teamRelay` 스코어링).
- **동시 활성 주자 수 = 팀 수**(팀당 정확히 1명).

## 발견·수정한 잠복 버그 (비릴레이엔 안 드러났던 것)

릴레이는 일부 주자가 레이스 중간에 `finished`가 되고 다른 주자는 계속 달리므로(프레임이 계속 진행), `finished` 주자가 부활(resurrect)하는 두 경로가 노출됨. 둘 다 "끝난 주자는 절대 다시 달리면 안 된다"는 불변식 위반이라 비릴레이에서도 잠복 버그였음. 최소 가드로 수정:

1. `tryActivateSkill`: `finished`(+`waiting`) 주자 스킬 발동 차단. (예: dog zoomies가 끝난 주자를 `straying`으로 바꿔 다시 전진시키던 문제)
2. `resolveTimer`: `finished`(+`waiting`) 주자는 stale transient 타이머로 부활시키지 않음. (예: 골인 순간 `straying`였던 주자가 타이머 만료로 `running` 복귀)

비릴레이 영향: 골인 직후 프레임에서만 작동하던 자기-부활을 막는 것이라 결정론/공정성 테스트 전부 그대로 통과(아래 결과). 밸런스 하니스 수치도 동일.

## 변경 파일

- `src/engine/types.ts` — `RaceConfig.relay: boolean`, `RacerPhase` `'waiting'`, `RacerState.leg?: number`, `SkillEvent.variant` `'handoff'`.
- `src/engine/RaceEngine.ts` — 레그 큐 구성, 초기 phase/leg, goal 분기, `advance`의 `waiting` 스킵 + 릴레이 핸드오프, `handoff()` 신설, `tryActivateSkill`/`resolveTimer`/`updateBoxes`에 `finished`/`waiting` 가드.
- `src/engine/skills/roar.ts`·`banana.ts`·`nap.ts` — 대상/순위 계산에서 `waiting` 제외. (zoomies/brace는 self만 변이 → 엔진이 활성 주자만 발동시키므로 변경 불필요.)
- `src/engine/overtake.ts` — `nearestAhead`가 `waiting` 주자를 블로커/밀치기 대상에서 제외.
- `src/engine/scoring/relay.ts` (신규) — `teamRelay`: 팀 순위 = 앤커 골인 순. `scoring/index.ts`에 등록.
- `src/shell/store.ts` — `buildRaceConfig`가 `relay`(team && store.relay) 전달, 릴레이면 `scoringId='teamRelay'` 강제.
- `src/main.ts`·`scripts/balance.ts` — `relay: false` 추가(비릴레이 명시).
- `tests/unit/helpers.ts` — `makeConfig`에 `relay?` 옵션.
- `tests/unit/relay.test.ts` (신규) — 결정론/핸드오프/앤커 스코어링/waiting 면역/스코어링 단위/1인팀.

## 자가검증 결과

- `npm run typecheck`: 통과(에러 0).
- `npx vitest run`: **33 tests / 8 files 전부 통과** (기존 27 + 릴레이 6, 비릴레이 회귀 0).
  - 결정론: 같은 (relay config+seed) 두 번 → 동일 프레임 해시 + 동일 팀 순위.
  - 핸드오프: 각 팀 정확히 (인원) 레그, 결승선에서, 참가 순서대로. 동시 활성 ≤ 1/팀.
  - 앤커 스코어링: 팀 순위 = 앤커 골인 프레임 순.
  - waiting 면역: 대기 주자 progress/speed 0 불변, 어떤 스킬/아이템 이벤트도 대기 주자를 타겟하지 않음.
- 밸런스 하니스(`scripts/balance.ts`): 개인전 수치 변동 없음(dog .295 / rabbit .244 / monkey .118 / elephant .131 / bear .212, lead changes 8.4) — 비릴레이 경로 무변경 확인.

## 후속 회부 명세 (shell-dev · renderer-dev 의존)

1. **`RaceConfig.relay` 필드명/위치**: `RaceConfig.relay: boolean` (`src/engine/types.ts`). 셋업에서 `store.relay && mode.team`일 때 true. 릴레이면 `scoringId`는 `'teamRelay'`로 자동 설정됨(store.buildRaceConfig가 처리). shell은 store.relay 토글만 채우면 됨.

2. **핸드오프 이벤트 형태**: `SkillEvent` =
   `{ frame, racerId: <레그 완주한 주자 id>, type: 'relay', variant: 'handoff', targetId: <다음 레그 주자 id> }`.
   `line` 없음. 렌더러는 `type==='relay' && variant==='handoff'`로 받아 바통 터치 FX/자막을 `racerId→targetId` 결승선 위치에 띄우면 됨.

3. **`RacerPhase 'waiting'` 의미**: 릴레이에서 자기 레그 차례를 아직 시작하지 않은 대기 주자. `progress=0, speed=0`, 트랙 밖(결승선 옆 대기열). 렌더러는 `phase==='waiting'`인 주자를 트랙에 그리지 말고 대기 표시. 활성 주자는 `phase` ∈ {running/blocked/straying/...}, 레그 끝난 주자는 `finished`.

4. **레그/바퀴 진행 읽는 법**:
   - 각 주자 `RacerState.leg`(0-base 레그 인덱스, 참가 순서; 앤커 = 큐 마지막). 릴레이에서만 정의, 비릴레이는 `undefined`.
   - **팀의 현재 레그** = 그 팀에서 `phase==='running'`(활성)인 주자의 `leg`. 렌더러는 "(leg+1)/팀인원 주자"로 레그 카운터 표시.
   - **레그 내 진행도** = `progress / trackLength` (릴레이는 주자당 정확히 1바퀴라 항상 0..1). 랩 카운터를 레그 카운터로 전환할 때 이 값 사용.

## 팀 통신

- renderer-dev: 새 이벤트 `SkillEvent.variant 'handoff'`(type `'relay'`)와 새 phase `'waiting'`이 추가됨 → 바통 FX + 대기열 + 레그 카운터 연출 필요. 위 §2~§4 참조.
- qa-verifier: 결정론에 영향 주는 변경 있음(릴레이 분기 + finished 부활 가드 2건). 비릴레이 결정론/공정성 테스트는 전부 통과(회귀 0). 릴레이 결정론 테스트 신규 추가됨.
- content-designer/shell-dev: 새 스킬 type 추가 없음(`'relay'`는 핸들러 아닌 엔진 emit 이벤트). KNOWN_SKILL_TYPES 갱신 불필요. shell은 store.relay 토글만 채우면 엔진이 나머지(레그/핸드오프/스코어링) 처리.
