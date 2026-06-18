# 35 — shell-dev: 경기 신기록(B) + 시상식 보러가기 버튼 흐름(C)

엔진/렌더러 계약은 소비만, `src/shell/`만 수정. 폭죽은 렌더러(Pixi) 손대지 않고 결과 오버레이 DOM/CSS로 구현.

## 변경 파일
- **신규** `src/shell/records.ts` — localStorage 기록 모듈.
- `src/shell/RaceController.ts` — `run()` 자동 전환 제거 + `coast()`/`showResult()` 추가.
- `src/shell/App.ts` — finished → 코스트 + "시상식 보러가기" 게이트 → 클릭 시 시상식 전환, 전환 직전 기록 비교/저장.
- `src/shell/screens/ResultScreen.ts` — `record` 인자 + 기록 패널/배너/폭죽 DOM.
- `src/shell/styles.css` — `.finish-gate/.podium-gate`, `.records/.record-banner`, `.confetti` 스타일.
- `tests/e2e/play.spec.ts` — 게이트 클릭 단계 + 기록 표시 단언으로 갱신(아래 "e2e" 참조).

## Feature B — 경기 신기록

### 시간 산식 (결정론)
승자(1등) 도착 프레임 × DT_MS. `records.ts`:
```ts
winnerTimeMs(result) = (result.finishFrame[result.order[0]] ?? 0) * DT_MS  // DT_MS = 1000/60
```
표시: `formatSeconds(ms) = (ms/1000).toFixed(1)` → 예 `12.2초`. (같은 config+seed면 같은 시간 → 공정.)

### 기록 키 = `${mode}-${laps}lap`
모드는 `RaceConfig`에서 유도(인원수 무관):
```ts
modeOf(config) = config.relay ? 'relay' : config.teamMode ? 'team' : 'individual'
recordKey(config) = `${modeOf(config)}-${config.laps}lap`  // 예: individual-1lap, team-10lap, relay-10lap
```
릴레이가 단순 팀보다 우선(릴레이는 teamMode이기도 하므로 순서 중요).

### 저장/비교
`localStorage['woodada:records'] = { [key]: bestTimeMs }`. `recordOutcome(config, result)`:
- `isNew = 기존 없음 || timeMs < 기존` → 더 빠르면 저장 + 플래그.
- 반환 `{ timeMs, bestMs, isNew }`. `App.showResult`에서 **시상식 전환 시 정확히 1회** 호출(기록 중복 저장 방지). localStorage 접근은 try/catch(프라이빗 모드/쿼터 대비, best-effort).

### 표시 + 폭죽
결과 카드: 우승자 → (신기록이면)`🎉 세계 신기록 달성!` 배너 → `.records`(이번 기록 / 최고 기록, 신기록이면 골드 강조) → 순위표 → 다시하기/설정. 폭죽은 `buildConfetti()`가 40개 컬러 조각을 만들어 `.confetti` 레이어로 **카드 뒤(오버레이 맨 앞 자식)**에 깔아 결과표를 가리지 않음. 순수 CSS `@keyframes confetti-fall`(낙하+회전). `prefers-reduced-motion`에서 애니메이션 off.

## Feature C — "시상식 보러가기" 버튼 흐름

엔진 finished 시 바로 시상식으로 가지 않음:
1. `RaceController.run()` — finished에서 `renderer.showResult` 호출 제거, 결과만 resolve.
2. `App.startRace()` — resolve 후 `controller.coast()` 시작(렌더러 finish-clock만 rAF로 진행 → 코스트/산개/깝치기 #33가 트랙 위에서 계속 재생, 엔진 미변경 = 기존 `settle()`의 라이브 버전) + 화면 중앙 `🏆 시상식 보러가기` 게이트 오버레이.
3. 게이트 클릭 → `controller.showResult(result)`(coast rAF 취소 + `renderer.showResult` = 파란 필드 시상대) + `buildResultScreen`(결과표 + 기록/폭죽 + 다시하기/설정).

`stop()`은 coast rAF도 취소(teardown 누수 방지). **캡처 훅 영향 없음**: `window.__woodada`(simulate/showRaceAt)는 `seek`/`settle`만 쓰고 `run()`의 자동 전환에 의존하지 않음 — 그대로 동작.

## 직렬화/결정론 불변
- `RoomState`/`RaceConfig`에 비직렬화 값 추가 없음(기록은 store 상태가 아니라 결과에서 파생).
- 기록 시간은 결정론적 sim 프레임 기반 — wall-clock 미사용.

## 시각 검증 (Read로 육안 확인)
- **finish 게이트**: 트랙 위 코스트/산개/이모트(하트·별·"받았다!") + 중앙 `🏆 시상식 보러가기` 버튼. Live Top3/순위 HUD 유지. (확인 완료)
- **결과 화면**: 파란 시상대 + 결과표 + `이번 기록 12.2초 / 최고 기록 12.2초` + `🎉 세계 신기록 달성!` 배너 + 카드 뒤 폭죽. (`tests/e2e/__screens__/result.png`, 확인 완료)
- 신기록 트리거: Playwright는 컨텍스트마다 localStorage가 비어 첫 경기가 항상 신기록 → 배너/폭죽 노출.

## e2e
- `play.spec.ts`: 기존 셀렉터(`input[aria-label="participant name"]`, `.mapping-grid`)는 **현 SetupScreen 재설계로 이미 깨진 상태**(내 변경 이전). 현재 UI(`+ 참가자 추가`)에 맞춰 이름 추가로 갱신하고, 더 이상 UI에 없는 추첨 매핑 단계 제거. 게이트 가시성→클릭(`force:true`, 버튼 bob 애니메이션이 Playwright의 stable 판정에 걸림)→결과 오버레이+`.records .record-time` 2개 단언 추가. **통과**(18s), 골든 `result.png` 갱신.
- `shell.spec.ts`의 3개 실패는 동일한 옛 `participant name` 셀렉터 기반으로 **내 작업과 무관한 선존 깨짐**(SetupScreen 재설계 산물). 셸-dev 이번 작업 범위(기록/게이트) 밖이라 손대지 않음 — 필요 시 별도 정리 권장.

## 자가검증
- `npm run typecheck` → 0 에러.
- 게이트/결과 스크린샷 육안 확인 완료. 임시 spec/스크린샷 정리 완료.

## 다른 에이전트에게
- renderer-dev: 게이트 동안 `renderFrame({...last, frame: last.frame+extra, events:[]})`를 라이브로 반복 호출(기존 settle과 동일 형태). showResult는 게이트 클릭 시 1회.
- qa-verifier: 검증 포인트 — (1) finished 직후 `.result-overlay` 미존재 + `.podium-gate` 노출, (2) 클릭 후 시상대+기록, (3) 컨텍스트 비움 시 `.record-banner`/`.confetti-piece` 노출, (4) `localStorage['woodada:records']`에 `${mode}-${laps}lap` 키.
