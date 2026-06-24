# h36 — engine-dev: 엔진 튜닝 상수 중앙화 (#8, 동작 보존)

브랜치: `polish/tuning-central`. **동작 보존 리팩토링** — 값 전부 비트 동일, 구조만 정리.

## 만든 모듈

`src/engine/tuning.ts` (신설): 엔진 튜닝 노브 단일 소스. 순수 데이터(DOM/Pixi/RNG 없음).

## 옮긴 상수 (값 불변)

| 상수 | 원래 위치 | 값 |
|---|---|---|
| `SPEED_JITTER` | RaceEngine.ts | 0.08 |
| `RETRY_COOLDOWN_MS` | RaceEngine.ts | 200 |
| `CATCHUP` {behindGain 2.6, aheadDrag 2.2, maxBoost 1.2, minBoost 0.8, deadZone 0.008} | RaceEngine.ts | 동일 |
| `BASE_SPEED` {min 1.3, max 1.5} | RaceEngine.ts (인라인 `r.range(1.3,1.5)`) | 동일 |
| `HOME_LANE` {lo 0.1, span 0.8, exp 1.6, clampMin 0.08, clampMax 0.92, jitter 0.05} | RaceEngine.ts (인라인 리터럴) | 동일 |
| `OVERTAKE` {nearAhead 4.0, laneNear 0.16, laneStep 0.3, laneDrift 0.05, switchChance 0.78, blockDecel 0.5, wanderAmp 0.1, wanderFreq 0.05} | overtake.ts | 동일 |
| `STATS` {speedGain 0.018, powerResist 0.15, powerBlockEase 0.2} | stats.ts | 동일 |

## 사용처 변경 (import만, 로직 불변)

- `RaceEngine.ts`: 로컬 SPEED_JITTER/RETRY_COOLDOWN_MS/CATCHUP 정의 삭제 → tuning.ts에서 import. baseSpeed 밴드(`r.range(1.3,1.5)`)·homeLane 리터럴(0.1/pow1.6/0.8/clamp0.08~0.92/jitter0.05)을 BASE_SPEED/HOME_LANE 상수로 치환(rng 드로 순서·순번 동일). n=1 폴백 0.5는 엣지 리터럴이라 유지.
- `overtake.ts`: 로컬 OVERTAKE 정의 삭제 → tuning.ts에서 import + **re-export**(기존 `import { OVERTAKE } from './overtake.ts'` 사이트, 특히 overtake.test.ts가 계속 동작). `laneSpeedFactor` 등 나머지 그대로.
- `stats.ts`: 로컬 STATS 정의 삭제 → tuning.ts에서 import(STATS는 stats.ts 내부에서만 쓰여 re-export 불필요). 헬퍼 함수(statDev/powerEffectScale/powerBlockDecel/powerEaseSlow/speedBias)는 그대로.

## 판단/스코프

- **FINISH_OFFSET_FRAC / DT_MS**: types.ts에 유지(렌더러도 import하는 타임베이스·결승거리 계약 상수, 느낌 노브 아님). tuning.ts 재export는 indirection만 늘어 생략 — 중복 정의 0.
- **ITEM** 박스 가중/효과: 팀리드 목록에 없고 RaceEngine 로컬 자족 블록이라 이동 안 함(스코프 최소).
- **프리셋 틀**: 오버엔지니어링 금지 지침대로 생략(단일 중앙 모듈로 충분).
- 엔진 순수성 유지(DOM/Pixi/Math.random 0).

## 검증 (동작 보존 가드)

- `npm run typecheck`: 통과(잔여 참조/미사용 import 0).
- `npx vitest run`: **48/48 통과** — determinism·engine-bias(1/3/10바퀴) 전부 green = 값 비트 동일 입증(드리프트 시 즉시 실패).
- `scripts/balance.ts`(N=3000, 개인/팀/릴레이 전체) 출력 **리팩토링 전 == 후 비트 단위 동일**(diff 0). 동작 보존 확정.

## 효과

- 모든 게임플레이 느낌 노브가 `engine/tuning.ts` 한 곳 → 밸런스/튜닝 시 한 파일만 보면 됨. balance-tuner가 STATS/CATCHUP/OVERTAKE를 같은 표면에서 조정 가능.
- 렌더러/콘텐츠 영향 없음.
