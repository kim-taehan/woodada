# 17 · qa-verifier · 신규 캐스트(고양이·독수리, catwalk·snatch) 최종 검증 + 결과화면 점검

검증 범위: content-designer(14)·engine-dev(15)·renderer-dev(16) 변경 위 최종 품질게이트 + 경계면 교차검증 + 결과화면 시상대 가림 점검.

## 품질 게이트 (전부 PASS)
| 게이트 | 결과 |
|---|---|
| 1. `npm run typecheck` | **PASS** (오류 0) |
| 2. `npm run test` (Vitest) | **PASS 36/36** (8 파일) |
| 3. `npx playwright test --project=desktop` | **PASS 9/9** (45.6s) |
| 4. 스크린샷 육안 | **PASS** (아래 코멘트) |

### Vitest 세부 (전부 통과)
- skills.test.ts 7/7 — 신규: catwalk 면역(stunned 0)·snatch dropBack·snatch가 면역cat 놓침(dodge)·신로스터 결정론. 활성집합 `[banana,catwalk,roar,snatch,zoomies]`.
- schema 2/2(KNOWN_SKILL_TYPES=새 5종, catalog `[bear,cat,dog,eagle,monkey]`)·engine-bias 2/2(새 5종 N=1200, 모두 이김·독주 없음)·determinism 4/4·scoring 5/5·relay 6/6·overtake 4/4·prng 6/6.

### 갱신한 테스트/파일 (qa 인계 항목)
- `tests/e2e/race-visual.spec.ts:26` 캡처 이벤트 키 `nap:activate/brace:activate` → `catwalk:activate/snatch:activate/snatch:hit`.
- `tests/e2e/race-visual.spec.ts:42` 시그니처 단언 `nap:activate` → `catwalk:activate`.
  - 사전 실측: 기본 로스터 DEFAULT_IDS=`[bear,dog,cat,monkey,eagle,bear]` + seed 7이 `zoomies/catwalk/banana(activate,hit,dodge)/snatch(activate,hit,dodge)/roar:activate`를 모두 발화 → `toHaveProperty` 안전. e2e 실행 confirm.
- 골든 스크린샷 새 로스터로 재캡처(재기준): race-start/mid/finish/busiest/zoomies/catwalk/banana*/snatch*/roar/lastlap/reduced-motion + newcast 3장.
- **스테일 골든 2장 삭제**: `race-nap-activate.png`·`race-brace-activate.png`(제거된 nap/brace 잔재, 옛 11:19 캡처). 그 외 nap/brace 스크린샷 0건 확인.

## 경계면 교차검증 (정합성·실측)

### 데이터↔엔진
- `skills/index.ts`: cat→`catwalk`, eagle→`snatch` 등록 확인(zoomies/banana/roar 유지, nap/brace 해제).
- `catwalk.ts`: `params.immuneMs`(→immuneUntil)·`params.slipBoost`(→burst) 실제로 읽음. `snatch.ts`: `params.range`·`params.dropBack` 읽음.
- **잔재 grep**: src/scripts/tests에 `rabbit`/`elephant` 캐릭터·`nap`/`brace` 활성 핸들러 **0건**. 남은 매치는 (a) 주석 일부, (b) 의도적 legacy(아래 고아), (c) 갱신 완료한 테스트뿐.

### 스킬 상호작용 실측 (엔진 직접 구동, 80 seeds, cat×2 필드)
- **catwalk 면역**: 관측 면역프레임 32,836 / 면역 중 stunned **0** → banana·roar·snatch·item 모두 cat 못 건드림.
- **모든 방해원이 면역cat에 dodge 발행**: `banana:dodge`=44, `roar:dodge`=47, `snatch:dodge`=13 (모두 targetId=cat, line 없음).
- **snatch dropBack**: hit 103건, 단일프레임 최대 후퇴 = **90.0** (params.dropBack=90 정확히 일치), progress≥0.
- **snatch가 면역cat 놓침**: 면역 표적 hit 0, cat 대상 dodge 13 → 면역창엔 hit 대신 dodge.

### 엔진↔렌더러
- `RaceRenderer.ts`: `catwalk:activate`·`snatch:activate/hit/dodge` case 존재, glow 지속 `e.type==='catwalk'`로 분기.
- **면역 dodge 연결 확인**(중요): banana/roar/snatch가 면역cat을 칠 때 발행하는 `<attacker>:dodge`(targetId=cat, line 없음)를 렌더러가 `charIdById.get(targetId)==='cat'`로 감지해 **cat 위에 sparkle+0.8s glow** 표시(RaceRenderer.ts:301). 골든(catwalk·roar:dodge)에서 cat 반짝 육안 확인.
  - **단, cat의 lines.dodge("냐옹…") 말풍선은 안 뜸**: 면역 dodge 이벤트엔 line이 없어 SpeechBubble(`if(e.line)`, :222)이 스폰 안 됨. 자막(commentary)도 `eventLine(e.type,...)`로 **공격자 키**(`banana:dodge` 등)를 사용 → cat 시점 "냐옹" 자막/말풍선은 미표시. `catwalk:dodge` commentary 풀은 정의돼 있으나 엔진이 `catwalk:dodge`를 emit하지 않아 미도달.
  - **판정**: 버그 아님 — 15·16 인계에 명시된 의도적 설계(자막 더블업 방지). 만약 "냐옹" 자막을 cat 시점으로 띄우고 싶으면 engine이 선택적 `catwalk:dodge`(racerId=cat, line=lines.dodge) 1줄 추가하면 commentary 풀이 이미 연결됨(선택사항, 엔진/셸 영역).

