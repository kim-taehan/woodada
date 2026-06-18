# 23 · content-designer · 고양이 측면 4족 갤럽 재디자인 + 강아지 귀여움 강화

## 변경 파일
- `src/data/partmodels/cat.ts` — 정면 치비 → 측면 4족 갤럽 프로필로 전면 재작성
- `src/data/characters/cat.ts` — runStyle `scamper` → `gallop`, renderScale 0.85 → 0.88
- `src/data/partmodels/dog.ts` — 베이비 스키마 강화(머리·눈 하이라이트·블러시), 측면/갤럽/실루엣 유지

엔진(`src/engine/`) 무수정. skill.type(catwalk)·cooldownMs·params·lines 무수정.

## 고양이 측면 4족 구조 (dog.ts 모델 채택)

파트 목록 / z순서 (back→front):
| z | part | 역할 |
|---|------|------|
| 0 | tail | 슬림 S컬 꼬리(뒤로 휘말림). 렌더러 auto-stream |
| 1 | earL | 삼각 귀 + 분홍 안쪽(cheek). 렌더러 auto-stream |
| 1 | legR | far 뒷다리 (FARLEG 색, 가늘게) |
| 1 | frontLegR | far 앞다리 (FARLEG 색) |
| 2 | body | 슬림 측면 몸통 |
| 3 | legL | near 뒷다리 (base 색) |
| 3 | frontLegL | near 앞다리 (base 색) |
| 4 | head | 측면 큰 머리(옆얼굴) |

다리 네이밍은 **dog.ts와 동일** (legL/legR/frontLegL/frontLegR) — 렌더러 gallop 분기가 이 이름으로 스윙. arm 파트 전면 제거(4족이라 불필요).

### 날씬화 수치 (before front-chibi → after side-cat, dog 대비)
| | dog body | cat body (after) | cat (before, 정면) |
|---|---|---|---|
| body rx | 31 | **27** | 28 |
| body ry | 25 | **19** (세로 납작·슬림) | 27 |
| 다리 rx | 8.5~9 | **6~6.5** (확실히 가늘게) | 9 |
| head r | 36 (강화 후) | 33 (몸 대비 큼=베이비) | 39 |

→ dog보다 rx 작고 ry 낮아 날렵한 가로 실루엣 + 가는 다리. far 다리는 로컬 상수 `FARLEG = '#838B94'`(base보다 한 톤 어둡게)로 원근감(dog의 FARLEG 패턴 동일).

### 귀여움 + 도도함 균형 (베이비 스키마)
- 머리를 몸 대비 크게(head r33 vs body rx27)
- 큰 아몬드 눈 1개(측면) rx8/ry9 + 하이라이트 점 2개(HI)
- 볼 블러시(cheek, opacity 0.85)
- 단, 윗눈꺼풀 path 유지 → 반쯤 감긴 "도도한" 인상 보존
- 고양이다움: 삼각 귀+분홍 안쪽, 하트 코, 수염 2가닥(측면이라 앞으로만 fan), 이마/옆구리 tabby stripe. 곰(둥근 귀·수염X)·원숭이(정면)와 구별.

### poses (측면 4족용으로 갱신, rot=도)
- idle/run: {} (run 다리스윙은 렌더러 gallop이 절차적 생성)
- skill: head dy -3, tail rot -20, frontLegL rot 18
- win: head dy -6, tail rot -28
- fall: head rot 16, tail rot 20
- (구버전의 armL/armR 참조 제거 — 파트 자체가 없어짐)

## runStyle 결정 근거 — 렌더러가 gallop을 어떻게 처리하나
`src/renderer/character/PartsCharacter.ts` 확인 결과:
- `style === 'gallop'` 분기(L176~191): far 쌍(legR/frontLegR)은 위상 +0.5 지연, frontLeg 쌍은 `+swing*42°`(앞으로 reach), 뒷다리 쌍은 `-swing*42°`(뒤로 push). body가 가로로 stretch, head 살짝 bob, 전체 lift(bound).
- `this.inner.scale.x = dir`(L265)로 진행방향 따라 통째 flip — 모델은 +x 정면 작성.
- earL/earR/tail은 style 무관 auto-stream(L167~168).
- → 측면 4족엔 gallop이 정답. scamper는 정면 2족+arm flail이라 측면과 어긋남.
- 좌표계는 dog와 동일 프레임(body cy~32, head cy~0)으로 맞춰 `inner.y=-55-lift` 기준선에 정상 안착.

## renderer-dev / qa-verifier 시각검증 포인트
1. **다리 스윙**: 경주 중 고양이 4족이 갤럽으로 교대 스윙하는지(앞쌍 reach / 뒷쌍 push, far쌍 약간 지연). 다리가 안 움직이면 네이밍 불일치 신호 → legL/legR/frontLegL/frontLegR 확인.
2. **flip**: 좌→우/우→좌 진행 시 통째 미러링(`inner.scale.x=dir`)되며 머리·꼬리 방향이 진행방향과 맞는지. 글자/얼굴 뒤집힘 없는지.
3. **far 다리 가시성**: legR/frontLegR가 body(z2) 뒤(z1)에서 살짝 어둡게 보이는지(원근감). near 다리(z3)는 body 앞.
4. **슬림 실루엣**: 강아지보다 확연히 날씬·날렵하게 보이는지(과하게 작지 않은지 — renderScale 0.88).
5. **귀여움**: 큰 눈+하이라이트, 볼 블러시, 도도한 윗눈꺼풀 동시 인식되는지.
6. **강아지**: 머리 살짝 커지고 눈 하이라이트/볼 블러시 또렷해졌지만 기존 갤럽 실루엣 유지(과장 X).

시각검증: `npx playwright test race-visual.spec.ts --project=desktop` 후 출발/스킬발동/마지막바퀴 캡처 육안 확인. main.ts DEFAULT_IDS에 cat/dog 포함 여부는 renderer-dev/qa와 조율(로스터 캡처 등장).
