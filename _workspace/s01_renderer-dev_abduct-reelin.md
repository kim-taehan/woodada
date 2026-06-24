# s01 renderer-dev — 거미 abduct 리스인(reel-in) 연출

## 문제
- 엔진 `abduct.ts`가 타겟의 `progress`를 한 프레임에 즉시 `self.progress - pullGap`으로 강등 → 렌더러가 다음 프레임에 타겟 몸통을 demoted 화면좌표로 그려서 **텔레포트**처럼 보임. 거미줄 FX는 나가는데 끌려오는 모션이 없었음.

## 접근 (승인된 (a) 이벤트 훅 + reel-in 보간) — `src/renderer/` 만 수정
`RaceRenderer.ts` 한 파일만 변경. 엔진/데이터/셸 무수정.

- `RacerView`에 `reelFrom: {x,y}|null` + `reelStart` 추가. 야크당하기 **직전** 화면좌표에서 demoted 화면좌표로 `REEL_SECS=0.25`s 동안 easeOutCubic으로 lerp.
- 프레임 간 몸통 화면좌표를 1프레임 지연 추적: `prevScreenPos`(직전 프레임) / `curScreenPos`(현재). renderFrame 시작에서 swap.
- **abduct:hit 시드 위치**: renderFrame **메인 드로루프 직전**에 이번 프레임 events를 미리 스캔해 `abduct:hit`이면 타겟 view의 `reelFrom = prevScreenPos[target]`(pre-yank 좌표)로 세팅. → 히트 프레임부터 reel이 적용되어 **demoted 1프레임 깜빡임 없음**.
- 메인 루프: `reelFrom` 활성 시 `bodyX/bodyY`를 `reelFrom → tp(live engine spot)` 로 lerp. 이름표/말풍선/posById도 reel 중에는 몸통(bodyX/bodyY)을 따라감(`followX/followY`). t≥1이면 reelFrom=null로 정상 정렬.
- `playEvent`의 `abduct:hit`: webPull 실(strand)/webTangle 을 `reelFrom`(pre-yank) 원점에서 그려 거미줄이 "원래 위치를 낚아 끌어온다"가 시간적으로 호응.

## 불변 규칙 준수
- 엔진 progress/순위/결정론 무영향(순수 시각 좌표 보간만). 단위테스트 52개 전부 통과(결정론 유지).
- 회전 단위 함정 무관(좌표만 보간, root.rotation 미변경).
- 캡처 훅(`simulate`/`showRaceAt`) 정상 동작.

## 검증
- `npm run typecheck` 통과.
- `npm run test` 52 passed (결정론·공정성 회귀 없음).
- Playwright 시각검증: 격리 로스터 `['eagle','spider']`, seed=52, abduct:hit @ frame 156. 캡처를 Read로 직접 육안 확인.

### 캡처 (tests/e2e/__screens__/)
- `abduct-reel-m2.png` (히트 -2): 독수리(타겟) 아웃코스 앞, 거미 인코스 뒤.
- `abduct-reel-p0.png` (히트 프레임): 독수리가 **demoted가 아니라 원래 앞 위치**에 그려짐 → reel 시작(텔레포트 깜빡임 없음).
- `abduct-reel-p1.png` / `p3` / `p5` / `p7`: 독수리 몸통이 거미줄(✨/🕸️ tangle)과 함께 거미 뒤쪽으로 **부드럽게 슬라이드**. 실황자막 "거미2의 거미줄에 독수리1 낚여서 뒷줄로 슉— ㅋㅋㅋ".
- `abduct-reel-p14.png` (~0.23s, 트윈 종료 직전): 독수리가 거미 바로 뒤에 정착, 엔진 위치와 정렬(스냅 없음).

### 육안 결론
텔레포트 → **거미줄에 낚여 뒤로 끌려오는 reel-in**으로 확실히 읽힘. 거미줄 FX와 몸통 이동이 시간적으로 일치.

## 변경 파일
- `src/renderer/RaceRenderer.ts` (단일)
