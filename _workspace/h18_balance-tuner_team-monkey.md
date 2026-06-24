# h18 — balance-tuner: 팀/릴레이 원숭이 독주 완화

요청: "팀전은 무조건 원숭이가 너무 좋다." 동질 팀/릴레이에서 monkey 과함. 진단: 같은 팀 원숭이들이 바나나로 상대를 연쇄 throttle(스택).

결론 요약:
- **팀(동질) 모드는 params로 해결** — monkey 0.162 → 0.148(공정선 0.143). 더는 독주 아님.
- **릴레이는 params로 해결 불가** — 0.372 → 0.338로 소폭만 내려가고 여전히 ~2x 독주(공정선 0.167). 더 내리려면 개인전 monkey가 floor(0.1) 밑으로 빠지거나 engine-determinism 테스트가 깨짐. → **engine 안티스택 메커닉 필요(engine-dev 회부).**

## 측정 (N=3000)

기준선 주의: 팀의 동시 작업(RaceEngine·overtake·bristle·lane 등)으로 엔진이 바뀌어 이전 h04 대비 baseline이 달라짐. 아래는 현재 엔진 기준 측정.

### 개인전 (공정선 1/7 ≈ 0.143)

| 캐릭터 | baseline | after (hitStun 1350→1200) |
|---|---|---|
| 🐧 penguin | 0.159 | 0.164 |
| 🐱 cat | 0.158 | 0.159 |
| 🦅 eagle | 0.142 | 0.144 |
| 🐶 dog | 0.137 | 0.138 |
| 🐒 **monkey** | **0.139** | **0.135** |
| 🐻 bear | 0.135 | 0.127 |
| 🦔 hedgehog | 0.130 | 0.132 |

개인전 monkey는 거의 불변(0.139→0.135), 전원 floor 위·독주 없음 유지. 분포 폭 0.127–0.164.

### 팀 rank-sum (동질 2쌍, 공정선 ≈ 0.143)

| | baseline | after |
|---|---|---|
| 🐒 monkey | 0.162 | **0.148** |
| (hedgehog) | 0.185 | 0.183 |
| (bear) | 0.171 | 0.177 |
| (penguin) | 0.162 | 0.178 |
| (cat) | 0.145 | 0.146 |
| (dog) | 0.108 | 0.099 |
| (eagle) | 0.067 | 0.069 |

monkey 공정선으로 수렴 — 팀 독주 해소.

### 릴레이 (동질 3인, laps=3, 공정선 1/7 ≈ 0.167)

| | baseline | after |
|---|---|---|
| 🐒 **monkey** | **0.372** | **0.338** ← 여전히 독주 |
| eagle | 0.127 | 0.135 |
| dog | 0.105 | 0.115 |
| cat | 0.113 | 0.118 |
| penguin | 0.098 | 0.098 |
| bear | 0.095 | 0.103 |
| hedgehog | 0.090 | 0.093 |

릴레이 monkey는 params로 소폭만 내려감(2.2x → 2.0x). 미해결.

## 변경한 param (전 → 후)

**monkey** (banana) — `src/data/characters/monkey.ts`:
- hitStunMs **1350 → 1200** (스턴 1줄만 단축)
- cooldownMs, dodgeChance, target, range 불변.

(`range`는 banana 핸들러가 실제로 읽지 않는 사실상 no-op 파라미터라 레버에서 제외.)

## params 한계 입증 (왜 cooldown은 못 쓰는가)

cooldown까지 늘려 더 강하게 누르면:

| hitStun / cd | 개인 monkey | 릴레이 monkey | determinism 테스트 |
|---|---|---|---|
| 1350 / [2100,3800] (base) | 0.139 | 0.372 | green |
| **1200 / [2100,3800] (채택)** | **0.135** | **0.338** | **green** |
| 1300 / [2300,4000] | 0.126 | 0.342 | **FAIL** |
| 1200 / [2400,4000] | 0.116 | 0.322 | (bias green이나 개인 floor 근접) |
| 1050 / [2500,4200] | 0.107 | 0.265 | (개인 monkey floor 턱걸이) |

- cooldown을 건드리면 monkey가 든 로스터의 경주 길이가 바뀌어 `engine-determinism > more laps make a proportionally longer race`(3랩 > 1랩×2.4 단언)가 깨짐. 2508 vs 2527.2로 0.7% 미달.
- 릴레이를 공정선(0.167)까지 내리려면 개인전 monkey가 floor(0.1) 밑으로 내려가야 함(추세상 릴레이 0.265 ↔ 개인 0.107). **개인 공정성·floor 게이트와 양립 불가.**

## 안티스택 메커닉 권고 (engine-dev 영역 — 직접 구현 안 함)

문제 본질은 "여러 원숭이의 연쇄 스턴 스택". 현 banana 핸들러는 이미 `phase==='stunned'` 표적을 후보에서 제외(동시 중첩 스턴은 방지)하나, **스턴이 풀린 직후 다른 팀원이 곧바로 재스턴**하는 순차 스택은 막지 못함 — 릴레이(3랩 누적)에서 이게 압도의 원천.

권고: banana hit 후 **짧은 스턴 면역창**(예: 해제 후 N ms 동안 같은 표적 banana 면역) 또는 **표적당 단위시간 banana 피격 횟수 상한**. 이러면 릴레이/팀 누적 스택만 깎이고 개인전(원숭이 1명이라 애초에 순차 재스턴 빈도 낮음)은 거의 영향 없음 — 즉 params로 풀리지 않던 "팀↓·개인유지" 동시 달성이 가능해짐.

## 검증

- `npx vitest run` → **43/43 통과** (engine-bias per-char floor·slot floor·no-runaway 포함, engine-determinism 포함).
- `npm run typecheck` → clean.
- 런어웨이 건강성 유지(개인전 lead changes 9.9, winner led 0.508, 독주 없음).
- penguin-stack 혼합(A_pengStack 0.368)은 0.45 미만, 새 독주 아님.
