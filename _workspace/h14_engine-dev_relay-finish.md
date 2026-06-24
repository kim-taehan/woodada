# h14 — engine-dev: 릴레이 결승선 통일 (+FINISH_OFFSET_FRAC)

요청: 릴레이만 결승이 랩 경계(u=0, 오프셋 없음)였던 걸 개인/팀(FINISH_OFFSET_FRAC=0.21)과 통일. **중간 핸드오프는 랩 경계(u=0) 유지, 최종 결승만 0.21 뒤로.**

## 구조 파악 (왜 단순 goal 이동이 안 되는가)

릴레이는 각 주자가 정확히 1 trackLength를 달리고 핸드오프 시 progress=0으로 리셋한다. 기존 `goal = trackLength` 하나가 **핸드오프 트리거 + 최종 결승**을 겸했다. 그래서 `goal`을 `trackLength*(1+offset)`로 통째로 옮기면 모든 핸드오프도 0.21 뒤로 밀려 규칙 위반. → 앵커 레그만 결승 거리를 늘려야 함.

## 수정 (`src/engine/RaceEngine.ts`)

1. goal 정의부(라인 ~140): 기존 `goal`(릴레이=trackLength) 유지 + **앵커 전용 골 추가**:
   ```
   const relayAnchorGoal = config.trackLength * (1 + FINISH_OFFSET_FRAC);
   ```
   주석을 "핸드오프=랩 경계 / 앵커만 +0.21로 개인·팀과 통일"로 갱신.

2. 스텝 임계 검사(라인 ~351):
   ```
   const effectiveGoal =
     config.relay && (self.leg ?? 0) >= config.laps - 1 ? relayAnchorGoal : goal;
   if (self.progress < effectiveGoal) return;
   ```
   - 앵커(leg === laps-1)는 마지막 바통 라인을 지나 0.21 lap 더 달려 결승 → `relayLegComplete`의 앵커 분기(leg >= laps-1)에서 finish 처리. 검출 조건이 effectiveGoal과 동일해 정합.
   - 비앵커 레그는 그대로 `goal`(trackLength)에서 핸드오프 → progress=0 리셋, 다음 주자 0에서 시작. **핸드오프 u=0 불변.**

레그 거리·핸드오프 트리거(trackLength 정수배)는 안 건드림 — 최종 finish 거리만 +offset.
결정론: 새 무작위 없음, 순수 규칙. 영향 0.

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **43/43 통과**. relay.test.ts 10건 전부 통과 — **단언 수정 불필요**:
  - 핸드오프 단언(`finisher.progress % trackLength < trackLength`): 핸드오프는 여전히 progress=trackLength(=경계)에서 발생 → 불변.
  - 앵커 단언: 어떤 주자가 finish하는지 + finish 순서/프레임만 검사(앵커 정확 거리 X)라 결승 이동에 영향 없음.

## 렌더러 정합

renderer-dev가 TrackScene.ts의 `finishU`를 릴레이도 `FINISH_OFFSET_FRAC`로 이미 변경(주석에 `relayAnchorGoal = trackLength × (1 + FINISH_OFFSET_FRAC)` 참조). 엔진 결승과 테이프 위치 일치 확인. 시작/랩 라인은 u=0 그대로라 릴레이도 start ≠ finish.

## 통지

- renderer-dev: 릴레이 최종 finish가 이제 +0.21(앵커가 마지막 바통 라인 지나 0.21 lap 더). 테이프 위치 일치(이미 반영됨).
- 골든 스크린샷: 릴레이 결승 위치 이동으로 갱신 필요(의도된 회귀) — qa/renderer 처리.
