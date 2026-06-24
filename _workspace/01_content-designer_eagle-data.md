# 01 content-designer — 독수리(eagle) 공중→지상 전환 (data 영역)

## 결정 사항
- **runStyle**: `'fly'` → **`'biped'`** (penguin 선례 따름: 정면 치비 워들러 + 접은 날개를 flipper처럼 스윙).
- **스킬 type**: **`'divebomb'` 유지** (engine-dev가 eagle.ts에 직접 편집해 확정 — 메커니즘 동일, flavor만 '폴짝 점프 박치기'로 재해석). 새 핸들러 신설 안 함.
- **params 불변**: `{ range:70, stunMs:700, selfRiskChance:0.5, diveBurst:0.9, diveBurstMs:800 }`.
- **역할 비중복**: 기존 '방해·저격(50/50 도박 스턴 + 자기 위험)' 역할 그대로 유지. 로스터 내 다른 캐릭터와 겹치지 않음. 비주얼 정체성만 공중→지상으로 이동.

## 수정 파일
1. `src/data/characters/eagle.ts`
   - runStyle 변경, 주석 지상 기준으로 갱신.
   - lines: skill `'급강하!! 🦅'`→`'받아랏! 🦅'`, win `'하늘은 내 거다!'`→`'1등은 내 거다!'`, dodge `'바람을 타고 휘익~'`→`'휘릭, 안 맞지롱~'` (비행 어휘 제거).
   - (skill 블록 주석은 engine-dev가 점프 박치기로 갱신함.)
2. `src/data/partmodels/eagle.ts` — 전면 재설계 (아래).
3. `src/data/partmodels/penguin.ts` — 주석 1줄(eagle을 "airborne hover"로 묘사하던 stale 문구)만 정정. 내 변경이 무효화한 흔적 정리.

## partmodel 파츠/포즈 변화 (renderer-dev 인계)
**파트 이름 변경 (핵심 — biped 절차 애니가 이 이름에 의존):**
- `wingL`/`wingR` (어깨 피벗, 펼친 호버 날개) → **`armL`/`armR`** (몸에 붙인 접은 날개, penguin flipper 형태/피벗 감각). PartsCharacter biped 분기가 armL/armR을 ±30° 스윙.
- `legL`/`legR`: tuck-up 작은 talon → **땅 딛는 선 talon** (pivot y 92, 발가락 3가닥 ~y105). biped 분기가 ±36° 다리 교차.
- `body` pivot `{0,64}`, `head` pivot `{0,30}` — biped 분기의 body/head bob 키와 일치하도록 명시.
- `tail` 유지(몸 아래 짧은 부채꼴).

**포즈 델타 (rot=도):**
- `idle`/`run`: `{}` — 절차 애니에 맡김.
- `skill` (폴짝 박치기): `head{dy:6,rot:10}`, `body{dy:-4}`, `armL{rot:40}`, `armR{rot:-40}` — 머리/몸 앞으로 들이받고 날개 뒤로 당김. PartsCharacter의 skilling 시 poseAmp 1.8× + root forward lean이 biped에도 적용되어 '들이받는' 액션으로 읽힘.
- `win`: `armL{-34}`/`armR{34}`, `head{dy:-4}` (날개 활짝).
- `fall`: `head{rot:16}`, `armL{22}`/`armR{-22}`.

## renderer-dev 참고
- `PartsCharacter.ts`의 `style === 'fly'` 분기와 dejected 슬럼프의 `wingL`/`wingR` 전용 처리는 이제 eagle에서 미사용 (eagle은 biped 분기 + 표준 슬럼프 경로). **죽은 가지 정리 여부는 renderer-dev 판단** — 다른 캐릭터가 'fly'를 쓰지 않는다면 정리 후보.
- 팔레트 불변(base/point/outline/cheek/beak/wing).
- 시각 검증: 새 경주 시작 시 Pixi 씬 재생성. Playwright로 출발/스킬발동/결과 포즈 캡처 확인 요망.

## QA 인계 (qa-verifier)
- 스킬 type/catalog 목록 변화 **없음** → `schema.test.ts`·`skills.test.ts` 갱신 불필요(KNOWN_SKILL_TYPES에 divebomb 이미 존재, eagle 이미 catalog 등록).
- index/SetupScreen CHAR_LABEL/main.ts DEFAULT_IDS 변경 불필요(eagle 기존 등록).
- typecheck는 engine 변경과 일괄 검증.
