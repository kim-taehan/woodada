# 28 · renderer-dev · 펭귄 슬라이딩 + 독수리 급강하 + divebomb 피격 아파하기

## 결론
세 연출 모두 `src/renderer/` 순수 시각으로 구현(시뮬 피드백 0, 결정론 보존). typecheck 통과, unit 42/42, e2e 4/4(회귀 없음). 모든 변경을 스크린샷 Read로 육안 검증.

---

## 1. 🐧 펭귄 — 빙판 배슬라이딩 + 미끄러지는 걸음
- **배선**: `PartsCharacter.UpdateOpts`에 `onIce?: boolean` 추가. `RaceRenderer.renderFrame`이 펭귄(`charIdById==='penguin'`)에 한해 `lapPosInZones(progress, trackLength, frame.iceZones)`(엔진 `inZone`의 wrap-aware 미러)로 판정해 넘김. **엔진은 이미 boost를 적용했고, 이건 포즈 선택만** 한다(시뮬 불변).
- **배슬라이딩(onIce && moving)**: `model.id==='penguin'` 전용 분기. 발 뒤로 swept+tuck(`legL/R rot ±30, dy-6`), 플리퍼 뒤로 raked(`armL/R rot ±70`), 몸통 가로로 납작(`body scaleX*1.18, scaleY*0.9, dy+8`), 머리 숙임. root를 진행방향으로 **0.42rad 피치**(엎드림). → 빨강 트랙·시안 빙판 위에서 "엎드려 슝~" 읽힘.
- **평소 걸음(off-ice)**: biped 그대로 두되 펭귄만 **글라이딩 와들** — 다리 스텝 진폭 36°→18°, 플리퍼 패들(±8+sin·14°), 몸 bob 11→5(미끄덩), root에 좌우 와들 sway(`sin(t)*0.16rad`). 마칭이 아니라 부드러운 셔플로.
- 회전 단위 함정 준수: 파트 `rot`은 도(degree), root 피치/sway는 라디안.

## 2. 🦅 독수리 — 급강하 (스크린 공간: 솟음→정점→하강)
2D 탑다운에서 "상승"이 안 읽히는 문제를 **스크린 Y 오프셋**으로 해결. 트랙 위치/progress는 엔진대로, 화면상으로만 솟았다 꽂힘.
- `RacerView.diveAt`(시작 clock) 추가. `divebomb:activate` 시 `v.diveAt = clock`. `renderFrame`에서 `diveOffset(clock - diveAt)`로 root에 **screen-Y lift + scale pop** 적용:
  - rise(0.34s, ease-out): lift 0→150px, scale +0~+0.42 ("높이 떴다").
  - hang(0.12s): 정점 멈칫.
  - plunge(0.26s, ease-in): 빠르게 0으로 내리꽂기.
  - 솟은 동안 zIndex를 90000+로 올려 필드 위로.
- 'fly' 호버(기존 bob/flap) 위에 이 오프셋이 얹혀 자연스럽게 솟구침.
- **임팩트 타이밍 연결**: 이벤트는 같은 프레임에 도착하므로 임팩트 FX(swoop+feathers+stars+dizzy / 자폭은 dust+pop+dizzy)를 **하강 바닥(`IMPACT_DELAY≈0.67s`)에 deferred 스케줄**(`pendingFx` 큐, `renderFrame`+`pumpFx`에서 drain). seek 리플레이가 프레임마다 drain하므로 결정적 캡처에서도 바닥에 터짐. reducedMotion이면 `playEvent` 조기 return으로 dive·deferred 둘 다 미발동.

## 3. 💥 divebomb 피격 아파하기 (곰 포효 통일)
- `divebomb:hit` && `targetId !== racerId`(피격자): 기존 feathers+stars에 **`fx.dizzy(at)` 추가** → roar:hit과 동일한 머리 위 ⭐💫 소용돌이+임팩트 링. "스턴 당함" 통일 읽힘.
- `targetId === racerId`(자폭): 본인에 dust+pop+**dizzy**(기존) 유지 + swoop로 처박힘 강조. 둘 다 deferred로 하강 바닥에 정렬.

---

## 변경 파일 (절대경로)
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/character/PartsCharacter.ts — `onIce` 옵트, 펭귄 슬라이딩/글라이딩 와들 분기 + root 피치/sway.
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/RaceRenderer.ts — `lapPosInZones`, dive screen-offset(`diveOffset`/`DIVE_*`), `RacerView.diveAt`, `pendingFx`/`scheduleFx`/`drainPendingFx`, divebomb 케이스 deferred+dizzy.
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/main.ts — simulate 출력에 `penguinIceFrame`(펭귄이 빙판 안에 있는 첫 프레임) 추가(캡처용).
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/race-visual.spec.ts — penguin-slide / divebomb rise·apex·impact 프루프샷, self-botch 캡처를 dive 바닥(+30)으로.

## 스크린샷 (골든, 절대경로) + 육안 코멘트
- .../tests/e2e/__screens__/race-penguin-slide.png — 펭귄1이 시안 빙판 안에서 **앞으로 엎드린 프론 자세**(직립 군집과 명확히 다름), 플리퍼 옆으로, 슝 미끄러지는 톤.
- .../tests/e2e/__screens__/race-divebomb-rise.png — 독수리5가 트랙선보다 **위로 솟고 커짐**("급강하!!"+스피드라인).
- .../tests/e2e/__screens__/race-divebomb-apex.png — 독수리5가 **화면 우상단 코너까지 솟구침**(정점), 아래 트랙 위치에 버블·반짝이 잔류 → "높이 떴다" 확실.
- .../tests/e2e/__screens__/race-divebomb-impact.png — 독수리5가 **트랙선으로 다시 내리꽂힘 + 바닥에 dust 임팩트**.
- .../tests/e2e/__screens__/race-divebomb-self.png — 자폭: 독수리5 솟구쳐 처박힘, "어이쿠! 독수리5 자기가 처박혔다 ㅋㅋ".
- .../tests/e2e/__screens__/race-divebomb-hit.png — activate age0(독수리 트랙선, 임팩트는 deferred라 아직 없음 = 의도대로). 펭귄 슬라이딩도 동시 확인.
- .../tests/e2e/__screens__/race-reduced-motion.png — 회귀 확인: reducedMotion이면 펭귄 **직립**(슬라이딩 X), 독수리 **솟지 않음**(dive·파티클 모두 억제).

## 검증
- `npm run typecheck`: 통과(에러 0).
- `npm run test`(vitest): **42/42 통과** — determinism/relay/skills/bias/icefield/divebomb 회귀 없음(렌더러는 시뮬 미접촉).
- `npx playwright test race-visual.spec.ts --project=desktop`: **4/4 통과** — 트랙·조끼·릴레이·autoscale·TOP3 HUD·곰 포효·곡선 facing·랩카운터 회귀 없음.

## 비고 / qa-verifier 인계
- **시뮬 불변**: `lapPosInZones`/dive 오프셋/`pendingFx`/`onIce`는 전부 렌더 전용. `pumpFx`도 deferred FX만 drain(엔진 step 없음).
- 결정론: seek 리플레이가 dive 아크·deferred 임팩트를 프레임 단위로 동일 재생 → 골든 안정.
- 임시 파일/스펙 없음(diag/tmp 0). 펭귄 빙판 띠 렌더(26번)·곰 포효 dizzy(26번)는 그대로 재활용, divebomb 피격에 dizzy 통일만 추가.
