# s01 content-designer — 🕷️거미 + 🛸외계인 (로스터 7→9)

브랜치 `feat/spider-alien`. 데이터·아트·등록 담당분. 엔진 핸들러는 engine-dev 병렬.

## 1. 캐릭터 명세

### 🕷️ 거미 (spider) — `abduct`
- **역할(신규·비중복):** 단일표적 **위치 강등**. 앞선 적을 자기 뒤로 끌어내리고 거미줄로 엉킴 감속. 기존은 제자리 스턴/밀치기/감속뿐 → 순위를 직접 끌어내리는 결은 거미가 처음.
- **스탯:** speed 2 / power 4 (방해형, 느리지만 단단함). 합 6.
- **runStyle:** `skitter` (렌더러 미지원 → biped 폴백 스윙. 앞다리 한 쌍 `legL/legR`만 스윙, 나머지 6다리 정적 장식).
- **renderScale:** 0.9
- **palette:** base `#4A3B66`(보라 몸), point `#8A6FB0`(연보라 배), outline `#241A38`, cheek `#E89AA0`, web `#E8ECF2`(거미줄 실).
- **lines:** skill `거기 서! 줄로 콱! 🕸️` / win `다 내 거미줄 안이었어~` / lose `줄이… 끊겼다…` / dodge `어라, 빠져나갔네?`
- **PartModel(정면 치비):** 큰 둥근 머리+큰눈(메인 2개+상단 미니 2개), 둥근 보라 몸+연보라 배, 다리 8(앞 한 쌍만 스윙), 작은 송곳니 스마일, 거미줄 spinneret. 꼬리/귀 없음.

### 🛸 외계인 (alien) — `mimic`
- **역할(신규·비중복):** **변수형 카피**. 가장 가까운 주자의 스킬을 그 주자의 params로 복사 발동. 고정 효과 없는 와일드카드.
- **스탯:** speed 3 / power 3 (올라운드). 합 6.
- **runStyle:** `glide` (이글과 공유 — 호버, 다리 접힘, 더듬이 흔들림). 이글과 구분: 날개·부리·발톱 없음, 더듬이+거대 눈으로 정체성.
- **renderScale:** 0.88
- **palette:** base `#7FD98C`(초록 외계인), point `#C8F2CE`(연초록 배), outline `#2E5B36`, cheek `#E89AA0`, eye `#1C2233`(검은 아몬드 눈), antenna `#FFD45E`(더듬이 전구).
- **lines:** skill `스캔 완료… 카피한다! 🛸` / win `지구 기술, 접수 완료.` / lose `본진으로 후퇴…` / dodge `스캔 실패… 신호 없음`
- **PartModel(정면 치비):** 큰 민머리 돔+거대 검은 아몬드 눈(기울임)+하이라이트, 더듬이 2개(`earL/earR`로 자동 흔들림, 노란 전구), 작은 몸+팔2(`armL/armR`)+다리2(`legL/legR`, glide가 접음), 작은 입. 꼬리 없음.

## 2. 스킬 params 계약 (engine-dev와 합의 완료)
**단위 정정:** 초안은 lap-fraction(0~1)이었으나 engine-dev가 **절대 progress 단위(trackLength=1000, divebomb/roar와 동일)**로 수정 → 채택.

### abduct (spider) — 최종 수렴값
`cooldownMs: [2600, 4200]`, `params: { range:130, minRange:16, pullGap:90, tangleMul:0.55, tangleMs:900, immuneMs:1000 }`
- range: 전방 탐색 창 / minRange: 코앞 제외(최소 앞섬) / pullGap: 거미 뒤로 떨굴 progress 간격 / tangleMul: 엉킴 속도배율(0~1) / tangleMs: 엉킴 지속 / immuneMs: 재납치 방지(릴레이 체인 가드).
- 의미: self+minRange ~ self+range 안의 최근접 비팀원을 self.progress - pullGap 으로 강등 후 tangleMs 동안 감속.

### mimic (alien) — 최종 수렴값
`cooldownMs: [3000, 4600]`, `params: { scanRange:350 }`
- scanRange: 최근접 주자 스캔 거리(절대 progress). 외계인 자체 effect params 없음 — scanRange + cooldownMs만.
- 의미: 발동 시 scanRange 내 최근접 비-자기 주자를 찾아 그 스킬 type을 그 캐릭 params로 복사 발동(소스는 외계인).
- **fizzle = hold(무발동, fallback 없음)** — 복사불가(반응형/다른 외계인)면 그 틱 hold→재시도(divebomb 패턴).
- 엔진 구현: 옵션A 확정 — `SkillContext.invokeSkill` + 레지스트리 디스패치 (engine-dev 소유).

## 3. 등록 위치 (전부 완료)
- `src/data/characters/spider.ts`, `src/data/characters/alien.ts` (신규)
- `src/data/partmodels/spider.ts`, `src/data/partmodels/alien.ts` (신규)
- `src/data/characters/index.ts` — import + catalog + defaultCharacterIds(→9) + re-export
- `src/data/partmodels/index.ts` — import + partModels 맵
- `src/shell/screens/SetupScreen.ts` CHAR_LABEL — `spider:'🕷️'`, `alien:'🛸'`
- `src/main.ts` DEFAULT_IDS — 'spider','alien' 추가(시각 캡처 로스터, 총 9)
- `tests/unit/schema.test.ts` "ships the active characters" 목록에 alien/spider 추가 (데이터 측)

## 4. 검증 상태 (수렴 완료)
- **전체 typecheck: clean.** schema.test: 3/3 PASS (catalog-list + speed/power + known-skill-type).
- engine-dev가 `KNOWN_SKILL_TYPES`에 'abduct'/'mimic' 추가, skills.test 활성집합, `src/engine/skills/mimic.ts`(invokeSkill 디스패치) 완료 → 이전 레드 2건 모두 해소됨.
- 고슴도치 등 기존 캐릭터 미접촉. 베이비 치비 스키마(큰머리·큰눈·둥근형) 준수.
- 잔여(타 영역): 렌더러 파츠 육안 검증(renderer-dev/qa, Playwright 스크린샷), 최종 밸런스 튜닝(balance-tuner, skill.params로 자유 조정).
