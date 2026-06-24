# h02 — engine-dev: 고슴도치 가시 밀치기 (bristle) 핸들러

## 최종 스킬 type 이름

**`bristle`** (변경 없음 — 컨셉에 잘 맞고 content-designer가 이미 이 이름으로 data 작성).

## 바뀐 파일

- **신설** `src/engine/skills/bristle.ts` — 핸들러.
- **수정** `src/engine/skills/index.ts` — `import { bristleHandler }` + `r.register('bristle', bristleHandler)`.

(content-designer가 `src/data/characters/hedgehog.ts` 작성 — 내 잠정 계약대로 키 일치 확인.)

## 탐지 조건 (반응형 카운터를 쿨다운 루프로 재구성)

엔진엔 "추월 이벤트" 입력이 없으므로 발동 시점에 추격자를 재구성:
- `r.id !== self.id`, 팀원 아님, phase가 finished/waiting/stunned 아님
- **바로 뒤**: `0 < self.progress - r.progress <= range`
- **근접 레인**: `Math.abs(r.lane - self.lane) <= OVERTAKE.laneNear` (0.16, `overtake.ts` 상수 직접 사용 — laneBand를 data param으로 빼지 않음. 팀리드 params 목록에 laneBand 없었고 추월 모델과 일관성 위해 엔진 상수 채택)
- **closing**: `r.speed > self.speed`
- 가장 가까운(progress 차 최소) 1명. tie-break는 id 안정 정렬(**RNG 미사용**).

## 발동 메커니즘 (divebomb hold 패턴 재사용 + 실패 시도 hold)

이벤트 0건 emit return = 엔진이 'declined to fire' → RETRY_COOLDOWN(200ms)만 걸고 재시도:
1. 추격자 없음 → **무 emit return** (선두/뒤가 빈 경우 헛발동 안 함).
2. 추격자 있으나 `rng.bool(triggerChance)` 실패 → **무 emit return** (쿨다운 안 태우고 곧 재시도 = "이번 추월은 가시 사이로 빠져나감" 손맛).
- **결정론**: 추격자가 있을 때만 `rng.bool`을 굴림 → 뒤가 비어 여러 프레임 지나도 서브스트림 draw 순서 불변. 서브스트림 규칙 준수.

## 효과 (성공)

`ctx.emit({variant:'activate', line})` 후 (divebomb과 일관):
- ⭐무적(`target.skill.starUntil > frame`) → `dodge` emit, 효과 없음.
- catwalk 회피(`ctx.tryDodge(target)`) → `dodge` emit, 효과 없음.
- 그 외:
  - `target.progress = Math.max(0, target.progress - pushBack)` (뒤로 밀침, 음수 클램프)
  - `target.skill.slowUntil = frame + slowMs/DT_MS`, `target.skill.slowMul = slowMul` (RaceEngine.ts:345가 `slowUntil > frame`일 때 `speed *= slowMul` 적용 — lightning 아이템과 동일 메커니즘 재사용)
  - `ctx.emit({variant:'hit', targetId: target.id})`
- **가시 반동 자기 전진**(아래 "UPDATE: 가시 반동" 참조 — 성공 분기에서만 본인 소폭 burst).
- 새 variant 안 만듦 — activate/hit/dodge 재사용.

## 합의 params (content-designer가 채택)

`{ range: 40, triggerChance: 0.45, pushBack: 10, slowMs: 600, slowMul: 0.6, recoilBurst: 0.4, recoilMs: 500 }`, `cooldownMs: [1500, 2500]`.
(content-designer 최초 추정 range 6 / pushBack 2.0은 progress 절대거리·trackLength 1000 기준 너무 작아 권장값으로 상향 조정함. recoilBurst/recoilMs는 가시 반동용으로 추가.)

## 렌더러 참조용 이벤트 계약 (renderer-dev)

type `bristle`, variant 3종만:
- `bristle:activate` — 고슴도치가 가시를 세움(FX/말풍선). racerId=고슴도치.
- `bristle:hit` — `targetId`=뒤에서 밀쳐진 추격자. 그 추격자가 뒤로 튕기고 감속됨(progress 감소 + slow). 고슴도치 본인은 자리 유지.
- `bristle:dodge` — `targetId`=가시를 회피한 추격자(catwalk 도지 or ⭐무적). 효과 없음.
- self-botch 없음(divebomb과 달리 자폭 케이스 없음).

