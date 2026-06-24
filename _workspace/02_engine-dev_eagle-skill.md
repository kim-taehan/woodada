# 02 — engine-dev: 독수리(eagle) 점프 박치기 전환

## 결정 (engine-dev 소유)

**스킬 type 이름: `divebomb` 그대로 유지.**

이유:
- 메커닉이 100% 동일. 앞 레이서 저격 + 50/50 도박(성공=상대 기절 + 본인 전진버스트 / 실패=자폭). 변하는 건 '연출 의미'(하늘 급강하 → 땅에서 폴짝 점프 박치기)뿐.
- 이름을 바꾸면 파급이 큼: `skills/index.ts` 등록, `eagle.ts` `skill.type`, 렌더러 이벤트 키 `divebomb:activate/hit/dodge`(`RaceRenderer.ts`), `commentaryLines.ts`, `FxLayer.ts`, `catwalk.ts` `DISRUPTORS` 셋, `schema.test.ts`(KNOWN_SKILL_TYPES), `skills.test.ts`(활성 스킬 집합), `race-visual.spec.ts`. 전부 순수 리네임 — 행동상 이득 0.
- → 외과수술적으로 **type 유지 + 함수/주석/내러티브 어휘만 '점프 박치기'로 갱신**이 정답.

## SkillEvent variant: 변경 없음

`activate` / `hit` / `dodge` 그대로 유지. 자폭은 기존대로 variant `hit` + `targetId === self.id`(자기 자신)로 표현 — 렌더러가 self-botch로 판별(`RaceRenderer.ts:1025` `e.type === 'divebomb' && e.variant === 'hit' && e.targetId === e.racerId`). 새 variant 추가 안 함 → renderer-dev에 별도 액션 불필요. 단 모션(공중 급강하 호 → 점프 박치기)은 렌더러 영역이므로 renderer-dev가 시각 모션을 교체해야 함(엔진 이벤트 계약은 그대로).

## params: 변경 없음

`{ range: 70, stunMs: 700, selfRiskChance: 0.5, diveBurst: 0.9, diveBurstMs: 800 }` 유지.

## 바꾼 파일 (코멘트/내러티브만, 로직·시그니처·결정론 무변)

- `src/engine/skills/divebomb.ts` — 헤더 주석을 '급강하/plunge/dive'에서 '점프 + 박치기(hop + headbutt)'로 갱신. `divebomb` type 유지 명시. 로직 한 줄도 안 건드림(`rng.bool` 도박, 서브스트림, 드로 순서 비의존 유지).
- `src/data/characters/eagle.ts` — `skill` 블록 주석을 '점프 박치기'로 갱신 + type 유지 사유 명시. `lines.skill`('급강하!! 🦅') 등 데이터 문자열은 **content-designer 영역이라 손대지 않음**.

## 검증

- `npm run typecheck`: 통과
- `npm run test`: 43/43 통과 (determinism / skills / engine-bias 모두 green). 코멘트만 바꿨으므로 결정론 영향 0 — 예상대로.

## 다른 영역에 통지할 사항

- **content-designer**: type은 `divebomb` 유지. data 쪽에서 type 바꿀 필요 없음. 박치기 연출에 맞는 `lines`(skill/win/lose/dodge) 카피만 갱신하면 됨(엔진은 그대로 emit).
- **renderer-dev**: 이벤트 키(`divebomb:activate/hit/dodge`)와 self-botch 판별(`type==='divebomb' && variant==='hit' && targetId===racerId`)은 그대로. 엔진 계약 무변. 시각 모션(급강하 호 → 점프 박치기)만 렌더러에서 교체. commentaryLines의 '급강하/하늘에서 내리꽂는다' 카피도 박치기 톤으로 손볼 여지(렌더러/콘텐츠 협의).
