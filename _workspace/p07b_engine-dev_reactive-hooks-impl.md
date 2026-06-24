# P07b — 반응형 스킬 훅 (onOvertaken) 구현 내역

엔진 TODO #7. 작성: engine-dev. 브랜치 `polish/reactive-hooks`. 계획서 `p07_engine-dev_reactive-hooks-plan.md` 옵션 A 그대로 구현.

## 0. 한 줄 결과
훅 프레임워크 전면 도입 없이 **`onOvertaken` 1종만** 추가. bristle(고슴도치)을 쿨다운 스캔 자발동 → 실제 추월 순간 이벤트 훅으로 완전 이관. 나머지 7스킬 무변경. typecheck 통과, 단위테스트 49개 전원 green(엔진-공정성 1/3/10랩 포함).

## 1. 바뀐 파일 (모두 src/engine/, 단 hedgehog 데이터 1개 + 테스트 1개)
- `src/engine/skills/types.ts` — `SkillReactContext`(=SkillContext + `passer`), `ReactionHandler`, 객체형 `SkillDef{tick?, onOvertaken?}`, `SkillEntry`(함수|SkillDef). `SkillRegistry`에 `getReaction(type)` 추가. `register`는 함수/객체 둘 다 수용(후방호환).
- `src/engine/skills/registry.ts` — `asDef()`로 바레 함수를 `{tick}`로 정규화. `get`→`tick`, `getReaction`→`onOvertaken` 조회.
- `src/engine/skills/bristle.ts` — `SkillHandler`(함수) → `SkillDef{ onOvertaken }`. 후보 스캔/closing 추정 로직 삭제. `ctx.passer`를 target으로 사용. 팀 제외·inert(finished/waiting/stunned) 가드는 핸들러에서 유지. shove/slow/recoil/star·catwalk dodge 분기는 그대로 재사용.
- `src/engine/RaceEngine.ts`:
  - `tryActivateSkill` → `fireSkill(self, events, passer?)`로 일반화(단일 발동 진입점). passer 없으면 tick, 있으면 reaction. **같은 쿨다운 게이트·같은 `skill:<id>` 서브스트림·같은 full/RETRY 쿨다운 부여 로직 공유**.
  - `step()`에 추월 검출 패스 추가: 자발동 루프 직후 progress 스냅샷 → advance 루프 → `fireOvertakeHooks(prev)` → updateBoxes(순서: §5 계획대로).
  - `fireOvertakeHooks()`: 신규. 추월 검출 + 안정 정렬 + 훅 발동.
- `src/data/characters/hedgehog.ts` — params 튜닝(아래 §4) + 주석 갱신("engine has no overtake-event input" → onOvertaken 훅 설명).
- `tests/unit/skills.test.ts` — 신규 가드 1케이스(아래 §6).

## 2. 훅 contract
```
SkillDef = { tick?: SkillHandler; onOvertaken?: ReactionHandler }
ReactionHandler = (ctx: SkillReactContext) => void
SkillReactContext = SkillContext + { passer: RacerState }   // passer = 나를 막 추월한 자(대표 1명)
                                                             // self   = 추월당한 자(=스킬 소유자)
```
- 등록은 함수(=tick만) 또는 객체. 기존 7스킬은 함수 그대로 → `onOvertaken` 미등록 → **호출 자체가 안 일어남**(완전 무변경).
- `SkillEvent.variant` 유니온 **불변**(bristle은 그대로 activate/hit/dodge emit). 새 phase 없음. KNOWN_SKILL_TYPES·활성 스킬 집합 불변 → schema.test/skills.test 활성집합 단언 **변경 불필요, 실제로 무변경 통과**.

## 3. 추월 검출 + 결정론 보장
- **검출**: advance 직전 `prevProgress: Map<id,number>` 스냅(자발동 후라 이번 프레임 shove도 반영). A가 B 추월 ≡ `prev[A] ≤ prev[B] && cur[A] > cur[B]`.
- **대표 passer**: 한 B를 여러 명이 동시 추월 시 cur progress가 B에 가장 가까운(=가장 앞쪽 최근접) 1명, 동률은 init 고정 `procKey` tie-break.
- **발동 순서**: 추월당한 B들을 cur progress 내림차순 + procKey tie-break로 안정 정렬 후 그 순서로 `fireSkill`(자발동 `order`와 동일 규약).
- **신규 RNG draw 0**: 검출·정렬은 procKey(init 시 고정)만 사용. `all` 배열 순서·드로 순서 비의존.
- **무한 연쇄 차단**: 검출은 프레임 경계 1회 스냅샷만. 훅 부수효과(shove)로 생긴 2차 역전은 다음 프레임에 검출, 그때도 쿨다운 게이트가 막음.
- **이중발동/RNG 더블드로 차단**: 자발동+훅이 단일 `fireSkill`로 수렴. 한 프레임에 step2에서 발동하면 `skillCooldownUntil`이 미래로 → step4에서 자동 무발동. bristle은 tick 핸들러가 없어 애초에 step2 미참여.
- **스냅샷 리베이스: 불필요.** `engine-determinism.test`는 같은 seed 자기일치만 검증(통과). 골든 스크린샷/이벤트 해시는 frame.events·progress 절대값이 바뀌므로 **렌더러 골든 재생성 필요**(아래 §7). 단위테스트 골든은 없음.

