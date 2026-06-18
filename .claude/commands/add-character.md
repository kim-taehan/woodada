---
description: 새 동물 캐릭터 추가 (데이터 + 파츠 + 스킬)
argument-hint: <동물이름/스킬 아이디어>
---

데이터 주도 방식으로 새 동물을 추가해줘. 요청: $ARGUMENTS

`CLAUDE.md`의 "캐릭터 추가 방법"을 따르고, 아이디어는 `docs/animal-skill-catalog.md`를 참고해.

체크리스트:
1. `src/data/characters/<id>.ts` — CharacterData (palette·runStyle·renderScale?·skill·lines)
2. `src/data/partmodels/<id>.ts` — 귀여운 치비 PartModel (큰 머리·큰 눈·둥근 형태, 베이비 스키마)
3. `data/characters/index.ts`(catalog + defaultCharacterIds), `data/partmodels/index.ts` 등록
4. `SetupScreen.ts` CHAR_LABEL 이모지
5. 새 스킬이면 `src/engine/skills/<type>.ts` 핸들러 + `skills/index.ts` 등록 (기존 type면 데이터만)
6. 테스트 갱신: `schema.test.ts`(KNOWN_SKILL_TYPES, catalog 목록), `skills.test.ts`(활성 스킬 집합)
7. `main.ts` DEFAULT_IDS에 추가(스크린샷 등장용)

**역할이 기존 5종과 겹치지 않게** 하고(부스트/변칙/방해(저격·광역·근접)/방어/지원/함정 분배 확인),
스킬 회전값은 도(degree) 단위임을 유의해.

마지막에 `npm run typecheck` + `npm run test` + `race-visual.spec.ts` 캡처로 검증하고,
스크린샷을 Read로 열어 새 캐릭터가 귀엽게 잘 나오는지 눈으로 확인해줘.
