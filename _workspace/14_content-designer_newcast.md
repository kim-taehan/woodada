# 14 · content-designer · 신규 캐스트 (토끼·코끼리 → 고양이·독수리)

데이터 + 파츠모델 + 등록/제거만 수행. 스킬 핸들러(engine)·FX(renderer)·테스트(qa)는 별도 에이전트.

## 신설 파일
- `src/data/characters/cat.ts` — 🐱 고양이 (id `cat`)
- `src/data/characters/eagle.ts` — 🦅 독수리 (id `eagle`)
- `src/data/partmodels/cat.ts` — `catModel` (정면 치비)
- `src/data/partmodels/eagle.ts` — `eagleModel` (정면 치비, 떠있는 포즈)

## 수정 파일
- `src/data/characters/index.ts` — catalog `{dog,cat,monkey,eagle,bear}`, defaultCharacterIds 동일 순서
- `src/data/partmodels/index.ts` — `cat`/`eagle` 등록, `rabbit`/`elephant` 제거
- `src/shell/screens/SetupScreen.ts` — `CHAR_LABEL` 에서 rabbit/elephant 제거, `cat:'🐱'`,`eagle:'🦅'` 추가
- `src/main.ts` — `DEFAULT_IDS` rabbit/elephant → cat/eagle (`['bear','dog','cat','monkey','eagle','bear']`)

## 삭제 파일
- `src/data/characters/rabbit.ts`, `src/data/characters/elephant.ts`
- `src/data/partmodels/rabbit.ts`, `src/data/partmodels/elephant.ts`

## 역할 비중복 (5종 전부 다름 — 확인 완료)
| 캐릭터 | 역할 | 스킬 type |
|---|---|---|
| 🐶 강아지 | 부스트·변칙 | zoomies |
| 🐱 고양이 | **회피·추월(면역+슬립)** | catwalk |
| 🐒 원숭이 | 방해·저격 | banana |
| 🦅 독수리 | **순위 강탈(앞 표적 끌어내림)** | snatch |
| 🐻 곰 | 방해·광역(스턴) | roar |

cat = 자기 보호/전진형(타인 무방해), eagle = 표적 직접 강등형 → 곰(광역)·원숭이(단일 스턴)과 메커니즘 구분됨.

---

## engine-dev 인계: 신규 스킬 type + params 명세

### `catwalk` (cat)
- `cooldownMs: [3000, 5000]`
- `params: { immuneMs: 1400, slipBoost: 0.6 }`
  - `immuneMs` (number): 면역 지속 시간(ms). 이 동안 banana/roar/snatch 등 모든 방해를 **회피**(dodge). 회피 시 `dodge` 라인 사용.
  - `slipBoost` (number): 면역 중 적용되는 **추가 전진 속도**(zoomies보다 작은, 매끄러운 가속 성격).
- dodge 이벤트를 내보내면 renderer가 dodge 대사/FX 처리.

### `snatch` (eagle)
- `cooldownMs: [4500, 7000]`
- `params: { range: 120, dropBack: 90 }`
  - `range` (number): 자기 **앞쪽**에서 표적을 탐색할 거리(progress 단위). 사거리 내 가장 가까운 앞 레이서 1명 선택.
  - `dropBack` (number): 선택한 표적을 **뒤로 떨굴 거리**(progress 단위).
  - banana/roar의 brace-immune 패턴과 동일하게, 추후 면역 대상(예: catwalk 면역 중) 제외 처리 권장.
- 표적 없으면 불발. lose/dodge 라인 보유.

### 제거할 핸들러 (engine 영역)
- `src/engine/skills/nap.ts`, `src/engine/skills/brace.ts` + `skills/index.ts` 등록 해제.
- `src/engine/types.ts`의 `napUntil`/`hasNapped`/`dash*`/`braceUntil` 등 nap·brace 전용 필드, `RaceEngine.ts`/`overtake.ts`/`banana.ts`/`roar.ts`의 `braceUntil` 참조 정리.
- `src/data/schema.ts` `SkillType` 유니온의 `'nap'` 리터럴은 engine/qa 협의로 교체 가능(`(string & {})` 덕에 catwalk/snatch는 타입 통과함 — 현재 데이터는 타입 에러 0).

