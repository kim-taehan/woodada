# h03 renderer-dev — 고슴도치(hedgehog) 파츠/포즈 시각 검증

## 범위
content-designer 인계대로 **파츠/포즈 시각 검증만** 수행. 스킬 FX(가시 밀치기 연출)는 engine-dev의 bristle 핸들러 emit 확정 후 별도 작업 → 이번엔 미작업(아래 "다음 작업" 참조). 렌더러 코드는 **수정 없음**(PartsCharacter의 biped 절차 분기가 hedgehog를 그대로 처리, 신규 분기 불필요).

## 확인 사실
- `src/data/partmodels/hedgehog.ts`, `src/data/characters/hedgehog.ts` 존재 + 두 index 등록 OK, `main.ts` DEFAULT_IDS 포함, SetupScreen CHAR_LABEL `🦔` OK.
- **bristle 핸들러는 이미 구현됨**(`src/engine/skills/bristle.ts`, `skills/index.ts`에 register). content-designer 노트는 "미구현"이라 했으나 engine-dev가 선반영함. `bristle:activate/hit/dodge` emit 확인(시뮬레이션 스캔에서 다수 발화). → 스킬 발동 시 hedgehog가 `straying` phase → `skill`(bristle) 포즈로 들어감.
- `spikes` 파트는 어떤 runStyle 절차 분기에도 매칭 안 됨 → run 중 정적 유지(의도대로 가시 펄럭임 없음), 포즈 델타(scale)만 적용됨을 육안 확인.

## 시각 검증 (Playwright, 임시 격리 캡처 후 삭제)
캐릭터가 화면에서 inside-curve로 뭉치는 특성상, 격리 캡처로 확인:
- **run/biped 베이스라인** (hedgehog 단독): 정면 치비 — 갈색 가시 돔(삼각 quill 8개가 rim으로 부채꼴) = 지배적 실루엣, 그 아래로 빠끔 나온 둥근 크림 얼굴 + 큰 눈(흰 하이라이트) + 분홍 볼 + 분홍 코, 크림 배, 짧은 팔다리. **땅 위 baseline에 섬**(다른 동물과 일치). 곰(둥근 귀/가시 없음)·원숭이와 명확히 구분됨.
- **skill(bristle) 포즈** (6인 로스터, seed 21 frame 738+9): 가시 돔이 scale로 곤두서고 몸 웅크림, 자기 글로우 + "따끔! 붙지 마! 🦔" 말풍선. 포즈 정상 적용.
- **win 포즈** (단독 결승선): 팔 활짝(armL/armR rot), 가시 돔 puff, 머리 듦. 정상.
- **전체 필드 합류** (`race-mid.png` 등 골든): 7인 로스터에서 '고슴도치'가 다른 6종과 함께 깨짐 없이 렌더. LIVE TOP3에도 정상 표기.

판정: **파츠/포즈 모두 정상 렌더. 사라짐/깨짐/회전단위 이상 없음. 베이비 스키마(큰 머리·큰 눈·둥근 형태) + 가시 정체성 잘 읽힘.**

## QA 인계 (qa-verifier)
- `npm run typecheck`: 통과.
- `npm run test`: 43/43 통과(2회 연속). 첫 1회는 `engine-bias` 공정성 테스트 2건이 transient flaky로 실패했다가 재실행 시 통과 — hedgehog 무관(랜덤 시드 다수 + 느슨한 임계). 재현 시 재실행 권장.
- `schema.test.ts`(KNOWN_SKILL_TYPES에 bristle / catalog에 hedgehog), `skills.test.ts`(활성 스킬 집합) 이미 갱신되어 green.
- `race-visual.spec.ts`: 5/5 통과. 골든 스크린샷(`__screens__/`) 다수가 hedgehog가 필드에 합류하며 갱신됨 — **의도된 변경(회귀 아님)**.

## 다음 작업 (스킬 FX 연출 — 보류 해제 시 renderer-dev)
- 렌더러에 **아직 `bristle:*` FX 핸들링 없음**(`grep bristle src/renderer/` = 0). 현재는 표준 skill 포즈 + 글로우만, 하단 실황 자막도 없음(`commentaryLines.ts`에 `bristle:*` 풀 부재).
- bristle 발동 시 연출 추가 필요: `RaceRenderer.ts` 이벤트 스위치에 `bristle:activate/hit/dodge` 케이스(가시 ✨ + 뒤 추격자 밀치기/감속 임팩트 + 충격파 톤), `FxLayer`에 가시 버스트 helper, `commentaryLines.ts`에 `bristle:activate/hit/dodge` 병맛 대사 풀. 이벤트 계약(키/variant)은 위에서 확정됨.
