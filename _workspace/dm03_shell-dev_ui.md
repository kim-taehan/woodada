# dm03 shell-dev — 데스매치(개인전 탈락전) 셸/UI·config 배선

## 동결 계약 소비 (변경 없음)
- 데이터: `eliminationOptions` (modes.ts), `EliminationId='none'|'first'|'last'` (schema.ts)
- 엔진: `RaceConfig.elimination?: 'first'|'last'` (engine/types.ts)
- 엔진 이벤트: `{ type:'eliminate', variant:'out' }`

## 1. RoomStore 상태 (src/shell/store.ts)
- 신규 필드: `eliminationKind: EliminationId = 'none'` (단일 출처)
- `import` 에 `type EliminationId` 추가 (schema.ts)
- 헬퍼 `resolvedElimination(): 'first'|'last'|undefined` — 개인전이고 'none'이 아닐 때만 값, 아니면 undefined (팀모드면 데스매치 무시)
- `buildRoomState()` 에 `elimination: this.resolvedElimination()` 포함
- `buildRaceConfig()` 에 `elimination: room.elimination` 전달

## 직렬화 상태 (src/transport/types.ts)
- `RoomState.elimination?: 'first'|'last'` 추가 (리플레이 재현 보장). 'none'은 셸 전용 슈가 → 상태엔 undefined.

## 2. 셋업 UI (src/shell/screens/SetupScreen.ts)
- `eliminationOptions` import 추가
- `elimSelect` `<select>` (teamScoringOptions 셀렉트 패턴 복제) → 일반전/선두탈락/꼴찌탈락. change 시 `store.eliminationKind` 갱신
- `elimGroup` (`.opt-group .elim-group`, 라벨 '탈락') → `opts-row` 에 추가 (기존 CSS `.opt-group` 재사용, 새 CSS 불필요)
- `syncModeUI()`: 개인전일 때만 표시, 팀전이면 숨김 (`elimGroup.style.display = team ? 'none' : ''`). modeId는 'individual' 유지.

## 3. config 배선
- 위 store 1번 항목 참조. relay 파생 패턴과 동일하게 'none'→undefined.

## 4. 캡처 훅 (src/main.ts) — 우선 처리 완료, rendererdev 통지함
- `configFor(..., relay = false, elimination?: 'first'|'last')` 인자 추가 → `RaceConfig.elimination` 전달
- `CaptureOpts.elimination?: 'first'|'last'` 추가
- `simulate(opts)` / `showRaceAt(frame, opts)` 둘 다 `opts.elimination` 패스스루
- simulate 반환의 `eventFrames['eliminate:out']` 로 탈락 프레임 인덱스 획득 가능
- 시그니처: `window.__woodada.simulate({ elimination:'first'|'last', ... })`, `showRaceAt(frame, { elimination, ... })`

## 5. 결과 화면 (src/shell/screens/ResultScreen.ts) — 최소 변경
- 데스매치 순위는 `result.order`(rank)로 이미 표현 → 표 변경 없음
- 개인전 승자 라벨만: `config.elimination` 있으면 "최후의 생존자 🏆 {이름}", 없으면 기존 "1등 🏆 {이름}"

## 6. 슬로우모션 (src/shell/RaceController.ts) — 적용함
- `run()` 루프에 데스매치 탈락 강조용 일시 슬로우모션 추가 (디스플레이 전용, 엔진 fixed-step 불변)
- 상수: `SLOWMO_FACTOR=0.35`, `SLOWMO_MS=700`
- `frame.events` 에 `eliminate:out` 있으면 700ms 동안 페이싱 35%로 감속 → 이후 정상 복귀
- 결정론 영향 없음 (`acc` 누적 스케일만 조정)

## 검증
- `npm run typecheck`: 내 변경분(shell/main.ts/transport) **클린**. 단, 전체 tsc 는 `src/renderer/RaceRenderer.ts(21)` TS6133 unused-local 2건(eliminationLine, eliminationBubble)으로 실패 — rendererdev 작업 중 파일, 통지함.
- `npm run test`: 62 passed (engine-deathmatch 포함). 셸 변경 회귀 없음.

## 협업
- rendererdev 에 캡처훅 준비 완료 + RaceRenderer.ts typecheck 블로커 통지함. 파일 겹침 없음.
