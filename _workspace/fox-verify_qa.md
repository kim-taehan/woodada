# 구미호(fox) illusionClone — 최종 품질 게이트 검증 결과

브랜치: feature/fox-illusion
판정: **전 게이트 통과 (PASS).** 직전 회귀(registry 붕괴)는 해소됨. 시각검증 육안 확인 완료.

> 검증 모드: 검증 + 허용된 픽스처 1줄 픽스만. 소스 로직(src/) 무수정.
> 유일한 내 변경: `tests/e2e/race-visual.spec.ts`의 `CATWALK_SEED` 4 → 2 (+근거 주석).

## 게이트 체크리스트
- [x] **typecheck** — src/ **0 에러**. (tests/e2e/capture-*.spec.ts 무관 에러 4건은 이번 작업과 무관, 아래 별도 보고)
- [x] **단위테스트** — **62 passed / 62** (9파일 전부 green). schema/skills/determinism/engine-bias/relay/deathmatch 포함.
- [x] **e2e 시각검증** — `race-visual.spec.ts --project=desktop` **6 passed**.
- [x] **스크린샷 육안 확인** — fox 치비·illusionClone FX·catwalk FX 모두 정상(파일명 아래).

## 직전 회귀 해소 확인 (engine·content 빌드 결과)
- 이전 검증의 35 실패 단일원인이던 깨진 병렬 registry(`tick is not a function`)가 복구됨 → 62/62 통과.
- `createDefaultSkillRegistry`가 SkillDef(catwalk/bristle)를 정상 정규화하도록 회복.
- schema.test.ts: `KNOWN_SKILL_TYPES`에 illusionClone 추가, 활성캐릭 목록에 fox 추가 (빌더가 갱신).
- skills.test.ts: 활성 self-activation 집합에 illusionClone 추가, mimic copy-block 단언 추가 (빌더가 갱신).
- illusionClone는 placeholder가 아니라 실제 tick-driven 자기발동 스킬로 구현됨(분신·텔레포트·충돌팝 FX 렌더 확인).

## CATWALK_SEED 이슈 처리 — 시드 픽스처 문제 확정, 재핀
rnd-fox 회부대로 seed 4에서 catwalk 단언 실패. **회귀 아님**을 교차확인 후 시드만 재핀:
- 교차검증: production `window.__woodada.simulate` 훅으로 seed 0~59 스캔 → catwalk:activate+dodge가 **23개 시드에서 정상 발동**(2,3,6,8,9,13,…). 스킬 자체 정상.
- 원인: fox가 DEFAULT_IDS(9마리)에 들어가며 seed 4의 충돌 구도가 바뀌어 고양이가 더는 공격대상이 안 됨. 순수 시드 픽스처 문제 → **engine-dev 회부 불필요.**
- 조치: `CATWALK_SEED = 4 → 2` (fox 포함 로스터에서 catwalk activate+dodge가 나오는 최저 시드, frame 384). 주석에 재핀 경위 추가. 소스 로직 무수정.

## 육안 확인한 스크린샷 (tests/e2e/__screens__/)
- `race-start.png` — 로스터 9마리에 **구미호9(fox)** 정상 등장, 치비 귀여움.
- `fox-decoys-running.png` — fox 1위, "허허… (실은 나야)" + 다중 분신(주황 글로우 링) 전개. illusionClone 분신 정상.
- `fox-teleport.png` — "스르르… 퐁!" 텔레포트 소용돌이 FX 정상.
- `fox-clonehit.png` — 분신 충돌 "퐁!" 버스트(상대가 분신에 충돌) 정상.
- `fox-clonepop.png` — 분신 소멸 대형 흰 링 + 별 FX 정상.
- `race-catwalk-activate.png` (seed 2 신규) — 고양이3 catwalk 회피 버블("우다다다다!!!")+주황 링 FX 정상 캡처. fox도 로스터에 공존.

전반적으로 fox 치비는 일관되게 귀엽고(주황 몸/풍성한 9꼬리), 스킬 4단계(분신 스폰→텔레포트→충돌→팝) FX가 모두 구분되어 렌더됨.

## 별도 보고 (이번 작업 무관, 사전 존재)
- typecheck 무관 에러 4건: `tests/e2e/capture-all-characters.spec.ts:1`, `capture-arenas.spec.ts:1`, `capture-characters.spec.ts:1`(미사용 expect), `capture-characters.spec.ts:26`(Locator.selectValue 없음). fox 작업과 무관, 별도 정리 대상.

## 결론
구미호 illusionClone 추가는 CLAUDE.md §2.4 절차를 모두 충족하고 전 품질 게이트를 통과한다. 완료 보고 가능.
