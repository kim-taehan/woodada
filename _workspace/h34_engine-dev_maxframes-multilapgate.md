# h34 — engine-dev: #1 maxFrames 자동 스케일 + #3 멀티랩 공정성 게이트

브랜치: `polish/engine-improvements`.

## #1 maxFrames 자동 스케일 (RaceEngine.ts)

문제: `simulateRace`의 `maxFrames` 기본값 `60*120=7200`이 10바퀴엔 부족 → "race did not finish" throw. 호출부가 매직넘버를 넘겨야 했음.

수정:
- 신설 `autoMaxFrames(config)`: 완주 거리 `trackLength*(laps+FINISH_OFFSET_FRAC)`를 보수적 지속속도 floor(MIN_SUSTAINED_SPEED=0.4, 순항 floor 1.3보다 훨씬 낮춰 장기 blocking/slow/캐치업 흡수)로 나누고 BUFFER 1.5 곱함.
- `simulateRace(..., maxFrames = autoMaxFrames(config))` — 명시 인자 오버라이드 계속 가능(하위호환). 안 끝나면 throw 유지(무한루프 가드).
- 결정론·기존 동작 불변(루프는 여전히 `engine.finished`에서 조기 종료, maxFrames는 상한일 뿐).

산정값(trackLength 1000): 1바퀴 4538 / 3바퀴 12038 / 10바퀴 38288. (실제 완주는 이보다 훨씬 일찍; 1바퀴 실수요 ~2420, 10바퀴 수동값 24000도 통과했으니 38288은 안전 상한.)

## #3 멀티랩 공정성 게이트 (engine-bias.test.ts)

문제: 기존 게이트가 1바퀴 전용 → 멀티랩 사각지대.

수정:
- "every character can win" + "every slot can win" 두 검사를 **laps ∈ {1,3,10}** 로 파라미터화(`LAP_CASES`). 기준은 기존과 같은 느슨한 sanity(can-win floor / no-dominance ceil / per-slot). 정밀 ±아님.
- **런타임 관리**: 바퀴수별 N 축소 — 1바퀴 N=1200, 3바퀴 400, 10바퀴 200. maxFrames는 #1 자동(수동 오버라이드 제거).
- 임계는 고바퀴에서 약간 완화(스킬 효과 누적 반영): charFloor 0.07/0.05/0.04, charCeil 0.45 일정, slotFloorMul 0.3/0.25/0.2, slotCeilMul 2.2/2.4/2.6.
- no-runaway(peak-gap) 테스트는 1바퀴 그대로 유지(팩 동역학 검사, #3 범위 밖).

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **48/48 통과**(엔진-bias 7건 = 1/3/10바퀴 char+slot 6 + no-runaway 1). 전체 ~47s(대부분 bias 멀티랩; 고바퀴 N 최소화로 관리).

## 측정된 멀티랩 분포 (현재 밸런스, 게이트가 보는 값)

| laps | N | char min~max | slot min~max (expected) |
|---|---|---|---|
| 1 | 1200 | 0.105~0.180 | 0.045~0.102 (0.071) |
| 3 | 400 | 0.077~0.253 | 0.030~0.142 (0.071) |
| 10 | 200 | **0.070~0.295** | 0.025~0.170 (0.071) |

게이트는 전부 green(느슨한 sanity로 통과). **그러나 멀티랩 공정성 드리프트가 실재한다 — 수치로 보고:**
- **penguin: 바퀴↑일수록 강해짐** (1→0.180, 3→0.253, 10→0.295). icefield가 장기전에서 누적 이득.
- **bear/hedgehog: 바퀴↑일수록 약해짐** (10바퀴 0.070씩).
- monkey는 우려와 달리 10바퀴 0.155로 무난(팀리드가 예상한 monkey가 아니라 penguin이 진짜 멀티랩 강자).
- 독주(>0.45)나 완전약체(0%)는 없음 → 느슨 게이트는 정당하게 통과. 단 ±5%p 기준으론 penguin 멀티랩이 벗어남.

## 권고

- 게이트는 의도대로 "독주/약체 0" sanity를 멀티랩까지 커버. 통과.
- penguin 멀티랩 강세 + bear/hedgehog 약세는 **balance-tuner** 영역(예: icefield params를 바퀴 무관하게 조정, 또는 penguin power/speed 미세조정). 엔진 로직 문제 아님 — 임의 과튜닝 안 함, 수치로만 보고.
- 렌더러/콘텐츠 영향 없음.