---

## renderer-dev 인계: eagle 'fly' 파츠 구조

### runStyle
- `eagle.runStyle = 'fly'` (신규 값). PartsCharacter의 `reducedMotion` 시 'biped' 폴백 경로 그대로 탐 → 'fly' case만 추가하면 됨.
- 의도: **호버(살짝 떠서 위아래 까딱) + 날개짓**. 다리로 딛는 모션 없음.

### eagleModel 파츠 구조 (정면, 떠있는 포즈)
- **날개 = `wingL` / `wingR`** (z:1). 어깨 피벗 `{x:∓22, y:52}`. rot 델타로 위/아래 스윙(음수=왼쪽 들림, 양수=오른쪽 들림). **이 둘이 메인 실루엣.**
- `tail` (z:0): 몸 아래 짧은 부채꼴 꽁지.
- `body` (z:2): 피벗 `{x:0, y:56}` = **호버 기준점**. 렌더러는 root를 이 중심으로 위아래 bob.
- `legL` / `legR` (z:3): **작게 접어 올린** 발톱(line 3개). 서있지 않음 — 공중에 떠 있는 표현.
- `head` (z:5): 부리(beak, hooked) + 큰 눈 + 진한 깃 캡.

### 포즈 델타 (날개 스윙 키 포함)
- `skill`: `wingL{rot:-34,dy:-6} wingR{rot:34,dy:-6} head{dy:4}` — 급강하 낚아채기(날개 위로 젖힘+머리 전진).
- `win`: `wingL{rot:-28} wingR{rot:28} head{dy:-4}` — 날개 활짝.
- `fall`: `wingL{rot:20} wingR{rot:-20} head{rot:16}` — 날개 접힘.
- run 포즈는 비워둠 → 'fly' 절차 애니(호버+퍼덕)로 처리.
- 팔레트 키: `base`(머리캡/꽁지 어두운갈), `point`(얼굴/가슴 크림), `wing`(날개), `beak`(부리/발톱 노랑), `outline`, `cheek`.

### cat 파츠(참고)
- 정면 치비. `tail`(S컬), `earL`/`earR`(삼각 + 핑크 내부삼각), 수염 line 4개, 하트 코, 반쯤 감은 도도한 눈. runStyle `scamper`(기존값 재사용 — 신규 처리 불필요).
- 팔레트 키 추가: `stripe`(이마 줄무늬). 나머지 base/point/outline/cheek/nose 표준.

---

## qa-verifier 인계: 갱신 필요한 테스트/스크립트 (data가 직접 손대지 않음)
- `tests/unit/schema.test.ts:4` `KNOWN_SKILL_TYPES` — nap/brace 제거 여부 + catwalk/snatch 추가 검토.
- `tests/unit/schema.test.ts:20` catalog 목록 기대값 `['bear','dog','elephant','monkey','rabbit']` → `['bear','cat','dog','eagle','monkey']`.
- `tests/unit/skills.test.ts:17` 활성 스킬 집합 기대값, `:28~36` nap 전용 테스트.
- `tests/unit/scoring.test.ts`, `engine-bias.test.ts`, `relay.test.ts` — characterIds에 rabbit/elephant 사용 → cat/eagle로 교체.
- `tests/e2e/race-visual.spec.ts:26,41` — `nap:activate`/`brace:activate` 이벤트 키 → catwalk/snatch 이벤트로.
- `scripts/balance.ts:9,26` — ids/wins 맵 rabbit/elephant → cat/eagle.

## 자가검증
- `npm run typecheck` → **PASS** (데이터 타입 에러 0). 위 테스트/엔진 실패는 예정된 인계 항목.