### 밸런스 (`npx vite-node scripts/balance.ts`, N=3000)
```
win rate: dog 0.283  cat 0.275  monkey 0.112  eagle 0.122  bear 0.208
slot wins: 0.162 0.131 0.051 0.062 0.096 | 0.121 0.143 0.061 0.060 0.112
avg lead changes/race: 7.7
```
- engine-dev 보고치(.283/.275/.112/.122/.208)와 **완전 일치**.
- 독주 없음(최고 dog 0.283 ≪ 0.45) ✅ / 약체 없음(monkey 0.112 > floor 0.1) ✅.
- monkey가 구조적 최약체 확인(단일표적 스턴·자기전진 없음, floor 여유 ≈0.012로 가장 작음). 추후 monkey 역할 강화 시 재조율 권장.

## 신캐 스크린샷 육안
- **golden-cat-catwalk**: 고양이 치비(둥근 회색 타비·삼각귀+핑크 내부·수염·도도눈) catwalk 발동 — 골든 헤일로 + ✨★ 슬립 트레일 + "캣워크~ 😼" 말풍선 + 자막. 베이비 스키마 OK, 매우 귀여움.
- **golden-eagle-fly**: 독수리 치비(크림 얼굴·진한 캡·큰 눈·후크 부리·날개 펼침·발톱 접힘) 라인 위로 떠 호버. 지상 강아지와 명확히 구분.
- **golden-snatch-hit**: 독수리 급강하 "콱! 낚아챈다!" + 표적(원숭이)에 ★ 별버스트 + 랭크 스왑 + 자막 "독수리1 공중납치 성공!". snatch 가독성 충분.
- **race-mid(회귀)**: 6인 새 로스터 풀필드, 동시 다중 스킬(우다다 zoomies + 콱 snatch), 랭크스트립·자막 정상. 독수리 호버 렌더 OK.
- **race-start/result(회귀)**: 정상.

## ★ 결과화면 시상대 가림 점검 (사용자 요청)
**개인전 결과 화면(result.png)에서 시상대는 개인전 순위/성적을 가리지 않는다.** 가림 없음.
- 구조: 시상대(1/2/3 단상 + 치비)는 **Pixi 캔버스**에 렌더, 순위/성적 리스트는 **별도 DOM 오버레이**(`ResultScreen.ts`의 `.result-card` > `.rank-list`)로 캔버스 위에 깔림.
- CSS(`src/shell/styles.css:102-108`): `.result-overlay{align-items:flex-end}`(하단 정렬) + `.result-card{background:var(--card); max-height:56%; overflow:auto; box-shadow:...}` — 불투명 배경·하단 고정·자체 스크롤.
- 결과: 시상대는 카드 뒤(상단), 순위카드는 앞(하단)·불투명 → 겹쳐도 순위 텍스트가 가려지지 않음. 참가자 多여도 56% 높이 내 스크롤되어 넘치지 않음.
- 스크린샷 확인: result.png에 "결과 / 1등🏆영희 / 1 영희 커피 쏘기 / 2 철수 / 3 민수 / [다시하기][새 게임]" 전부 또렷. **수정 불필요**.

## 잔여 고아 (목록만 보고, 삭제 안 함 — 엔진/셸 영역·사전 존재 코드)
- `src/engine/types.ts:46` `RacerPhase` 의 `'napping'` — 엔진 미생성(legacy 주석). 참조처 `PartsCharacter.ts:261`(napping 시 lean-back).
- `src/engine/types.ts:104` `SkillEvent.variant` 의 `'wake'` — 엔진 미발행. 참조처 `shell/RaceController.ts:58`(슬로모 트리거 조건에 `||'wake'` 포함).
- `'hop'` runStyle — 토끼 제거로 미사용. `PartsCharacter.ts:123/129/203/263`에 분기 잔존.
- 위 3종은 타입 유니온/렌더 분기로만 남아 동작 무해(데드 분기). 정리 원하면 renderer-dev(napping/hop 분기, PartsCharacter)·engine-dev(types 유니온)·shell-dev(RaceController wake) 협의로 일괄 제거 가능. **현 상태로 회귀/버그 없음.**

## 결론
4개 게이트 전부 PASS(typecheck 0 / Vitest 36 / e2e 9 / 육안). 데이터↔엔진↔렌더러 경계면 정합, 스킬 상호작용·밸런스 실측 일치, 결과화면 시상대 가림 없음. 로스터 교체(토끼·코끼리 → 고양이·독수리, catwalk·snatch) **최종 통과**.
