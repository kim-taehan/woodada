# 23 · renderer-dev · 경기 중 좌측 하단 라이브 TOP 1~3 HUD

## 요약
경기 화면 **좌측 하단**에 현재 진행 순위 상위 3명을 라이브로 표시하는 컴팩트 HUD 추가.
각 행 = 순위(1·2·3) + 팀 색 스와치(점) + 이름. 팀전이면 팀 색, 개인전이면 중립 회색.
`src/renderer/`만 수정 — 엔진/데이터 파일은 미수정.

## 변경 파일
- **신규** `src/renderer/TopRankHud.ts` — 컴팩트 TOP3 위젯 (기존 `Scoreboard.ts` 패턴 차용).
  - `update(top: TopRow[])`: 최대 3행, 매 프레임 교체. `TopRow = { name, teamFill, teamTrim }`.
  - 둥근 반투명 카드(`0x1f2a1c, alpha 0.8`) + 얇은 흰 외곽선. "LIVE TOP 3" 타이틀.
  - 순위 숫자색 = 금/은/동(`0xffd23f / 0xd6dae0 / 0xe2a06a`).
  - 팀 스와치 = `teamPalette[teamId].fill` 채움 + `.trim` 외곽(흰/검 팀도 카드 위에서 구분됨).
  - 개인전(teamFill=null) → 중립 회색 점(`0x8a948a`)으로 레이아웃 유지.
- **수정** `src/renderer/RaceRenderer.ts` — HUD 주입/배치만 추가 (기존 렌더 경로 무변경).
  - import: `TopRankHud`, `teamPalette`/`TeamId`.
  - `buildScene`: HUD 생성, 좌하단 배치 `(16, height - 120 - 16)`, 스테이지에 add.
  - `renderFrame`: 이미 계산되던 `order`(라이브 순위, 랩 포함 progress 기준)의 상위 3명을
    `frame.racers`의 `teamId`로 매핑해 `topHud.update(rows)`. **순위 산출 로직 재사용 — 신규 계산 없음.**
  - `showResult`: HUD 숨김. `resize`: HUD 재배치.

## HUD 구현 방식
- 시뮬레이션 피드백 0: 렌더러가 이미 만들던 `order` 배열(스코어보드용)을 그대로 읽어 상위 3개만 슬라이스.
  팀색/이름은 `frame.racers[].teamId` + `namesById`로 조회. 엔진/데이터 미접근, 결정론 보존.
- 위치: 좌하단 코너. 중앙 실황 자막(`height-40`)·우측 스코어보드(`width-144,12`)와 비겹침.
- 릴레이: 별도 분기 없음 — `order`는 활성 주자들의 라이브 progress 순서라 자연스럽게 본선 순위로 표시됨.

## 시각 검증
**주의**: 동시 진행 중인 engine 작업으로 `src/engine/`가 미완성 상태(`snatch.ts`/`immunity.ts`/`iceZones`
미존재)라 앱 전체 build/dev 부팅이 불가 → 표준 `race-visual.spec.ts`(엔진 의존) 실행 불가.
대신 **엔진 비의존 격리 하네스**로 `TopRankHud`만 실제 필드색(0x88c98a) 위에 마운트하고,
가짜 중앙 자막+우측 스코어보드를 함께 그려 겹침까지 Playwright로 캡처 후 Read 육안 확인. (임시 파일 전부 삭제 완료)

골든 스크린샷:
- `tests/e2e/__screens__/top3-hud-team.png` — 팀전. 1=레드·2=블루·3=화이트 점, 흰 점도 외곽선으로 또렷.
- `tests/e2e/__screens__/top3-hud-solo.png` — 개인전. 중립 회색 점 + 이름.

**육안 코멘트**: 좌하단에 둥근 반투명 카드로 "LIVE TOP 3" + 1·2·3등이 팀색+이름으로 또렷하게 보임.
금/은/동 순위색이 한눈에 구분되고, 중앙 자막바·우측 스코어보드와 전혀 겹치지 않음. 카드가 작아 트랙 가림 최소.

## 타입체크
`npm run typecheck` — `src/renderer/`에 에러 0. (남은 에러는 전부 동시 작업 중인 engine/test 파일이며 본 작업과 무관.)

## 회귀
HUD 추가만. 주행·트랙·조끼·릴레이 큐·자동스케일·기존 스코어보드·실황자막 렌더 경로는 무변경.
`showResult`에서 HUD 숨김 처리하여 시상대 화면에는 노출 안 됨.

## QA 인계
- engine 작업이 머지되어 앱이 부팅 가능해지면, qa-verifier가 실제 팀전/개인전 경주를
  `window.__woodada.showRaceAt`로 캡처해 라이브 갱신(순위 변동 즉시 반영)을 최종 확인 권장.
