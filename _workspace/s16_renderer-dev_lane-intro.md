# s16 renderer-dev — 레인별 참가자 소개 스포트라이트 연출 (렌더러 파트)

## seam (계약 — shell-dev introflow와 동일)
`RaceRenderer`에 public 메서드 2개 추가:
- `playLaneIntro(onDone: () => void): void`
- `skipLaneIntro(): void` (idempotent)

전제: 셸이 `buildScene` + `renderFrame(frame0)`로 출발선 장면을 깐 상태에서 `playLaneIntro` 호출.
렌더러는 씬을 새로 만들지 않고 그 위에 디밍/스포트라이트만 얹음. 엔진 프레임 무수정(순수 시각).

레인 순서: `config.participants` 등록 순서(=시작 슬롯 순서) 1번부터. 셸 표시 인덱스와 일치 전제.

## 구현 (src/renderer/ 만)
### RaceRenderer.ts
- 인트로 전용 `introLayer`(Container, sortableChildren) — charLayer 위에 stage에 add.
- `introDim`: 풀스크린 어두운 사각(0x0a0e16). 첫 레이서에서 alpha 0→0.62 ease-in, 이후 유지.
- `introSpot`: 현재 레이서 발밑에 add-blend 밝은 원형 스포트라이트(따뜻한 톤, 호흡 펄스).
- 비트당 ~0.8s(INTRO_IN 0.18 슬라이드인 + INTRO_HOLD 0.62). app.ticker로 실시간 구동.
- 비트마다 해당 레이서의 `character.root` + `tag.root`를 introLayer로 들어올려(reparent) 디밍 위에 표시, 다음 비트에 charLayer로 복귀.
- `introBanner`: 머리 위가 아니라 상단 중앙(height*0.16)에 큰 이름 배너 팝(스케일 오버슈트).
- 인트로 동안 전 레이서 small 이름태그 숨김(출발선에 다 겹쳐 있어 스포트라이트로 새는 것 방지), 스포트라이트 받는 레이서만 노출. 종료 시 전체 복원.
- onDone: 마지막 레이서 끝나고 정리 후 1회. skipLaneIntro: 즉시 정리 + 미호출 시 1회. idempotent.
- reducedMotion이면 스포트라이트 생략하고 onDone만 microtask로 호출.
- buildScene/destroy 시작 시 `clearIntroVisuals()`로 잔여 인트로 정리.

### PartsCharacter.ts
- public `greet(t, intensity)` 추가: 손 흔들기 포즈.
  - arm 파트(armL/armR) 있으면(외계인/원숭이/펭귄) 먼 팔(armR)을 위로 들고 손 흔들기(도 단위, -118±22°).
  - arm 없는 정면 치비(곰/고양이/강아지/고슴도치/거미)는 머리 살짝 들고 앞다리(legR/frontLegR) 흔들기 + 공통으로 명랑한 바디 바운스 + 살짝 sway.
  - **회전 단위 주의 준수**: 파트 rot은 도(*DEG), root.rotation은 라디안(±0.06).

## 검증
- `npm run typecheck` 통과.
- 임시 캡처 훅(main.ts showLaneIntro) + 임시 스펙으로 실시간 인트로 중간 프레임 캡처 후 **작업 후 둘 다 삭제**.
- 캡처 경로(Read로 육안 확인):
  - `tests/e2e/__screens__/lane-intro-1.png` — 1번 펭귄1: 필드 전체 어둡게 디밍, 펭귄이 따뜻한 스포트라이트 안에서 밝게, 플리퍼 들어 인사, 상단 "펭귄1" 배너 팝.
  - `tests/e2e/__screens__/lane-intro-2.png` — 4번 원숭이4: 디밍 위 스포트라이트, 팔 들어 흔들기 명확, "원숭이4" 배너 팝. 슬롯 순서대로 진행(펭귄→원숭이) 확인.
