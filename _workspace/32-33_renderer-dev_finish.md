# #32 / #33 — 결승부 연출 2건 (renderer-dev)

순수 시각·결정론 보존. 엔진 import 0, progress→화면 매핑만 변경, 시뮬레이션 피드백 0.

## A. 트랙 스타디움 리셰이프 + 결승 직선주로 (#32)

### 무엇을 바꿨나
- `src/renderer/track/OvalTrack.ts`
  - `ovalForCanvas`: 곡선 반경을 줄이고(`radius = min(h*0.22, w*0.135)`) 직선을 늘려(`straightHalf = w*0.27`) **직선 > 곡선**이 되게 비율 조정. 1280×800 기준 직선 ≈ 690px vs 곡선(πr) ≈ 540px. `laneSpan`은 `radius*0.6`으로 살짝 넓혀 타이트해진 곡선을 채움.
  - `pointAt`: **랩 경로 순서를 재배열**. u=0 을 바닥 직선의 **오른쪽 끝(화면 우측 하단)** 에 두고 반시계로 — 우측 곡선↑ → 상단 직선(우→좌) → 좌측 곡선↓ → **바닥 긴 직선(좌→우)** → u→1 에서 우측 하단 결승 복귀. 즉 매 랩의 마지막 구간이 **긴 바닥 직선 → 우측 하단 결승**.
- 결정론·연속성: `place`/`travelDir`/`TrackScene`(폴리곤·결승선 모두 `pointAt` 파생) 그대로라 끊김·꼬임 없음. lap 경계(progress=0)는 그대로이고 화면 매핑만 직선 끝으로 이동. 레인 자동스케일(`bandMul`)도 그대로 동작.

### 시각 결과 (눈으로 확인)
- `_workspace/shots/32-33/race-start.png`: 출발선/결승선이 **바닥 직선의 우측 끝**(우측 하단)에 위치. 전원 거기서 출발해 반시계로 우측 곡선을 오름.
- `_workspace/shots/32-33/race-lastlap.png`: 선두 무리가 **긴 바닥 직선을 따라 우측 하단 결승으로 뻗어 들어감** — "긴 직선 → 결승" 연출 확인.
- `_workspace/shots/32-33/race-curve-top.png`: 짧고 타이트한 좌측 곡선 + 긴 직선의 스타디움 실루엣. 측면 캐릭터(강아지/원숭이) facing 정상, 글리치 없음.

## B. 통과 후 동작 — 코스트 + 자유분방 산개 + 순위별 감정 (#33)

### 무엇을 바꿨나
- `src/renderer/RaceRenderer.ts`
  - `placeFinished()` 신규: `phase==='finished'`(비릴레이) 레이서를 메인 트랙 배치에서 분기. 전부 `(frame - finishedAt)` + **id 해시**로만 구동 → 결정론(Math.random 0).
    - **코스트**: 결승 통과 지점에서 산개 정착점까지 `easeOutCubic`로 0.7s 글라이드(결승선 너머로 더 미끄러져 감속·정착). 엔진 progress 불변, 표시 위치만 보간.
    - **자유분방 산개**: 정착점을 **순위(rank)** 로 바닥 직선 따라 부채꼴 배치(1등 결승쪽, 하위로 갈수록 뒤로) + id 해시 지터(±46/±64px)로 흩뿌림. **일렬(레인 정렬) 아님**, 서로 겹침 최소.
    - **순위별 감정**: 정착(k>0.85) 후 — 상위 1~3등 `celebrate`(방방뛰기 + ✨/💗), 꼴찌 `dejected`(신규), 중위 무난(`finished` win 포즈 유지).
  - 헬퍼 `hash01`(id→안정값), 상수 `COAST_SECS/SCATTER_RX/SCATTER_RY`, `easeOutCubic` 추가.
- `src/renderer/character/PartsCharacter.ts`
  - `dejected` 페이즈 신규: `idle` 포즈 기반 + 고개 숙임/어깨 처짐/팔(또는 날개) 축 늘어뜨림 + 느린 좌절 sway. 토끼 air, 독수리 fly hover, 귀/꼬리 흔들림을 모두 억제해 **확실히 처짐**. (회전 단위 준수: 파트 rot=도, root.rotation=라디안.)
- `src/renderer/fx/FxLayer.ts`: `heart`(💗 상승), `sweat`(💧 흘러내림) 신규 — 통과 후 감정용. reducedMotion 시 미생성.
- 캡처 훅(결정적 정지 캡처용, 전부 display-only):
  - `src/shell/RaceController.ts` `settle(extraFrames)` 신규 — 경기 종료 후 최종 프레임의 frame index만 올려 재렌더 → 코스트/산개/감정이 정착 상태로 발전. 엔진 step 안 함.
  - `src/main.ts` `showRaceAt`에 `settleFrames` opt 연결.

### ⚠️ 캡처 함정 (QA 참고)
- `showRaceAt(N)`은 frame index **N-1** 을 렌더(seek가 `frameIndex>=N`에서 멈춤). 전원 통과를 잡으려면 `totalFrames+α` 로 seek해야 마지막 완주자까지 finished가 됨. 그 뒤 `settleFrames`로 정착시켜 캡처.

### 시각 결과 (눈으로 확인)
- `_workspace/shots/32-33/race-finish-scatter.png` (= `tests/e2e/__screens__/race-finish-scatter.png`):
  - 전원이 **결승선 너머로 코스트해 통과**(결승선이 무리 오른쪽에 보임), **일렬 아닌 자유 산개**.
  - 곰6(1등)·원숭이4(2등)·강아지2(3등): ✨ 반짝 + 💗 하트 + 방방 점프(celebrate).
  - 펭귄1(4등)·고양이3(5등): 무난(idle).
  - 독수리5(꼴찌): 날개 축 처지고 고개 숙인 **좌절** 포즈.

## 검증
- `npm run typecheck` 통과.
- `npm run test` 42/42 통과(엔진 순수성 영향 0 재확인).
- `npx playwright test race-visual.spec.ts relay-visual.spec.ts --project=desktop` 전부 통과. e2e엔 골든 픽셀 비교(toHaveScreenshot) 없음 → 스크린샷은 산출물 저장. 릴레이 finish 경로(`!config.relay` 가드)도 회귀 없음 확인.
- 공식 캡처 추가: `tests/e2e/race-visual.spec.ts`에 `post-finish coast → free scatter → emote by rank (#33)` 테스트 → `tests/e2e/__screens__/race-finish-scatter.png`.
- 임시 dev/디버그 spec·스크린샷 정리 완료. main.ts 디버그 dump 제거.

## 변경 파일
- `src/renderer/track/OvalTrack.ts` (A)
- `src/renderer/RaceRenderer.ts` (B: placeFinished + 헬퍼)
- `src/renderer/character/PartsCharacter.ts` (B: dejected 페이즈)
- `src/renderer/fx/FxLayer.ts` (B: heart/sweat)
- `src/shell/RaceController.ts` (캡처용 settle)
- `src/main.ts` (settleFrames opt)
- `tests/e2e/race-visual.spec.ts` (공식 캡처 1건)

## 비대상 회귀 없음
조끼·릴레이·자동스케일·TOP3 HUD·기존 스킬/아이템 연출(zoomies/banana/divebomb/roar/icefield/item) 모두 e2e 통과로 확인.
```