## 4. 밸런스 before/after (`npx vite-node scripts/balance.ts`)
bristle 발동이 "쿨다운마다 closing 스캔"→"실제 추월 프레임"으로 바뀌어 추월 이벤트가 더 드물어짐 → 고슴도치 recoil 횟수↓ → 승률 하락. 계획대로 **1회(실측상 2회) params 조정**으로 floor 복구.

params: `triggerChance 0.30→0.75`, `recoilBurst 0.18→0.42`, `recoilMs 500→700` (range/pushBack/slowMs/slowMul 불변). `range`는 훅이 거리 무관이라 핸들러 미사용(데이터엔 의도 문서용으로 잔존 — 제거는 balance-tuner 판단).

고슴도치 개인전 win% (homogeneous, balance 하니스):
| laps | before | after(미튜닝) | after(튜닝후) | floor/ceiling |
|---|---|---|---|---|
| 1  | 12% | — | 12% | 7%~45% ✓ |
| 3  | 13% | — | 12% | 5%~45% ✓ |
| 10 | 12% | — | 6%  | 4%~45% ✓ |

engine-bias 혼합 로스터(전체×2, 고N 실측) 고슴도치: before 9.1%(3랩)/8.0%(10랩) → after-untuned 5.7%/4.2%(둘 다 거의 floor) → **after-tuned 9.3%/6.2%**(여유 확보). laps=1은 12→15.9%로 오히려 필드가 더 균등. 누구도 ceiling(0.45) 미초과. **engine-bias 1/3/10랩 전원 green.**

> 주의: laps=10 개인전 6%는 floor(4%) 위지만 7스킬 중 최저점. 의도된 동작 변경(추월 이벤트 희소성)의 잔여 효과. floor 위라 수용, 정밀 조정은 balance-tuner 후속.

## 5. 검증 결과
1. `npm run typecheck` — ✅ 통과.
2. `npm run test` — ✅ 49/49(48 기존 + 신규 1). determinism·skills·schema·engine-bias(1/3/10랩) 전원 green. **스냅샷 리베이스 없었음**(단위 골든 부재, 같은-seed 재현성 유지).
3. balance 하니스 before/after — §4. 고슴도치 floor~ceiling 내.
4. schema.test / skills.test 활성집합 — 불변, **무변경 통과**.

## 6. 신규 테스트
`tests/unit/skills.test.ts`에 "bristle (onOvertaken hook) fires on real overtakes, deterministically, never on a teammate": 고슴도치×2 팀 로스터(seed 13)에서 (a) 두 번 시뮬한 bristle 이벤트 스트림 동일(동시 추월 순서 결정론), (b) 'hit' 1회 이상(훅 실발동), (c) 'hit' target이 절대 같은 팀 아님(팀 제외 보존).

## 7. 팀 통신
- **renderer-dev**: `SkillEvent.variant` 유니온/phase **불변** — bristle FX/말풍선/자막은 같은 activate/hit/dodge로 **그대로 작동**. 단 **발동 타이밍이 '쿨다운 자발동'→'추월당한 그 프레임'으로 정확**해짐 → 슬로우모션·글로우 트리거가 더 정확. **bristle 포함 경기는 progress 절대값이 바뀌므로 bristle 등장 골든 스크린샷 재생성 필요**(연출 코드 변경은 불필요, 캡처만).
- **content-designer**: onOvertaken은 신규 params 요구 안 함. hedgehog params만 튜닝(triggerChance/recoilBurst/recoilMs). `range` param은 이제 핸들러 미사용 — 데이터 정리 원하면 협의.
- **qa-verifier**: **결정론 영향 플래그** — bristle 포함 경기 절대 progress 변경(같은 seed 재현성·공정성은 유지). engine-bias 전원 green 확인 완료. 골든 스크린샷 재생성 + e2e 시각 재확인 권고.
- **balance-tuner**: laps=10 개인전 고슴도치 6%(floor 4% 위, 최저점). 필요시 recoil/triggerChance 미세 조정.
