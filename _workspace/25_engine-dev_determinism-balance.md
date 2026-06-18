# 25 engine-dev — 파츠모델 변경 결정론/밸런스 검증

## 작업 배경
cat/dog 파츠모델(시각 데이터) 변경에 대한 영향 0 검증.
- `src/data/partmodels/cat.ts`(파츠 shape 전면 재작성), `src/data/partmodels/dog.ts`(파츠 shape 보강)
- `src/data/characters/cat.ts`: runStyle `scamper`→`gallop`, renderScale `0.85`→`0.88`. skill.type(catwalk)·cooldownMs·params·lines 무변경.

엔진은 `progress`+`lane`만 안다. 파츠/runStyle/renderScale은 엔진이 읽지 않으므로 같은 (config+seed)는 동일 경주여야 한다.

## 1. 엔진 순수성 정적 확인
`grep -rn "renderScale|runStyle|partmodel|PartModel"` 대상 `src/engine/` → **0 매치**.
엔진은 변경된 시각 필드 중 어느 것도 import하거나 읽지 않는다. 구조적으로 누수 불가.

## 2. typecheck + test
```
npm run typecheck → tsc --noEmit 통과 (에러 0)
npm run test      → 8 파일 / 41 테스트 전부 통과
```
핵심 게이트:
- engine-determinism.test.ts (4) ✓
- skills.test.ts (8) ✓
- engine-bias.test.ts (2) ✓  (every char/slot can win, none dominates)

깨진 테스트 없음 → 파츠 변경이 엔진으로 새지 않았음.

## 3. 밸런스 재측정 (`npx vite-node scripts/balance.ts`)
`ids` 배열 확인: `['dog','cat','monkey','eagle','bear'] × 2` (5종, 22번과 동일 로스터, penguin 미포함 — 변경 없음).

| | dog | cat | monkey | eagle | bear | avg lead changes |
|---|---|---|---|---|---|---|
| before (22번) | 0.291 | 0.216 | 0.118 | 0.155 | 0.220 | 7.8 |
| after  (이번) | 0.291 | 0.216 | 0.118 | 0.155 | 0.220 | 7.8 |
| 차이 | 0 | 0 | 0 | 0 | 0 | 0 |

slot wins도 동일: `0.166 0.100 0.051 0.078 0.100 0.125 0.115 0.067 0.077 0.120`.

수치가 비트 단위로 완전히 동일. PRNG 드로 순서·서브스트림이 전혀 흔들리지 않았음.

## 결론
**파츠모델/runStyle/renderScale 변경의 엔진 영향 = 0.** 결정론 불변 유지, 밸런스 수치 100% 동일.
시각 데이터(cat.ts partmodel 전면 재작성, dog.ts 보강, runStyle scamper→gallop, renderScale 0.85→0.88)는 시뮬레이션에 새지 않음이 정적(grep)·동적(determinism test + balance) 양면으로 입증됨.

엔진 로직·params 무변경. 버그 없음. 별도 수정/합의 필요 사항 없음.
