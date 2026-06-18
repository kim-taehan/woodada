# Phase 2 렌더러 — 릴레이 연출 (대기열 · 바통 · 레그 카운터)

상태: 완료. typecheck 통과 + Playwright 시각검증(육안) 완료.

## 변경 파일
- `src/renderer/RaceRenderer.ts` — 릴레이 분기 3종(대기열, 바통 이벤트, 레그 카운터).
- `src/renderer/fx/FxLayer.ts` — `baton()` FX 추가(바통 그래픽 아크 + 반짝 + 도착 링).
- `src/renderer/fx/commentaryLines.ts` — `relay:handoff` 라인 풀 추가.
- `src/main.ts` — 캡처 훅 `relay` 옵션(+ teamMode/scoringId 분기). 디폴트(non-relay) 동작 불변.
- `tests/e2e/relay-visual.spec.ts` — 영구 골든 캡처 스펙(신규).

## 구현 방식
1. **대기열**: `renderFrame`에서 `config.relay && phase==='waiting'`인 레이서는 본선
   `track.place()`를 호출하지 않고 `waiting[]`에 모아, 메인 루프 후 인필드
   (start/finish 안쪽, `cy + radius*0.42`)에 팀별 컬럼으로 줄세움. leg 순 정렬로
   다음 주자가 앞. 스케일 0.62배·zIndex 50대(본선 뒤). 조끼 그대로 보임.
   → 본선엔 `phase==='running'`인 팀 수만큼만 달림.
2. **바통**: `playEvent`의 `${type}:${variant}` 디스패치에 `relay:handoff` 케이스.
   finisher(racerId)→target(targetId) 사이 바통 아크 + 도착 지점 dust + 들어오는
   주자(targetId view) 글로우 1.1s. 자막은 기존 commentary 루프가 `relay:handoff`
   라인 풀에서 자동 출력.
3. **레그 카운터**: `buildScene`에서 `relay`면 최대 팀원 수 = `relayLegTotal` 계산,
   상단 텍스트를 "🏃 1/N 주자"로. `renderFrame`에서 running 주자들의 max(leg)+1로
   갱신. 마지막 레그 도달 시 기존 배너/종소리 재사용(텍스트만 "마지막 주자!"로).
   non-relay는 기존 랩 카운터 분기 그대로(회귀 없음).

## 시각 검증 (3팀 × 2명, seed 7, teamIds=[red,blue,white,red,blue,white])
- `tests/e2e/__screens__/relay-start.png` — 초기. 레그 "1/2 주자". 인필드 대기열에
  원숭이4(red)·코끼리5(blue)·곰6(white) 3명(각 팀 anchor)이 본선과 분리되어 줄섬.
  본선엔 곰1·강아지2·토끼3(leg0)만. 대기 주자가 본선에 안 섞임. ✅
- `tests/e2e/__screens__/relay-handoff.png` — 핸드오프 직후. 원숭이4가 결승선에서
  노란 바통 글로우 ✨로 빛남(바통 받은 incoming runner 표시). 대기열은 코끼리5·곰6
  2명으로 줄어듦(red anchor 출발). 레그 "2/2 주자" + "🔔 마지막 주자!" 배너. ✅
- `tests/e2e/__screens__/relay-leg.png` — 최종 레그(60%). 대기열 0, anchor 3명이
  본선 주행: 코끼리5 파란 조끼·원숭이4 빨강·곰6 화이트로 팀 식별 명확. 본선엔
  팀 수(3)만 달림. 레그 "2/2 주자". leg0 3명은 결승선 옆 파킹. ✅

## 육안 코멘트
- 대기열: 본선(빨간 트랙)과 확실히 분리된 인필드 잔디에 위치, 본선 주자와 안 섞임.
- 바통: 글로우+✨가 들어오는 주자를 강하게 지목. 바통 그래픽 아크는 0.45s로 짧아
  핸드오프 정확 프레임에 가장 잘 보임(seek 캡처로 확인). 자막은 다른 이벤트와
  겹치면 밀릴 수 있으나 글로우가 1차 큐로 충분.
- 레그 카운터: "n/N 주자"가 핸드오프마다 정확히 증가. 마지막 레그 배너 텍스트 분기.
- 조끼: blue/red 대비 강함. white는 트림 외곽으로 식별 가능(Phase1 조끼 특성, 약함).

## 비고
- non-relay 경로 회귀 없음 확인: `race-visual.spec.ts` 3 테스트 전부 통과,
  race-start.png 육안 동일(레그 카운터·대기열·조끼 없음).
- 결정론 보존: 무작위 시각요소 없음(대기열 위치·바통 모두 결정적).
- `relay-visual.spec.ts`는 `relay:handoff` 발생을 assert하는 영구 골든으로 유지.
