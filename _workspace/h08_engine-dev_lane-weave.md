# h08 — engine-dev: 레인 거동 튜닝 (위빙↑ + 인코스 가중)

요청: 레이서들이 라인만 지키지 말고 더 왔다갔다(위빙↑) + 인코스 비중↑. **불변 규칙 사수**: 레인은 속도에 영향 없음 — `laneSpeedFactor`는 1 유지, lane→speed 도입 0. "인코스 비중↑"는 속도 이득 없이 **home 레인 분포를 안쪽으로 치우치게** + **wander/위빙 키우기**로만 구현.

## 바꾼 값 (전 → 후)

1. **homeLane 분포** (`src/engine/RaceEngine.ts:174`):
   - 전: `0.1 + (i/(n-1)) * 0.8` (균등 분포)
   - 후: `0.1 + Math.pow(i/(n-1), 1.6) * 0.8` (지수 1.6 — 낮은 lane=인코스 쪽에 더 모임)
   - clamp(0.08~0.92)·jitter(±0.05) 유지. 이건 슬롯별 결정적 매핑(RNG 아님).

2. **위빙/wander** (`src/engine/overtake.ts`):
   - `switchChance` 0.7 → **0.78** (옆이 비면 패스 시도 빈도↑)
   - `wanderAmp` 0.07 → **0.10** (라인 사이 드나듦 진폭↑)
   - `wanderFreq` 0.05 유지, 나머지 상수 불변.

결정론: rng 사용 패턴 동일(새 무작위 도입 없음, pow는 결정적 변환). 서브스트림 규칙 무관.

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **43/43 통과**. 특히:
  - engine-bias **slot fairness 통과** — 인코스 가중이 슬롯 공정성 안 깸(속도 중립이라 예상대로).
  - **no-runaway 통과**, determinism 통과(레이스는 여전히 결정적; 단위 determinism 테스트는 골든 좌표가 아니라 same-seed 재현성만 검사해서 영향 없음).
- 골든 *스크린샷*(Playwright)은 위치가 바뀌어 갱신 필요 — **의도된 회귀**, renderer-dev/qa 처리(아래 통지).

## 밸런스 재측정 (`npx vite-node scripts/balance.ts`, N=3000)

INDIVIDUAL win rate (오히려 더 타이트하게 수렴):
```
dog 0.133  cat 0.147  monkey 0.135  eagle 0.149  bear 0.134  penguin 0.155  hedgehog 0.148
```
- 7종 0.133~0.155 = 1/7≈0.143 기준 **±1.5%p 이내**(직전 ±3%p보다 개선, ±5%p 목표 안).
- slot wins(14슬롯): 0.049~0.092. expected≈0.071, 최저 0.049=0.69×(floor 0.3× 위), 최고 0.092=1.3×(ceiling 2.2× 아래) → 게이트 통과. 후반 슬롯이 약간 유리한 경향은 있으나 미미.
- 독주: lead changes 9.8, winner led 0.503, peak gap 0.073laps, finish gap 39.4f — 건전 범위 유지(>0.45 독주 없음).
- 부대낌↑(인코스 충돌↑)에도 blocking 감속이 승률을 흔들지 않음 — 모든 캐릭이 같은 분포를 받아 속도 중립이 유지된 결과.

→ **밸런스 추가 조정 불필요**(floor·ceiling·독주·slot 전부 통과, 오히려 수렴 개선). 지수/wander 미세조정 없이 1차 값 그대로 유지.

## 메모

- "느낌" 튜닝이라 사용자가 dev 서버 HMR로 보고 더 세게/약하게 요청 가능. 강도 레버: 지수(↑일수록 인코스 쏠림↑), wanderAmp/switchChance(↑일수록 위빙↑). 현재 1차값 = 지수 1.6 / wanderAmp 0.10 / switchChance 0.78.
- TEAM/RELAY 분포는 별개(개인전 위주 검증). 큰 이상치는 없으나 정밀 수렴은 balance-tuner 영역.
