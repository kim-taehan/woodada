# e01 engine-dev — divebomb 최소 사거리(minRange)

## 요구
독수리 박치기(divebomb)가 너무 가까운 적에겐 발동 안 하게. 다이브 활주 공간 필요(게임성/연출).

## 변경점
1. `src/engine/skills/divebomb.ts`
   - 후보 필터에 최소 사거리 조건 추가: `r.progress - self.progress >= minRange` (기존 상한 `<= range`와 함께).
     → `minRange`~`range` 구간의 적만 표적. 더 가까운 적은 건너뛰고 그 너머 유효 표적을 노림. 구간에 아무도 없으면 후보 0 → 기존 hold(미발동, emit 0, rng.bool 안 굴림) 그대로.
   - `const minRange = Number(params.minRange ?? 0);` — 데이터 주도, 미설정 시 0 폴백(기존/타 캐릭터 중립, back-compat).
   - 필터 조건 1개만 추가 — **신규 rng draw 없음**, 드로 순서 불변, 결정론·서브스트림 유지. 팀원/완주/대기 제외, 1등 미발동 등 기존 의미 보존.

2. `src/data/characters/eagle.ts`
   - divebomb params에 `minRange: 16` 추가 (range 70 대비 runway 갭 유지).
   - 시작 제안값 22로 구현 → balance 결과 laps=10에서 floor(18%) 아래로 떨어져(16.5%), 1회 튜닝으로 **16** 채택. 16에서 1/3/10랩 모두 floor 위.

3. `tests/unit/skills.test.ts` (회귀 수정 — 잠복 테스트 가정 보정)
   - `catwalk dodge` 테스트는 roar/divebomb의 dodge 이벤트가 항상 catwalk dodge라고 가정했으나, divebomb에는 **⭐ star deflect** 분기(`starUntil > frame` → variant 'dodge')도 존재. minRange로 표적이 이동하며 seed=17 frame=415에서 star 보유(미-dodge윈도우) 고양이를 divebomb → star deflect dodge가 떠서 `dodgeUntil > frame` 단언 실패.
   - 수정: dodge 대상 고양이가 활성 star(`starUntil > f.frame`)면 catwalk 단언에서 제외(`continue`). star deflect는 catwalk 윈도우와 무관하게 회피 가능 — 기존 엔진 동작을 반영한 최소 보정. (engine 로직 변경 아님.)

## balance (개인전, before → after)
독수리 1등 점유율(individual). before = minRange 없음, after = minRange=16.

| laps | before | after(minRange=16) |
|---|---|---|
| 1  | 19.3% | 18.4% |
| 3  | 20.3% | 20.7% |
| 10 | 20.3% | 20.0% |

- floor 0.18 / ceiling 0.45 — 전 구간 통과. minRange로 발동이 살짝 줄지만 약화는 미미(가까운 적 대신 더 앞 표적을 노려 가치 유지).
- 참고: minRange=22는 laps=10에서 16.5%로 floor 미달 → 16으로 1회 조정.
- 팀/릴레이 모드는 divebomb 자체가 비중 낮아(team 0.66~0.73×, relay 1.1~1.2×) 영향 경미.

## 검증
- `npm run typecheck` clean.
- `npm run test` **49/49** (engine-bias 1/3/10랩 green, skills 포함).
- schema.test 영향 없음 확인(params 자유 레코드, KNOWN_SKILL_TYPES 변동 없음 — divebomb type 유지).

## 영역 준수
- 변경: `src/engine/skills/divebomb.ts`, `src/data/characters/eagle.ts`, `tests/unit/skills.test.ts`.
- `src/renderer/*`(RaceRenderer.ts, FxLayer.ts)는 renderer-dev 작업 — 미접촉.

## 통지
- renderer-dev: SkillEvent.variant/phase **신규 추가 없음**. 발동 빈도만 소폭 감소(minRange band) — 연출 변경 불필요.
- qa-verifier: 결정론 영향 — 필터 추가로 동일 seed에서 divebomb 표적/발동 타이밍이 바뀜(드로 순서는 불변). 골든 스크린샷의 divebomb 캡처 프레임이 달라질 수 있어 e2e 재검증 권장.
