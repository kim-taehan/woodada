# 곰(bear) `roar` 광역기 범위 확대 + 밸런스 검증

## 결론 (renderer-dev 참조용)
- **최종 range = 18 (baseline 13의 1.38배)**
- staggerMs: 380 → **340** (보조 조정 — 공정성 게이트 유지용)
- trackLength = 1000 기준: range 13 = 1.3% → range 18 = 1.8% (전진거리, 양방향 모든 레인)
- FX 충격파 반경은 **1.38배** 비례 확대 권장.

## 변경 파일
- `src/data/characters/bear.ts` — `skill.params: { range: 13, staggerMs: 380 }` → `{ range: 18, staggerMs: 340 }`
- `scripts/balance.ts` — `ids` 배열이 구 로스터(dog/rabbit/monkey/elephant ×2)였음. 현재 5인 로스터로 수정: `[dog, rabbit, monkey, elephant, bear] ×2` (10인). `wins`에 bear 추가, `slot` 길이를 `ids.length`로.
- `src/engine/skills/roar.ts` — **변경 없음** (핸들러가 이미 `params.range`/`params.staggerMs`를 읽음. 하드코딩 없음).

## balance 하니스 (scripts/balance.ts, N=3000, 10인 필드) 승률 표
| 캐릭터 | baseline range=13 | range=20 (1차) | **최종 range=18 stagger=340** |
|---|---|---|---|
| dog | 0.309 | 0.284 | 0.295 |
| rabbit | 0.286 | 0.232 | 0.244 |
| monkey | 0.117 | 0.108 | 0.118 |
| elephant | 0.116 | 0.135 | 0.131 |
| **bear** | **0.173** | **0.241** | **0.212** |
| avg lead changes/race | 8.3 | 8.2 | 8.3 |

- 곰 독주 없음(0.212 ≪ 0.45). 최대 승률은 dog 0.295로 독주 아님.
- 역전 드라마(lead changes) 사실상 불변.

## 왜 range=20이 아니라 18 + stagger 340인가
- range=20에서 단위테스트 `engine-bias`가 실패. 원인: 곰 2마리의 넓은 광역 스턴이 **최약체 monkey**를 "이길 수 있다" 하한(0.1) 아래로 밀어냄.
- bias 테스트 필드(`defaultCharacterIds ×2` = 10인, 고정 시드 0..1199)에서 monkey 승률:
  - range=20: **0.0925** (실패, <0.1)
  - range=17/stagger=380: 0.0992 (여전히 <0.1, 아슬아슬)
  - **range=18/stagger=340: 0.1033 (통과)**
- range 확대가 주목적이므로 range는 18로 최대한 넓게 유지하고, staggerMs를 380→340으로 소폭(약 10%) 낮춰 피격자 회복을 빠르게 해 공정성 게이트를 회복.
- 곰 독주(>0.45)는 전혀 발생 안 함 — 줄인 이유는 곰 독주가 아니라 monkey 하한 위반.

## 자가검증
- `npm run typecheck`: 통과.
- `npm run test`: 26/26 통과 (engine-bias 포함). bias 테스트는 고정 시드라 결정론적 통과(플래키 아님).
- 결정론/레인 중립성/엔진 순수성 불변 규칙 영향 없음 (params 수치 변경만).

## qa-verifier 플래그
- monkey의 bias 필드 승률(0.1033)이 하한(0.1)과 버퍼가 얇음. **결정론적 통과**라 시드 고정 하 안정적이나, 향후 monkey 자체 밸런스(banana 사거리/스턴) 조정 시 또는 로스터 변동 시 재확인 필요.
- 이번 변경은 결정론에 영향 주는 params 변경(roar 범위/스턴 시간) — 골든 스크린샷이 곰 스킬 발동 프레임을 포함한다면 재캡처 대상일 수 있음(연출은 renderer-dev).

## content-designer / renderer-dev 통지
- content-designer: roar params 스키마 불변 — `{ range, staggerMs }` 그대로. 수치만 변경.
- renderer-dev: 충격파 FX 반경 **×1.38** 비례 확대. 새 `SkillEvent.variant`/phase 추가 없음(여전히 `activate` emit + 피격자 `stunned`).