## 검증 (`npm run test`)

- `npm run typecheck`: 통과.
- 핸들러 자체 동작: skills.test "all character skills activate"에서 활성 집합에 `bristle` 등장 = **실제 경주에서 발동 확인**.
- 결정론: engine-determinism 통과(green).

### 현재 실패 5건 — 분류

A) 테스트 픽스처 미갱신 (qa-verifier 담당, 엔진 로직 무관):
- `schema.test.ts` ×2: KNOWN_SKILL_TYPES에 `'bristle'` 추가 + 활성 catalog 7캐릭터(hedgehog) 반영 필요.
- `skills.test.ts` "all skills activate": 기대 활성 집합에 `'bristle'` 추가 필요.

B) **밸런스 (balance-tuner 영역 — 엔진 로직 정상, 수치 문제)**:
- `engine-bias` "every character can win": **고슴도치 승률 0.041 < floor 0.1**. 순수 방어라 본인이 전진을 못 함 — 추격자만 늦출 뿐. 데이터로 추가되니 게이트 미달.
- `engine-bias` "every start slot can win": slot floor `25 > 25.71` 근소 미달 — 7캐릭터 로스터 재분배 여파.

## 권고

- 요구된 엔진 핸들러는 완성·정확·결정론적. 새 variant 없음.
- A는 qa-verifier가 known-list/활성집합 갱신.
- B는 balance-tuner가 `hedgehog.ts`의 `skill.params` 튜닝으로 해결 권장(예: triggerChance↑, pushBack↑, slowMul↓, cooldown↓). 다만 순수 방어 컨셉상 단독으론 floor 0.1을 넘기 어려울 수 있어, "본인 소폭 전진" 같은 메커닉 추가는 팀리드 결정 필요(컨셉 변경). 엔진에서 임의 과튜닝 안 함.

---

## UPDATE: 가시 반동(spine recoil) 자기 전진 추가 — 밸런스 floor 해결

팀리드 결정: 순수 방어로는 floor 미달이라 **성공적으로 밀쳤을 때만** 본인 소폭 전진을 추가(컨셉=방어 유지, 추월 막을 때만 이득).

### 변경 (`src/engine/skills/bristle.ts`)
성공 분기(hit emit 직전)에 divebomb 성공과 동일 메커니즘으로 추가:
```
self.skill.burst = Number(params.recoilBurst);
self.skill.effectUntil = frame + Math.round(Number(params.recoilMs) / DT_MS);
self.phase = 'straying';
```
- **성공 밀치기에서만** — dodge(catwalk)/⭐무적/무발동(추격자 없음·triggerChance 실패) 분기에선 반동 없음.
- 새 params: `recoilBurst`, `recoilMs` (content-designer가 hedgehog.ts에 추가, 값 0.4 / 500). 핸들러 키 일치 확인.
- 결정론 영향 없음(rng 추가 호출 없음, 기존 burst 메커니즘 재사용). 새 variant 없음.
- 헤더 주석의 "Pure defense — no forward burst" → "spine recoil only on a successful shove"로 갱신.

### 밸런스 재측정 (`npx vite-node scripts/balance.ts`, N=3000)
INDIVIDUAL win rate (전 7종 수렴):
```
dog 0.162  cat 0.152  monkey 0.139  eagle 0.136  bear 0.111  penguin 0.133  hedgehog 0.166
```
- **고슴도치 0.041 → 0.166** (floor 0.1 통과, 오히려 상위권). 1/7≈0.143 기준 전 캐릭터 0.111~0.166 = 약 ±3%p 이내, 팀리드 ±5%p 목표 안.
- eagle도 0.136으로 회복(로스터 재분배). lead changes 10.1, winner led 0.482, peak gap 0.072laps — 독주 없음 유지.

### 검증
- `npm run typecheck`: 통과.
- `npx vitest run`: **43/43 통과** — engine-bias 2건(every char / every slot floor) 포함 전부 green. 픽스처 3건도 이미 통과 상태.

### 잔여
- 개인전은 수렴 완료. TEAM rank-sum에서 penguin 0.066 / eagle 0.088 / hedgehog 0.096이 다소 낮음(릴레이/팀 모드는 별도 분포) — balance-tuner가 7종 팀/릴레이 재수렴 시 살필 영역. 엔진 로직 무관.