- 회귀: `race-visual.spec.ts` 5개 전부 통과(공유 렌더러 무손상).

## 셸 연결
introflow가 buildScene+frame0 후 `playLaneIntro(onDone)` 호출, 스킵 버튼은 `skipLaneIntro()`.
실제 셸 흐름 e2e는 introflow(shell-dev) 쪽에서 검증.

---

## 후속(Task #19): 팀전 레인 소개 팀 표시

### 변경 (src/renderer/RaceRenderer.ts 만, playLaneIntro 내부)
- `makeIntroBanner(name, tint, team)`에 optional `team` 인자 추가(기존 팀 스킴 `teamPalette` 재사용 — 라이브 리더보드 닷·릴레이·베스트와 동일 색).
  - **팀전**(참가자 teamId 유효): 배너 테두리를 팀 `fill` 색 굵게(5px) + 이름 아래 "● {팀}팀" 칩(팀색 닷 + `trim` 링 + 라벨). 칩 들어갈 자리만큼 배너 높이 52→70.
  - **개인전**(team null): 기존 그대로(흰 테두리 3px, 칩 없음) — 회귀 안전.
- `startBeat`에서 `config.participants.find(id).teamId` → `isTeamId` 가드 → `teamPalette[teamId]`로 team 결정 후 배너 생성. 새 팀 색 체계 없음.
- 회전 단위·결정론·캡처 훅·seam 불변. 셸 변경 불필요.

### 검증
- `npm run typecheck` 통과.
- 2팀 로스터(펭귄/강아지/고양이/원숭이 × red/blue/red/blue) 임시 캡처 후 육안 확인, 임시 훅/스펙 삭제.
- 캡처 경로:
  - `tests/e2e/__screens__/lane-intro-team-red.png` — 1번 펭귄1: 빨강 테두리 + "● 레드팀" 칩, 빨강 베스트.
  - `tests/e2e/__screens__/lane-intro-team-blue.png` — 2번 강아지2: 파랑 테두리 + "● 블루팀" 칩, 파랑 베스트. 슬롯 순서 red→blue 확인.
  - `tests/e2e/__screens__/lane-intro-individual.png` — 개인전: 흰 테두리·칩 없음(회귀 확인).
- 회귀: `race-visual.spec.ts` 5개 전부 통과.

---

## 후속(Task #20): 정보를 동물 근처 카드로 (이름+종류+팀)

문제: 상단 큰 이름 배너가 화면 위, 스포트라이트 동물은 하단 → 시선이 위↔아래 왕복.

### 변경 (src/renderer/RaceRenderer.ts 만, playLaneIntro 내부)
- `makeIntroBanner` → `makeIntroCard(name, species, tint, team)`로 교체: **하단 앵커 카드**(y=0=카드 바닥)에 3행을
  - 이름(큰 글씨)
  - "🐧 펭귄" 동물종류 행(이모지 + characterCatalog.name) — 커스텀 이름이어도 동물 식별
  - "● {팀}팀" 팀칩(팀전만, teamPalette 재사용)
- 카드를 **상단 중앙이 아니라 스포트라이트된 동물 머리 위**(py-84)에 매 틱 배치 → 이름/종류/팀이 한 군데에서 읽힘, 시선 이동 최소.
- 동물명 이모지: 렌더러 로컬 `SPECIES_EMOJI`(셸 SetupScreen의 CHAR_LABEL 미러, 렌더러는 셸 import 금지) + `speciesLabel(characterId)` 헬퍼. 이름은 데이터(characterCatalog.name)에서.
- 카드가 이름을 담으니 머리 위 small NameTag는 인트로 동안 계속 숨김(중복/겹침 방지). seam·셸 무변경, 회전 단위·결정론·캡처 훅 불변.

