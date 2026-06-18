# 26 · renderer-dev · divebomb 연출 + 곡선 방향 + 빙판 가시화 + 포효 피격

## 결론
divebomb 연출(발동/명중/자폭) 교체 완료, 측면 캐릭터 곡선 방향 버그 수정, 펭귄 빙판 렌더 신규 구현(또렷한 가시화), 곰 포효 `roar:hit` 피격자별 어질어질 연출 추가. typecheck 통과, unit 42 passed, e2e 10 passed(회귀 없음). 모든 변경을 스크린샷으로 육안 검증.

---

## A. divebomb 연출 (snatch 잔재 → divebomb)
`RaceRenderer.playEvent` 스위치를 `snatch:*` → `divebomb:*`로 교체:
- `divebomb:activate` — 위에서 표적(없으면 진행방향 전방)으로 swoop 다이브 + speedLines.
- `divebomb:hit` — `e.targetId === e.racerId`(자폭)이면 **본인에 dust + pop + dizzy**(처박힘), 아니면 **표적에 feathers + stars**(명중). 한 case에서 분기.
- `divebomb:dodge` — 고양이 회피 시 표적 위 whiff(헛챔). 고양이 냐옹 shimmer는 기존 cat-dodge 블록이 그대로 처리.
- 자폭 실황자막: 커멘터리 루프에서 `divebomb:hit && targetId===racerId`를 `divebomb:self` 합성 variant로 라우팅 → 전용 라인 풀.

`commentaryLines.ts`: `snatch:*` 3줄 → `divebomb:activate/hit/self/dodge`. 자폭 라인 추가("어이쿠! {n} 자기가 처박혔다 ㅋㅋ" 등).
`FxLayer.ts`: snatch 주석/명칭 → divebomb(swoop/feathers 기능 재활용).

## B. 곡선 방향 수정 (핵심 버그)
원인: `PartsCharacter`가 `inner.scale.x = dir`를 **모든 runStyle에 적용** + heading을 `Math.cos(tp.angle)`로 받았는데 `OvalTrack`의 piecewise tangent 공식이 곡선/직선에서 부호가 어긋남(우커브 상단 cos +0.85 등 진행과 반대).
수정 2곳:
1. `OvalTrack.travelDir(progress, trackLength, lane)` 신규 — u와 u+ε의 위치 **유한차분**으로 화면상 진행 방향 단위벡터 산출(piecewise 공식 무관, 곡선에서 부드러움). `RaceRenderer`가 `heading = travelDir(...).x`를 넘김(2개 호출처 + posById).
2. `PartsCharacter`: `inner.scale.x = runStyle === 'gallop' ? dir : 1` — **측면(gallop=강아지·고양이)만 미러**. 정면(biped/scamper)·비행(fly)은 미러 안 함(반대편에서 얼굴 뒤집힘 방지).

## C. 펭귄 빙판 (icefield) 렌더 — 신규 구현
기존 렌더러는 `frame.iceZones`를 **전혀 그리지 않았음**(미구현). 신규 추가:
- `iceLayer` 컨테이너를 stage에 `iceLayer, boxLayer, charLayer, …` 순(트랙 위·캐릭터 아래)으로 삽입. buildScene에서 clear, showResult에서 hide.
- `drawIce(zones, trackLength, frameIdx)`: zone progress 범위를 레인폭 전체 띠로 매핑(steps 샘플 closed strip). **펭귄 팔레트 water `#5BC8E8`** 반투명 필(α0.72) + 흰 테두리(width4) + 글로시 shine 리본 + ❄️ glints → 빨강 트랙에서 또렷. `startProgress+length`가 trackLength 넘으면 **wrap 2조각** 분할. `activeUntil - frameIdx`로 마지막 ~18프레임 부드럽게 페이드.

## D. 곰 포효 `roar:hit` 피격 연출
엔진이 피격자별 `{type:'roar', variant:'hit', targetId}`를 냄. 추가:
- `FxLayer.dizzy(x,y)` 신규 — 머리 위 💫⭐ 6개 소용돌이(spin in place, 위로 드리프트) + 피격자에 꽂히는 작은 임팩트 링. 바나나(미끄덩 스핀)와 한눈에 구분.
- `roar:hit` case → 피격자(`at`) 위치에 dizzy. 여러 피격자에 동시 발동.
- 바나나 `banana:hit`(stars/spin)은 그대로 유지.

## E. 캡처 가시성 보강 (capture 한정)
seek는 이벤트 프레임에서 FX를 age≈0로 멈춰 grow/모션 FX(shockwave·dizzy 링)가 안 자람.
- `RaceRenderer.pumpFx(seconds)` 신규: 엔진 step 없이 FX 파티클만 소구간 진행. `main.ts showRaceAt`가 seek 후 `pumpFx(0.18)` 호출 → 결정적 스틸에서 연출이 실제로 보임. **시뮬레이션 불변**(렌더 전용).
- `main.ts simulate` 출력에 `divebombSelfFrame`(자폭 첫 프레임) 추가 — 자폭 전용 캡처용.

---

## 변경 파일 (절대경로)
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/RaceRenderer.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/character/PartsCharacter.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/track/OvalTrack.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/fx/FxLayer.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/fx/commentaryLines.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/main.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/race-visual.spec.ts  (snatch→divebomb 키, 신규 proof-shots 테스트)

## 스크린샷 (골든, 절대경로) + 육안 코멘트
- .../tests/e2e/__screens__/race-curve-top.png — 상단 직선: 강아지2·고양이3 **왼쪽(진행방향) 응시**. 정면(펭귄·곰·원숭이)·비행(독수리) 미러 없음. (수정 전 뒤로 달림 → 해결)
- .../tests/e2e/__screens__/race-curve-left.png — 좌측 곡선: 측면 캐릭 진행방향 응시 정상.
- .../tests/e2e/__screens__/race-icefield-laid.png — 우상단 곡선에 **선명한 시안 빙판 + 흰테두리 + ❄️**, 펭귄 "빙판 깔기!" 말풍선. 빨강 트랙 대비 또렷.
- .../tests/e2e/__screens__/race-roar-hit.png — 곰1 포효: **광역 shockwave 링 + 다수 피격자 머리 위 어질어질(⭐💫)** 동시. "곰1 크아앙! 다 같이 움찔!". 바나나와 구분됨.
- .../tests/e2e/__screens__/race-divebomb-self.png — 독수리5 자폭: 본인에 dust+dizzy+글로우, swoop 라인, "어이쿠! 독수리5 자기가 처박혔다 ㅋㅋ".
- .../tests/e2e/__screens__/race-divebomb-activate.png, race-divebomb-hit.png — 발동/표적명중(깃털·별).

## 검증
- typecheck: 통과
- unit(vitest): 42 passed (결정론·bias·skills 등 회귀 없음)
- e2e(playwright desktop): 10 passed — 트랙·조끼·릴레이·autoscale·TOP3 HUD·play 풀런 회귀 없음.

## 비고 / 후속
- 임시 `_diag-*` 진단 스펙·`diag-*`/`curve2-*` 스크린샷 정리 완료. 검증 캡처는 `race-visual.spec.ts`의 proof-shots 테스트로 흡수(재생성 가능).
- `divebombSelfFrame`·`pumpFx`는 캡처 인프라(렌더 전용). 엔진/시뮬 불변.
