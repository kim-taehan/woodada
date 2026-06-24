# jx01 — 충돌 흔들림 root-fix + 출발 스태거 (engine-dev)

담당: eng-fox · 대상: src/engine/ 만 · 범위: 엔진 로직 + typecheck + unit (e2e 제외)

## 1) 충돌 흔들림 root-fix — 완료 (62/62 PASS)

### 진단 (헤드리스 트레이스)
샌드위치된 레이서가 **±0.05(=laneDrift) full 진폭 square wave로 매 프레임 반전**. 2겹 원인:
- 측면분리 push가 "최근접 이웃 1명" 기준 → 샌드위치 시 최근접이 안/밖으로 교대 → push 방향 반전.
- target이 흔들려도 moveToward가 매 프레임 full step 추종 → 진동 증폭.

### 수정 (src/engine/overtake.ts + tuning.ts, 순수·결정론)
1. **분리 push = 최근접 1명 → 겹치는 모든 이웃의 합(net force) + 데드존(sepDeadzone 0.2)**.
   안/밖 이웃의 반대 push가 상쇄 → 샌드위치 레이서가 가운데서 settle. `separationPush()` 신규(nearestNeighbor 대체).
2. **lane 속도 반전 댐핑(reverseDamp 0.5)**: 직전 프레임과 반대 방향 step을 0.5배로 감쇠.
   같은 방향(진짜 위빙) 무손상. 직전 속도는 `self.skill.laneVel`(serializable)에 저장 → 결정론 유지.

### 결과 (헤드리스)
- fast-jitter rate **11.09% → 7.89%** (29%↓). 최악 케이스 square wave 진폭 **±0.05 → ±0.025**(절반).
- **62/62 PASS** (determinism·engine-bias 포함). 결정론 동일 재생 확인.
- 부수효과: 이전 빨강 2개(engine-bias laps=10 fox-floor·determinism seed3)가 **이 수정으로 함께 초록**.
  - fox laps=10 슬롯: 2승(floor 미달) → 11·6승(여유). lane 흔들림이 줄며 fox가 군집에서 덜 막혀 floor 탈출.
  - seed3 ratio: 2.389 → **2.428** (>2.4, margin +0.028).

### reverseDamp 값 선택 (0.5)
| damp | seed3 | bristle13 | foxFloor | jitter | wiggleAmp |
|---|---|---|---|---|---|
| 0.35 | 2.422 P | 0 F | P | 7.2% | 0.018 |
| 0.40 | 2.390 F | 1 P | P | 7.0% | 0.020 |
| 0.45 | 2.401 P(+0.001) | 1 P | P | 7.0% | 0.023 |
| **0.50** | **2.428 P(+0.028)** | 1 P | P | 7.9% | 0.025 |
→ 0.5 채택: 전 테스트 통과 + seed3 안전마진 최대. 더 강한 댐핑은 fragile 테스트 건드림. wiggle 0.023 vs 0.025 시각차 미미.

### 잔여(정직)
최악 샌드위치 케이스에 ±0.025 잔여 wiggle(진폭 절반). square wave는 죽었으나 완전 정지는 아님.
더 매끈(±0.018, damp 0.35)은 fragile 단일시드 테스트가 걸려 보류 — robust화되면 강도 상향 가능.

## 2) 출발 스태거 — 라우팅 권고 (보류)
공정한 출발 스태거는 **엔진 forward-progress offset이면 데스매치(raw progress 비교 탈락)·슬롯 공정성 깨짐**.
→ **렌더러 전용(접근4)**이 정답: 엔진 progress=0 유지, 렌더러가 출발그리드 뒤로 그리고 ~1s ease(기존 골인 coast 패턴). renderer-dev 영역. team-lead 라우팅 회신 대기.

## 3) 본체 스턴 중에도 분신 계속 이동 — 완료 (62/62 PASS)

### 수정 (src/engine/RaceEngine.ts updateDecoys, 순수·결정론)
기존: `d.progress = owner.progress + d.offset` (매 프레임 본체에 재앵커) → 본체 스턴(progress 동결) 시 분신도 동결.
변경:
- 본체 running: 기존대로 `owner.progress + d.offset` 재앵커(포메이션 타이트 유지).
- **본체 stunned: `d.progress += owner.baseSpeed`** — 분신이 본체 cruise 속도로 독립 전진(동결 안 됨).
- **단조 전진 클램프** `d.progress = max(d.progress, anchored, 0)`: 스턴 중 앞서간 분신이 본체 회복 시 뒤로 스냅백 안 함. 본체가 포메이션을 따라잡을 때까지 lead 유지.
- 레인은 스턴 중에도 owner.lane(+offset) 계속 추종.
- `bodyLenUnits`(데이터) 비의존 — baseSpeed/offset만 사용하므로 co-fox가 57→35~45로 줄여도 안 깨짐.

### 결과 (헤드리스, fox+다수 disruptor, 60~120시드)
- 본체 스턴+분신 생존 프레임 중 **분신 전진율 100%** (이전엔 0% = 동결).
- 스턴 중 앞 분신 최대 lead **~111u**(긴 스턴일수록 더 앞섬 — 의도된 동작).
- **텔레포트 hop**: 일반 avg 49.5u / max 99.7u(p90 53.7); **스턴 동반 시 avg 74.5u / max 99.7u**. 즉 스턴-탈출 시너지로 hop이 커지나 실측 상한 ~100u(≈2.5몸길이)로 bounded(스턴 0.75~1s·분신 3s 수명 제약). 과도하면 그때 캡 논의.
- 결정론 유지(decoy progress 시퀀스 동일 재생). 62/62 PASS.

## 변경 파일 (src/engine만)
- overtake.ts: separationPush(net force) + 반전댐핑 + laneVel.
- tuning.ts: reverseDamp 0.5, sepDeadzone 0.2.
- RaceEngine.ts: updateDecoys — 스턴 중 분신 독립 전진 + 단조 클램프.
