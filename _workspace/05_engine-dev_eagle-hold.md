# 05 — engine-dev: 독수리 선두 시 스킬 보류 (divebomb hold)

## 변경 내용

독수리 박치기(divebomb) 발동 규칙: **타깃 없으면(선두이거나 앞주자가 range 밖) 미발동 + 보류**.

### 바뀐 라인

**`src/engine/skills/divebomb.ts`** (line 43~50 영역):
- 기존: `ctx.emit({ variant:'activate' })` 를 타깃 검사 *전*에 무조건 호출 → 타깃 없어도 'activate' 1건 emit → 엔진이 '발동함'으로 보고 **전체 쿨다운** 소모 + FX/말풍선 헛발동.
- 변경: `const target = candidates[0];` 먼저 잡고, `if (!target) return;` (아무 이벤트도 emit 안 함) → 그 뒤에 `ctx.emit({ variant:'activate', line: ctx.lines.skill })`.
- 근거: `RaceEngine.ts:292-297` — 핸들러가 이벤트 0건 emit하면 `activated=false` → 전체 쿨다운 대신 `RETRY_COOLDOWN_MS`(200ms)만 걸고 곧 재시도. 즉 타깃 없으면 자동으로 "미발동 + 보류"가 됨.
- dodge/hit 케이스는 기존대로 activate 포함해 emit (변경 없음).

### 결정론/서브스트림

- 타깃 없으면 `return` 하므로 `rng.bool(...)` 도박도 안 굴림 → 서브스트림 draw 순서가 기존 whiff와 동일하게 유지. 결정론 영향 없음.
- 주석을 "empty whiff" → "no target ahead in range (e.g. leading) → hold, no activation; engine retries soon"로 갱신.

### 테스트 코멘트

`tests/unit/skills.test.ts` divebomb 케이스: hard assertion은 'hit' 이벤트에만 걸려 있고 'no-target에도 activate emit'을 단언하는 부분은 없었음 → 단언 변경 불필요. 단 설명 주석이 "→ 'activate' only (whiff)"로 stale해서 새 동작("holds, emits nothing")으로 갱신.

## 검증

- `npm run typecheck`: 통과
- `npx vitest run`: **43/43 통과** — engine-determinism, skills, **engine-bias(독수리 floor>0.1 게이트 포함)** 모두 green.

## 밸런스 재측정 (`npx vite-node scripts/balance.ts`, N=3000, trackLength 1000 / laps 1)

`ROSTER = defaultCharacterIds` (dog cat monkey eagle bear penguin) — 현재 로스터 반영 확인.

INDIVIDUAL win rate:
```
dog 0.238  cat 0.238  monkey 0.128  eagle 0.099  bear 0.131  penguin 0.166
avg lead changes/race 9.7 · winner led 0.501 · peak gap 0.072laps · finish gap 37.2f
```

- 독수리: **0.099** (직전 0.0983 → 거의 변동 없음).
- 즉 hold 변경은 "선두 시 헛발동/쿨다운 낭비 제거 + 스킬을 타깃 생길 때까지 장전 유지"라는 **의도한 동작 교정**은 했으나, 승률 자체는 거의 안 움직임. 독수리의 낮은 승률 원인은 헛발동이 아니라 **50/50 자폭 리스크**(selfRiskChance 0.5)이기 때문으로 보임.
- engine-bias 게이트(>0.1, N과 config 다름)는 통과하지만, N=3000 하니스 기준으론 0.099로 floor 0.1 바로 아래에서 정체.

## 권고

- 요구된 엔진 로직 변경(보류)은 완료·정확·검증됨. 결정론/서브스트림 불변.
- 독수리를 floor 0.1 위로 확실히 올리려면 `skill.params` 튜닝(예: selfRiskChance 0.5 → 0.4, 또는 diveBurst/diveBurstMs 상향)이 필요 — 이는 **balance-tuner 영역**. 엔진에서 임의 과튜닝하지 않고 보고만 함.

## 다른 영역 영향

- 렌더러/콘텐츠: 이벤트 계약·variant 불변(activate/hit/dodge). 선두 시엔 divebomb 이벤트가 아예 emit 안 되므로 FX/자막도 자연히 안 뜸 — renderer-dev 추가 작업 불필요.