### 검증
- `npm run typecheck` 통과.
- 임시 훅/스펙으로 개인전 + 2팀 캡처 후 육안 확인, 임시 훅/스펙 삭제(렌더러만 남김).
- 캡처 경로(육안 확인 완료):
  - `tests/e2e/__screens__/lane-intro-card-individual.png` — 펭귄 머리 위 "펭귄1 / 🐧 펭귄" 카드(흰 테두리, 팀칩 없음).
  - `tests/e2e/__screens__/lane-intro-card-team-red.png` — "펭귄1 / 🐧 펭귄 / ● 레드팀"(빨강 테두리).
  - `tests/e2e/__screens__/lane-intro-card-team-blue.png` — "강아지2 / 🐶 강아지 / ● 블루팀"(파랑 테두리).
- 회귀: `race-visual.spec.ts` 5개 전부 통과.

### 추가: 1명당 시간↑ (~0.8s → ~1.35s)
- 인트로 비트 상수만 조정(한 곳): `INTRO_IN` 0.18→0.3(등장 ease-in 여유), `INTRO_HOLD` 0.62→1.05. `INTRO_BEAT = INTRO_IN+INTRO_HOLD ≈ 1.35s`. 등장/카드팝/디밍 모두 INTRO_IN에 연동돼 트랜지션도 덜 휙.
- 캡처(육안 확인): pace-enter(~0.15s 등장 중간 — 디밍/스포트라이트/카드 서서히 들어옴, 스냅 아님), pace-hold(~0.7s 안정 dwell), pace-next(~1.65s — 강아지2로 자연 전환). 비트 ~1.35s 확인.
  - `tests/e2e/__screens__/lane-intro-pace-enter.png`, `lane-intro-pace-hold.png`, `lane-intro-pace-late.png`, `lane-intro-pace-next.png`.
- 주의: 작업 시점에 engine-dev가 src/engine(바나나/회피/스턴 등)을 동시 수정 중이라 `npm run typecheck`에 엔진/skills.test 에러 + `race-visual` capture-key 테스트의 `banana:activate` 단언 실패가 있으나, **렌더러(RaceRenderer.ts) 자체 typecheck는 클린**이고 인트로 캡처는 정상 렌더. 이 실패들은 엔진 측 진행물이며 본 변경과 무관.

### 추가(Task #23): 소개 순서 팀별 그룹 정렬 (팀전만)
- `playLaneIntro`에서 `order` 구성을 변경: 개인전은 슬롯 순서 그대로, **팀전이면 teamId 기준 stable group sort**(팀 첫 등장 순으로 묶고, 팀 내부는 슬롯 순서 유지). `slotOrder.map(...{rank,i}).sort(rank||i)`로 재정렬만(드롭/중복 없음). seam·셸·카드·팀표시·길이 무변경, 결정론·캡처 훅 불변.
- 검증: **전역 `npm run typecheck` 그린**(engine-dev 작업 안정화됨). 임시 훅/스펙으로 캡처 후 삭제(렌더러만 남김).
  - 팀전(슬롯 penguin-red/dog-blue/cat-red/monkey-blue): 소개 순서 **펭귄(레드)→고양이(레드)→강아지(블루)** 확인 = 팀별로 묶임.
    - `tests/e2e/__screens__/lane-intro-order-team-1.png`(펭귄·레드), `-team-2.png`(고양이·레드, 슬롯2가 슬롯1 블루보다 먼저 = 그룹 증거), `-team-3.png`(강아지·블루).
  - 개인전: 펭귄→강아지 슬롯 순서 그대로(회귀 없음). `lane-intro-order-indiv-1.png`, `-indiv-2.png`.
- 주의: `race-visual` capture-key 테스트가 이제 `catwalk:activate`(시드7 미발동) 단언에서 실패하나, 이는 engine-dev의 스킬 rework로 시드7 이벤트 구성이 바뀐 **엔진 측 회귀**(sim.eventFrames 헤드리스 출력)이며 렌더러 변경과 무관(나머지 4개 통과, 인트로 캡처 정상). qa/engine 확인 필요.
