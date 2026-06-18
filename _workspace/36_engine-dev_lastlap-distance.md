# 36 · engine-dev · 마지막 바퀴 결승선 오프셋 (시작선 ≠ 결승선)

## 의도
N바퀴 경주에서 1..(N-1)바퀴는 시작선으로 되돌아오는 완전한 루프, **마지막 N번째 바퀴만 시작선을 지나
랩 길이의 12%만큼 더 달려서** 결승. 시작선 ≠ 결승선. 총 주행거리가 정수 바퀴보다 약간 길다.
결정론에 영향 주는 실제 거리 변경.

## 계약 (렌더러와 공유) — import 이름·경로
```ts
import { FINISH_OFFSET_FRAC } from '../engine/types.ts';  // = 0.12
```
- **export 위치**: `src/engine/types.ts` 의 `export const FINISH_OFFSET_FRAC = 0.12;` (DT_MS 바로 아래)
- 의미: 마지막 바퀴가 시작선을 지나 **랩 길이(trackLength)의 12%** 만큼 더 달린 지점이 결승.
- **결승 거리 공식**: `goal = trackLength * (laps + FINISH_OFFSET_FRAC)`
  = `laps × trackLength + FINISH_OFFSET_FRAC × trackLength`.
- **렌더러 할 일**: 결승선을 트랙 시작선이 아니라 `FINISH_OFFSET_FRAC` 만큼 뒤(직선 중간)에 그려야
  시뮬과 일치. lap 표기 `u = progress % trackLength` 로직은 불변(랩 경계는 정수 배수 그대로).

## 변경 파일
1. **src/engine/types.ts** — `FINISH_OFFSET_FRAC = 0.12` export 추가 (주석에 공식·의미 명시).
2. **src/engine/RaceEngine.ts**
   - `FINISH_OFFSET_FRAC` import.
   - 비-relay `goal` 계산을 `trackLength * laps` → `trackLength * (laps + FINISH_OFFSET_FRAC)` 로 변경.
   - relay `goal`(주자당 1바퀴 = `trackLength`)은 **불변**. 오프셋은 개인/팀 멀티랩 결승에만 적용.

## 불변 유지 확인
- **랩 경계/랩 카운터/"마지막 바퀴!" 배너**: 정수 L 기준 유지. 렌더러 `Math.floor(maxP/L)+1` clamp(laps)
  로직이 `laps+0.12`L 지점에서도 floor=laps → clamp=laps 로 정확. 배너는 `lap>=laps`(=(laps-1)L 도달)
  에서 발동, 거리 변경과 무관.
- **finishedAt 노출 (셸 신기록용)**: 이미 노출돼 있음.
  - `RacerState.finishedAt`(crossing frame), `RaceResult.finishFrame[id]`(= finishedAt ?? frame).
  - 셸은 이미 `src/shell/records.ts` 의 `winnerTimeMs(result)` = `result.finishFrame[winnerId] * DT_MS`
    (결정론적 sim 시간)을 신기록으로 사용 중. **추가 노출 불필요** — 이번 거리 변경으로 기록 시간이
    더 긴 마지막 바퀴를 정확히 반영하게 됨.

## 검증 결과
- **typecheck**: 0 에러 (clean).
- **test**: 8 files / 42 tests 전부 통과 (determinism·relay·bias·skills 포함). 기존 기대값 그대로 그린.
  - "more laps make a proportionally longer race": 1랩=1.12L, 3랩=3.12L, 비율 2.79 > 2.4 기준 통과.
- **밸런스 하니스 before/after** (N=3000):

| 모드 | before | after |
|---|---|---|
| INDIVIDUAL win rate | dog .277 cat .208 monkey .126 eagle .131 bear .139 penguin .119 | dog .268 cat .216 monkey .127 eagle .131 bear .135 penguin .123 |
| TEAM 2-pairs | dog .253 cat .220 monkey .164 eagle .080 bear .154 penguin .129 | dog .234 cat .233 monkey .171 eagle .078 bear .148 penguin .136 |
| TEAM peng-stack | A .275 B .454 C .270 | A .296 B .453 C .251 |
| RELAY (laps=3) | dog .231 cat .211 monkey .310 eagle .097 bear .078 penguin .073 | (불변) 동일 — relay는 오프셋 미적용 |

  - 공정성 유지: 개인전 전원 >0.1, 독주(>0.45) 없음. 변동폭 ±0.02 이내(12% 거리 추가의 미세 효과).
  - eagle 팀 2-pairs 0.078은 before 0.080의 기존 상태(이번 변경이 만든 것 아님). 느슨한 bias 테스트 통과.

## 타 에이전트 통지
- **renderer-dev**: 결승선을 `FINISH_OFFSET_FRAC`(types.ts에서 import) 만큼 뒤로 그려야 시뮬과 일치.
  새 `SkillEvent.variant`/phase 추가 없음.
- **qa-verifier**: 결정론에 영향 주는 거리 변경. 골든 스크린샷 중 결승/마지막바퀴 컷은 결승선 위치가
  바뀔 수 있으니 재캡처·검수 필요(엔진 거리만으로는 렌더러 결승선 위치 변경이 별도 작업).
