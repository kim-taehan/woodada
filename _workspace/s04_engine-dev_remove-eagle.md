# s04 · engine-dev · 독수리(eagle) 제거

독수리 캐릭터 + divebomb 스킬을 로스터에서 완전 제거. mimic 안전성 확인 후 진행.

## mimic 안전성 확인 (가장 위험한 부분 — 통과)
mimic은 **레지스트리를 열거하지 않는다.** `mimicHandler`는 오직 *가장 가까운 대상 레이서의 자기 스킬*만 복제한다
(`ctx.skillTypeOf(target.id)` → `ctx.invokeSkill(type, params)`). `canCopySkill`/`invokeSkill`(RaceEngine.ts:286, 310)은
`skills.get(copiedType)` 단순 조회일 뿐, 등록 스킬 목록을 순회해 무작위 선택하지 않는다.

→ eagle이 사라지면 어떤 레이서도 `divebomb`을 갖지 않으므로 divebomb은 **런타임에 선택될 수 없다.**
divebomb 핸들러/등록 제거는 mimic에 무해. mimic이 divebomb에 의존하는 테스트도 없음
(skills.test.ts의 `copyable` 목록은 단순 화이트리스트라 divebomb만 빼면 됨). **제거 안전 — 멈출 사유 없음.**
mimic 결정론 테스트(`skills.test.ts`)는 로스터에서 eagle→spider 교체 후에도 통과.

## 삭제한 파일
- `src/data/characters/eagle.ts`
- `src/data/partmodels/eagle.ts`
- `src/engine/skills/divebomb.ts`

## 수정한 파일
**데이터**
- `src/data/characters/index.ts` — import/catalog/`defaultCharacterIds`/re-export에서 eagle 제거 (9→8자).
- `src/data/partmodels/index.ts` — eagleModel import/등록 제거.

**엔진**
- `src/engine/skills/index.ts` — divebombHandler import + `r.register('divebomb', …)` 제거.

**셸/부트스트랩**
- `src/shell/screens/SetupScreen.ts` — `CHAR_LABEL`에서 `eagle: '🦅'` 제거.
- `src/main.ts` — `DEFAULT_IDS`에서 'eagle' 제거.

**테스트/스크립트**
- `tests/unit/schema.test.ts` — `KNOWN_SKILL_TYPES`에서 divebomb 제거, catalog 목록에서 eagle 제거.
- `tests/unit/skills.test.ts` — self-activating 기대 목록·copyable 목록에서 divebomb 제거; **divebomb 거동 테스트 통째 삭제**;
  catwalk-dodge 두 테스트의 필터에서 divebomb 제거(roar 기반으로 축소); 여러 로스터의 eagle을 spider/penguin으로 교체.
- `tests/unit/scoring.test.ts` — teamRankSum 픽스처 로스터 eagle→penguin (finish order 강제라 필러일 뿐).
- `tests/e2e/race-visual.spec.ts` — `ROAR_IDS` 로스터 eagle→spider (load-bearing: simulate가 'eagle'을 못 씀).
- `scripts/balance.ts` — `C_mixed` eagle→spider, ROSTER 주석 갱신(7→8).

## 검증 결과
1. **typecheck**: eagle/divebomb 관련 에러 0. (남은 3개 에러 — `src/data/partmodels/cat.ts`의 미사용 PUPIL/RIM 상수 2개,
   `tests/e2e/cat-black-tmp.spec.ts`의 node 타입 누락 — 은 **이 브랜치의 기존 작업물**이며 내 변경과 무관. 내가 만진 cat.ts 없음.)
2. **test**: `npm run test` 51/51 통과. mimic·engine-bias(8자 여전히 공정)·scoring·schema·skills 모두 green.
   engine-bias는 `defaultCharacterIds` 사용 → eagle 빠진 8자 로스터로 자동 검증, 공정성 유지.
3. **balance**: `npx vite-node scripts/balance.ts -- --n 150` 에러 없이 완주. 8자 표 정상 출력,
   C_mixed(spider/bear/hedgehog) 회귀 체크도 정상.

## 남은 divebomb 라이브 코드 (의도적으로 미수정 — 무해)
체크리스트가 "다른 스킬 파일의 divebomb 주석/죽은코드는 건드리지 말 것"으로 명시 → 아래는 그대로 둠:
- `src/data/schema.ts:21` — `SkillType` 유니온에 `'divebomb'` 리터럴 (open `(string & {})` 유니온, 무해).
- `src/engine/skills/catwalk.ts:15` — `DISRUPTORS` Set에 `'divebomb'` (이제 emit 안 되니 죽은 항목이나 무해).
- abduct/dodge/mimic/bristle/catwalk/types.ts 등의 divebomb **주석 참조** 다수 (전부 주석).

## 렌더러에 남는 eagle/divebomb 죽은 코드 (renderer-dev 후속 정리용 — 나는 미수정)
경계 밖이라 손대지 않음. typecheck는 깨지지 않음(전부 문자열 키 `id==='eagle'` / `e.type==='divebomb'` 분기, 직접 import 없음):
- `src/renderer/RaceRenderer.ts` — divebomb hop/headbutt 스크린-스페이스 연출 전체
  (`divebomb:activate/dodge/hit` case들, self-botch 분기 ~L558-605, L1018 hop, L1208-1211 self-botch, eagle 주석 다수).
- `src/renderer/fx/FxLayer.ts` — eagle 깃털 흩날림/divebomb 성공·실패 골드/더스트 큐 (L168, L182, L228, L262).
- `src/renderer/character/PartsCharacter.ts` — glide(eagle) 측면 포즈·날갯짓 분기 (L139, L324-331, L399, L418).
- `src/renderer/fx/commentaryLines.ts` — `divebomb:activate/self/hit/dodge` 자막 + `divebomb: '독수리 박치기'` 라벨 (L16-25, L87).

추가로 **e2e/메인 캡처 훅의 divebomb 죽은 코드**(renderer 프루프샷용, 이제 영구 미발동):
- `src/main.ts` — `divebombSelfFrame` 캡처 로직(L76-78, L97-99, L126). divebomb 이벤트가 영영 안 나와 항상 `-1`.
- `tests/e2e/race-visual.spec.ts` — divebomb rise/apex/impact 캡처 블록(L94-104)과 self-botch 스캔 블록(L118-128).
  `if` 가드가 이제 절대 참이 안 되므로 무동작(inert). 해당 `race-divebomb-*.png` 프루프샷은 더 이상 생성 안 됨.
