# 릴레이 "결승점 멈춤" 버그 진단 (engine-dev)

## 결론: **렌더러 버그** — 엔진 무수정. renderer-dev 영역.

엔진 시뮬레이션은 릴레이를 모든 조합에서 정상 완주한다. 멈춘 것처럼 보이는 건
**렌더러가 릴레이 완주 주자에게 "결승선 통과→코스트→시상" 연출을 의도적으로 빼서**,
결승 직후 `phase==='finished'` 가 된 앵커가 진행도(progress) 고정·speed 0 상태로
트랙 위 결승선 위치에 **그대로 정지 렌더**되기 때문이다.

---

## 1. 재현 / 회귀 검증 (엔진 = 무죄)

임시 vite-node 스윕으로 릴레이 엔진을 직접 돌려 `engine.finished` 도달과
앵커 정지 여부를 관찰(스크립트는 진단 후 삭제).

- **스윕 A**: teamCount {2,3,4} × perTeam {1,2,3} × laps {1..4} × seed 5종 = **180/180 OK**.
- **스윕 B**(기본 laps=5 포함): 팀구성 16종(단일팀·균등·불균등 1/2/3/4) × laps **{1..10}** × seed 5종
  = **800/800 OK**. STUCK 0건.

→ `autoMaxFrames` 한참 이전에 `teamsFinished == legQueues.size` 로 정상 종료.
멤버수>laps, 불균등 팀, 단일팀, 기본 laps=5 모두 멈춤 없음.
이번 브랜치 엔진 묶음(필드쿨다운 active 카운트 / 스턴 쿨다운 리셋 / 0.3s i-frame)은
릴레이 완주 경로와 간섭하지 않음(대기/완주 phase 는 advance·fireSkill·쿨다운 진입에서
일관되게 가드됨: `RaceEngine.ts:240,320,508,653,707`).

- **테스트**: `npm run test` → **55/55 통과** (relay 10/10, determinism, engine-bias). 무수정 baseline.

## 2. 결정적 단서: 앵커 progress 는 누적이 아니라 "레그 단위"

릴레이는 매 레그마다 `progress=0` 으로 리셋된다(`relayLegComplete`, `RaceEngine.ts:577,587,596`).
따라서 **앵커의 최종 progress 는 누적 거리(laps×track)가 아니라 한 레그분 ≈ `relayAnchorGoal = trackLength×1.21`**.

실측(2팀×2명, laps=2, track=1000) 최종 프레임:
```
p2 team=red  phase=finished leg=1 progress=1210.7  lapPos=210.7  rank=2
p3 team=blue phase=finished leg=1 progress=1210.1  lapPos=210.1  rank=1
p0,p1 phase=waiting progress=0   (이미 자기 레그 끝낸 1주자, 대기로 복귀)
```
일반 멀티랩은 progress 가 `laps×track + offset` 까지 누적 → 렌더러 완주 연출과 호환.
릴레이 앵커는 그렇지 않다.

## 3. 근본 원인 (정확한 위치/라인)

`src/renderer/RaceRenderer.ts:1203` — 완주 후 코스트/시상 타블로(#33)가 **릴레이를 명시 제외**:

```ts
// renderFrame 메인 루프
if (r.phase === 'finished' && r.finishedAt !== undefined && !config.relay) {
  placeFinished(r, v, fieldCount, frame.frame, posById);  // 코스트→인필드 산개→환호
  continue;
}
const tp = track.place(r.progress, config.trackLength, r.lane);  // ← 릴레이 앵커가 여기로 떨어짐
```

- 비릴레이 완주자: `placeFinished`(`RaceRenderer.ts:838`)로 결승선을 지나 인필드로 코스트→산개→rank별 환호.
- **릴레이 앵커**: `!config.relay` 조건에 걸려 `placeFinished` 를 못 받고 아래 `track.place` 로 떨어짐.
  progress 는 `relayAnchorGoal` 에 고정, speed 0 → **결승선 트랙 위에 미동 없이 정지**.
  이게 "결승점에 멈춰버린다" 의 정체.

> 이 `!config.relay` 가드의 본래 의도(주석 `RaceRenderer.ts:1202`)는 "릴레이 final 은 `waiting` 으로
> 큐잉되므로 placeFinished 를 타면 안 된다" 였다. 하지만 **앵커(마지막 주자)는 `waiting` 으로
> 복귀하지 않고 `finished` 로 끝난다**(`RaceEngine.ts:560-566`). 즉 가드가 "대기 복귀 주자"와
> "진짜 완주한 앵커"를 구분하지 못해, 앵커까지 연출에서 누락시킨 것.

대기 복귀 주자는 같은 루프 상단 `if (config.relay && r.phase === 'waiting')`(`RaceRenderer.ts:1195`)에서
이미 따로 처리되므로, 앵커(finished)는 `placeFinished` 로 보내도 안전.

## 4. 권고 수정안 (renderer-dev 에게)

`RaceRenderer.ts:1203` 의 완주 분기에서 릴레이 앵커도 코스트/시상에 포함:

```ts
// 대기(waiting) 복귀 주자는 위(1195)에서 이미 분기됨. 여기 도달하는 finished 는
// 비릴레이 완주자 또는 릴레이 앵커(마지막 주자) 뿐 → 둘 다 placeFinished 가 맞다.
if (r.phase === 'finished' && r.finishedAt !== undefined) {
  placeFinished(r, v, fieldCount, frame.frame, posById);
  continue;
}
```
즉 `&& !config.relay` 만 제거.

검토 포인트(renderer-dev 확인 필요):
- `placeFinished` 가 `r.progress`(앵커는 lapPos 210 부근)에서 코스트 시작점을 잡는데(`RaceRenderer.ts:847`
  `track.place(r.progress, …)`), 릴레이 앵커의 progress 가 결승선 기준이라 자연스러운지.
  일반전 완주자는 progress 가 결승선 직후라 동일하게 동작할 것으로 보이나, 시각 검증(Playwright) 필요.
- `fieldCount`/산개 레이아웃이 릴레이(트랙 위 1주자 + 대기열)와 충돌하지 않는지.

## 5. 제약 준수
- `src/engine/` 무수정. 렌더러/데이터 무수정(렌더러 문제로 판명 → 보고만).
- 엔진 순수성·결정론 불변 유지. relay.test 회귀 케이스는 **엔진 버그가 아니므로 추가하지 않음**
  (요청은 "엔진 회귀면 재현 케이스 추가"였고, 엔진은 회귀 없음 → 추가 불필요).

## 산출물 경로
- 진단서: `/Users/a08368/vscodeProjects/woodada/woodada-v3/_workspace/s20_engine-dev_relay-finish-bug.md`
- 핵심 코드: `src/renderer/RaceRenderer.ts:1203` (원인), `:838 placeFinished`, `:1195 waiting 분기`;
  `src/engine/RaceEngine.ts:560-566`(앵커 finished), `:577/587/596`(레그별 progress 리셋).
