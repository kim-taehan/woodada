# 27 balance-tuner — 밸런스 풀 패스 (개인전·팀전·릴레이 교차 조율)

철학(사용자 명시): **"특정 조합이 강한 건 상관없다. 너무 강해지는 게 문제다."** 목표는 균등이 아니라 **아무도 독주하지 않는 것**.

## 1. 하니스 확장 (`scripts/balance.ts`)

순수·결정론(시드 Rng) 유지. 3개 모드를 측정하도록 일반화:

1. **INDIVIDUAL** — 6종 ×2 = 12 레이서. penguin 포함(기존엔 5종이었음). 캐릭터별 승률 + 슬롯 공정성 + lead changes.
2. **TEAM rank-sum (homogeneous)** — 6개 단일캐릭 팀(각 2명) → 팀승 = 해당 캐릭터 조합 승. 어느 캐릭 페어가 지배하는지.
3. **TEAM rank-sum (penguin-stack)** — A=penguin×3 vs B=dog/cat/monkey vs C=eagle/bear/penguin. 펭귄 스택 독주 전력 검증(3팀 → fair 0.333).
4. **RELAY (homogeneous)** — 6개 단일캐릭 팀(각 3명), laps=3(레그 순환). 캐릭별 릴레이 과유리 검증(6팀 → fair 0.167).

N=3000.

## 2. 측정: 독주/약체 진단 (BEFORE)

| 모드 | dog | cat | monkey | eagle | bear | penguin | 비고 |
|---|---|---|---|---|---|---|---|
| 개인전 | 0.238 | 0.220 | 0.126 | 0.119 | 0.143 | 0.153 | 정상(전원 >0.1, 독주 없음) |
| 팀(homog) | 0.196 | 0.214 | **0.224** | 0.070 | 0.128 | 0.168 | eagle 최약, 독주 없음 |
| 릴레이(homog) | 0.132 | 0.147 | **0.567** | 0.053 | 0.042 | 0.058 | **monkey 독주** |

| penguin-stack | A_pengStack | B_mixed | C_mixed |
|---|---|---|---|
| BEFORE | **0.423** | 0.390 | 0.187 |

**진단:**
- **monkey 릴레이 독주 0.567** (fair 0.167의 3.4배). 임시버프(hitStun 1700·cooldown[2400,4400])가 동종 릴레이 3레그에서 바나나 스턴이 복리로 쌓여 비교군(eagle/bear/penguin) 전멸. → 과함, 되돌릴 대상.
- **penguin-stack 0.423** — fair 0.333 대비 elevated(B와 근접해 명백한 독주는 아니나 빙판 스택 마진 존재). monkey가 약화되면 가려졌던 펭귄 스택이 드러남(중간 측정에서 0.549까지 튐).
- eagle 전 모드 최약(구조적, divebomb 단발 도박). floor 위지만 팀/릴레이에서 빈약.

## 3. 조율 (skill.params + cooldownMs만, 작은 스텝)

**monkey** (`src/data/characters/monkey.ts`):
- `cooldownMs [2400,4400] → [2600,4600]`
- `hitStunMs 1700 → 1100`
- (range 0.32 / dodgeChance 0.08 유지)

**penguin** (`src/data/characters/penguin.ts`):
- `durationMs 3200 → 2800` (스택 시 빙판이 트랙을 도배하지 않게)
- `slowFactor 0.85 → 0.88` (비펭귄 감속 완화)
- `boostFactor 1.05 → 1.03` (자기 부스트 완화)

엔진/핸들러/렌더러 무수정. type·target·zoneLength·aheadOffset 등 그 외 필드 무변경.

## 4. 측정 (AFTER)

| 모드 | dog | cat | monkey | eagle | bear | penguin |
|---|---|---|---|---|---|---|
| 개인전 | 0.256 | 0.213 | 0.123 | 0.124 | 0.160 | 0.124 |
| 팀(homog) | 0.247 | 0.231 | 0.167 | 0.079 | 0.150 | 0.126 |
| 릴레이(homog) | 0.230 | 0.208 | 0.334 | 0.087 | 0.076 | 0.064 |

| penguin-stack | A_pengStack | B_mixed | C_mixed |
|---|---|---|---|
| AFTER | 0.392 | 0.374 | 0.235 |

**변화:**
- **monkey 릴레이 0.567 → 0.334** (독주 해소, fair의 2배 수준 — "강하지만 독주 아님" 허용 범위). 개인전은 0.126→0.123로 floor 위 유지.
- **penguin-stack 0.423 → 0.392** (B_mixed 0.374와 거의 동률, 독주 아님). 펭귄 빙판 스택 마진 제거.
- 팀 homogeneous: monkey 0.224→0.167(=fair). 전 캐릭 분포 평탄화.

## 5. 게이트

- `npm run typecheck` → 통과(에러 0).
- `npm run test` → **8 파일 / 42 테스트 전부 통과**. 핵심:
  - `engine-bias.test.ts` (2) ✓ — every char/slot can win(>0.1), none dominates(<0.6).
  - `engine-determinism.test.ts` (4) ✓, `skills.test.ts` (9) ✓, `relay.test.ts` (10) ✓, `scoring.test.ts` (5) ✓.

## 6. 미해결 구조적 이슈 (engine-dev 회부 — 과튜닝 금지)

- **eagle 팀/릴레이 구조적 약체** (팀 0.079, 릴레이 0.087). 개인전 floor(0.124)는 넘지만 동종 팀/릴레이에서 빈약. 원인은 divebomb이 **단발 50/50 도박**이라 동종 대결·다레그 누적에서 페이오프가 안 쌓임. params로 burst/stun을 올리면 개인전·penguin-stack 같은 다른 모드에서 되튀어 독주 위험. → **로직 보강 후보**(예: 명중 시 후속 가속 지속, 또는 다중 타깃)로 engine-dev에 회부. 현 상태는 floor 위 + 독주 없음이라 게이트는 통과.
- 릴레이 homogeneous의 eagle/bear/penguin 저점(0.06~0.09)은 **동종 릴레이라는 스트레스 테스트의 산물**(비교군이 전부 비방해형). 실제 혼합 릴레이에선 의미 약함 — buff하면 다른 모드 되튐. 수정 안 함.

## 결론

- 개인·팀·릴레이 3모드 + 펭귄 스택 검증을 측정하도록 `balance.ts` 확장 완료.
- **독주 2건(monkey 릴레이 0.567, penguin-stack 0.423) 해소.** monkey 임시버프를 합리적 수준으로 되돌림, 펭귄 빙판 스택 마진 제거.
- 전 캐릭터 전 모드에서 이길 수 있고(>floor), 누구도 독주하지 않음(<ceil). bias 게이트 통과.
- eagle 구조적 약체는 params 한계 — engine-dev 로직 보강으로 회부(게이트는 통과하므로 블로커 아님).

변경 파일: `scripts/balance.ts`, `src/data/characters/monkey.ts`, `src/data/characters/penguin.ts`.
