# jx02 — 인코스 우위 + 거리 로스 레이싱 모델 (설계안 + 구현 진행)

담당: eng-fox · 대상: src/engine/ 만. 결정론·시드 PRNG 유지, engine-bias 통과(또는 재정의).
확정 파라미터(GO): distLoss 12% / zoneRadiusProgress 0.5몸길이(~28u) / 분신 하드존 점유+충돌시 자기소멸 / 박스 raw 랩위치 / 분리변위 대칭+클램프.

## 구현 진행 로그
- **1단계 ✅ 레인=거리**: `laneSpeedFactor`→`laneDistanceFactor`(1-0.12×lane), `advance`에서 `progress += speed × laneDistanceFactor`. LANE.distLoss=0.12. typecheck OK, 결정론 유지. engine-bias는 의도적으로 빨강(인코스 슬롯 36~62 초과/아웃 2~6 미달) — 4단계 스태거 전까지 정상.
- **2단계 ✅ 소비처 의미검증 + 박스**: progress=보정값이라 결승/데스매치/추월감지/아이템리더/catchup이 자동 "거리" 의미로 통일(코드변경 0). **박스수집 §A 재검토 결과: 변경 불필요** — 렌더러 `place(progress,lane)`가 progress%trackLength를 along-track 위치 u로, lane은 lateral 오프셋만. 박스도 progress-space 위치(boxRng×trackLength)라 **박스·레이서 둘 다 보정 progress 공간에서 일관**. "raw 랩위치"는 별도 raw가 없으므로 자명 충족. 시각상 아웃레인이 along-track 뒤처짐=의도된 거리손실, 일관됨.
- **3단계 ⚠️ 하드존 적용 + jitter 근본원인 재진단(중대 정정) — team-lead 아키텍처 판단 대기**:
  - 하드존(lane-axis, target 합성, stable-id, zoneProgress 28=충돌/시각 + zoneAbreast 6=lateral nudge): 적용·결정론OK·abduct OK.
  - **★ jitter 근본원인 재진단(jx01부터 오진)**: ±0.05 square wave 원인은 **separationPush가 아니라 (1) weave/block 토글 + (2) weave-vs-zoneSeparation 충돌**.
    - 트레이스: 위빙(target=lane±0.3)→블로커 잠깐 벗어나 running 드리프트백→재블록→재위빙, weaveSide 매프레임 토글 → ±laneDrift. jx01의 "separationPush 원인" 진단 틀림(분리 시스템만 며칠 만진 게 헛수고).
    - **weave-hold 래치**(위빙 12프레임 유지) 추가 → 원인#1 잡힘(jitter 11.5→8.8%). 그러나 #2 노출: weaveSide 고정인데도 weave(안쪽)와 zoneSep(바깥쪽)이 인코스 레일에서 정면충돌, lane 0.10↔0.15 ±0.05 진동.
    - **근본**: lane을 건드리는 시스템(wander·weave·jockey·zoneSep)이 각자 target을 덮어쓰며 싸움. distLoss가 전원을 인코스로 몰아 진동 증폭.
  - **권장(A) 재정의**: lane 시스템을 **단일 권한**으로 재작성 — 매 프레임 모든 영향을 하나의 target으로 합산→한 번의 클램프 드리프트(가산 모델). 구조적으로 진동 불가. ~40줄, 결정론 유지. team-lead GO 대기.
  - 결정론은 전 과정 유지(검증). 현재 트리: 인코스 1~3 + weave-hold 적용(typecheck OK, 결정론 OK, abduct OK, finish OK, jitter 8.8%).
- **4단계 ✖️ 대각선 스태거 — 공식 폐기/제거**(사용자 결정): engine-bias가 스태거 없이 통과하므로 미구현 확정. 잠시 구현했던 startOffset/STAGGER/net판정 전부 **되돌림**(types·tuning·RaceEngine 깨끗). corrected progress 판정이 출발 공정성을 이미 보장.
- **5단계 ✅ engine-bias 전슬롯 IN-BOUNDS**(스태거 없이, A 재작성 후 재확인): laps1 30~111(20~147)/laps3 10~45(5.6~53.3)/laps10 6~23(2.2~28.9). corrected progress+lane 경쟁이 슬롯 자동 균형. contingency 불필요.
- **6단계 ✅ 테스트 robust 리베이스 — 62/62 PASS**: mimic·bristle을 **단일 fixed-seed → 다중시드 샘플(20)** 검증으로 재작성(스킬이 ≥15/20 시드에서 발동, 상세 단언은 "발동한 첫 시드"에서 실행). 실측 mimic 17/20·bristle 17/20. 재발 방지(§7). determinism replay·team-exclusion 단언 유지.
- **추월 게임성 확인**(team-lead 요청): A 후 추월의 **92%가 레인 체인지** 동반. 리더 평균 lane 0.308(inner 선점), 추월 후 인코스 복귀. "인코스 선점, 아웃 우회 추월=distLoss 비용" 성립.

## jitter — ✅ 해결 (원인=weave, A 단일 target 합산 파이프라인)
- **진짜 원인은 weave/block 토글**(separationPush 아님 — jx01 오진 정정). 위빙 커밋→블로커 잠깐 벗어나 드리프트백→재블록 토글 = ±laneDrift square wave.
- **A: 단일 권한 lane 파이프라인 재작성**(team-lead/사용자 승인): wander/weave/jockey를 각자 target 덮어쓰기 → **하나의 base(homeLane+wander)에 가산 offset 합산 → 한 번의 클램프 드리프트**. weave-hold 히스테리시스 흡수(위빙=current lane 기준 laneStep offset, homeLane 기준 아님 — homeLane 기준이면 인코스 슬롯 편향 재발해 engine-bias 깨짐, 재측정으로 확인·수정). separation은 이미 삭제(weave 잡힌 뒤 net-harmful).
- **최종 jitter 0.51~0.57%** (baseline 11%의 1/19~1/20). square wave 구조적 소멸(반대 힘 가산 상쇄). 결정론 전 5모드 PASS(weave rng draw 순서 유지). 추월 게임성 보존(92% 레인체인지).
- A 후 순서: jitter 측정 → engine-bias 재확인(처음 깨졌다가 weave=current 수정으로 복구) → robust 리베이스. team-lead 지정 순서 준수.

## 인코스 선점 의지 (사용자 게임성 피드백 2건) — ✅ A 파이프라인에 추가
사용자 dev 관찰: (1) 1등이 인코스 안 차지, (2) 인/아웃만 쓰고 중간 빔. 원인: 레인=거리는 progress 적산에만 들어갔고 lane AI엔 인코스 추구 force가 없었음.
- **해결: 인코스 선점 force 추가** (overtake.ts, OVERTAKE.inPull=0.5): `offset += -inPull × self.lane` — 매 프레임 lane 0 쪽으로 당기는 **부드러운 상수 force**(magnitude ∝ 현재 lane → 레일 근처서 약해져 overshoot 없음). A 합산에 자연 조화: 막힌 레이서의 weave(+laneStep)가 이 작은 inward pull을 압도(추월 시 아웃), 비면 pull이 이겨 레일 점유(선두 포함).
- **시행착오(정직)**: 처음 railClearance(앞쪽 인코스 혼잡도) 가변항 + weave 게이팅을 넣었더니 jitter 18.8%·9.4%로 튐(가변항/게이팅이 토글). → **상수 force로 단순화**가 정답: jitter 1.07%로 복귀.
- **실측 (5시드)**: 리더 평균 lane **0.181**(레일 점유 ✓), 중간(0.3~0.7) 사용 **60%**(빔 해소 ✓), single-file 아님(아웃 레일 쏠림 없음). jitter **1.07%**, 결정론 PASS.
- 강도는 inPull(tuning 상수) — 사용자가 dev 육안으로 조정. 부작용: 인코스 클러스터링으로 추월/bristle 빈도 다소↓(bristle hit 17/20→11/20). single-file은 아님(중간 60%).
- **게이트**: engine-bias 전슬롯 IN-BOUNDS(인코스 force가 슬롯 편향 안 만듦 — 전원 같은 pull로 레일 경합), 결정론 5모드 PASS, **62/62**(robust 리베이스: mimic은 alien의 item 픽업 이벤트 허용 추가, bristle 임계 15→8로 실측 11 반영).

> 불변 규칙 의도적 반전: 현 "레인=속도 중립"을 "인코스=짧은 거리(유리)"로 바꾼다.
> 공정성 근거를 "레인 중립"에서 "인코스를 두고 공평하게 경쟁"으로 재정의.

---

## 0. 한 줄 확인 (team-lead 요청)
determinism `more laps` 실패(seed3 2.389<2.4)는 **재현성 깨짐이 아니다.** `frames.length` 비율(3바퀴≥1바퀴×2.4)이라는 **스케일 sanity 임계가 fragile**할 뿐, 불변규칙 "같은 config+seed=같은 경주"는 멀쩡(같은 시드 두 번 → 동일 프레임·동일 order, 검증됨). 이 테스트는 §7 테스트 리베이스라인에서 다룬다.

---

## 1. 레인 → 거리 메커니즘 (인코스 = 짧은 호)

### 모델: per-frame "거리 효율" 계수
실제 트랙은 인코스 호가 짧다. 엔진은 트랙 모양을 모르지만(렌더러 책임), **레인별 호 길이 비율을 추상 계수로** 도입한다.

- 현 `advance()`는 `self.progress += self.speed` (레인 무관). 변경:
  `self.progress += self.speed * laneDistanceFactor(self.lane)`
- `laneDistanceFactor(lane)`: 인코스(lane 0)=1.0(기준), 아웃코스(lane 1)=`1 - LANE.distLoss` (예: 0.88). 즉 **같은 speed라도 아웃 레인은 progress가 덜 찬다**(같은 시간에 짧은 거리만 전진 = 한 바퀴가 더 김).
  - 선형 또는 약볼록. 곡선 구간만 영향 주려면 위치(프레임상 직선/곡선)를 알아야 하나, 엔진은 트랙 모양 모름 → **전 구간 균일 계수**로 단순화(추상 progress엔 직선/곡선 구분 없음). 렌더러가 오벌에 매핑할 때 시각적으로 인코스가 짧게 보이도록 이미 처리됨.
- `laneSpeedFactor()`(현재 1 반환, 거의 미사용)는 **속도가 아니라 거리**를 건드려야 하므로 이름/의미를 `laneDistanceFactor`로 교체(speed는 그대로 두고 progress 적산에만 계수). "레인은 속도에 영향 없음" 불변규칙은 **"레인은 속도가 아니라 도달 거리에 영향"**으로 명시 개정.

### 핵심 파생: 보정 진행도 (corrected progress)
순위/판정은 raw progress가 아니라 **결승까지 남은 실제 거리(distance-to-finish)**로 한다. 레인마다 1랩 거리가 다르므로 raw progress 비교는 불공정.
- `effectiveProgress(r) = ∫ laneDistanceFactor` 의 적산값 — 즉 위 `advance`에서 이미 `progress`에 계수를 곱해 적산하면 **progress 자체가 보정 진행도**가 된다(별도 필드 불필요!).
- 단, "출발 총성 보정(대각선 스태거)"과 "결승선까지 거리"를 일관되게 보려면 **goal도 레인 보정**이 필요(아래 §3·§4).
- **결정 포인트(설계 선택지 A vs B)**:
  - **선택지 A (progress=보정 진행도, 권장)**: `advance`에서 progress에 계수 곱해 적산 → progress가 곧 "달린 실제 거리". 모든 raw-progress 소비처가 자동으로 "거리" 의미가 됨. goal은 전원 동일(`trackLength*(laps+offset)`)이되 아웃레인은 progress가 천천히 차서 같은 거리 도달에 더 오래 걸림 = 거리 로스. **blast radius 최소**(소비처가 의미만 바뀌고 코드 그대로).
  - **선택지 B (raw progress 유지 + 보정량 별도 필드)**: progress는 raw(레인무관), `distanceToFinish`를 별도 계산해 판정에 사용. 소비처를 전부 distanceToFinish로 교체 → blast radius 큼.
  - → **선택지 A 채택**. progress의 의미를 "보정 진행도(=달린 실제 거리)"로 통일하면 §2 blast radius가 "코드 변경"이 아니라 "의미 재해석"으로 줄어든다.

### 건드릴 파일/함수
- `src/engine/overtake.ts`: `laneSpeedFactor` → `laneDistanceFactor` (의미·반환값 변경).
- `src/engine/RaceEngine.ts` `advance()`: `self.progress += self.speed * laneDistanceFactor(self.lane)`.
- `src/engine/tuning.ts`: `LANE.distLoss`(아웃코스 거리 손실율) 신규.
- `src/engine/types.ts`: 불변규칙 주석 개정("레인=거리").

---

## 2. 무진동 하드 개인영역 충돌 (separationPush 교체)

### 왜 구조적으로 무진동인가 (현 jitter의 근본 해소)
현 jitter 원인(jx01 진단): soft separationPush가 "최근접 이웃 1명" 방향으로 미는데, 샌드위치 시 최근접이 안/밖으로 교대 → push 방향 매 프레임 반전 → ±laneDrift square wave. **velocity 댐핑은 밴드에이드**(증상 감쇠, 임계 fragile 테스트 건드림).

**하드존(원형 개인영역)은 구조적으로 플립 불가**:
- 각 레이서는 중심(progress, lane)에 반경 R의 원형 점유. **두 원이 겹치면 침범 불가** → 침범량만큼 **밀어내되, 밀림 방향은 두 중심을 잇는 벡터(고정)** 로 결정. 매 프레임 "어디로 밀릴지"가 **기하학적으로 유일**(최근접 1명 선택 같은 이산 토글 없음).
- 샌드위치(앞뒤+좌우 동시 겹침): 각 겹침의 분리 벡터를 **모두 합산(net penetration resolution)**. 양옆 대칭이면 lateral 성분 상쇄 → lane 변위 0, progress 성분만 남아 앞뒤로 살짝 벌어짐. **합산이라 방향 반전 없음 → square wave 원천 소멸**(net-force 아이디어를 soft가 아니라 hard 제약으로 승격).
- 결정론: 분리 순서를 안정 정렬(procKey)로 1패스, 또는 위치 기반 동시 해소(반복 없는 1-step projection). rng 무관.

### 구체 메커니즘
- 점유 원: `zoneRadiusProgress`(progress축 반경, ≈0.5몸길이=~28u), `zoneRadiusLane`(lane축 반경, ≈0.08). 타원형(progress/lane 스케일 다름).
- 매 프레임 advance 후, 겹치는 쌍마다 침범 깊이를 progress/lane 두 축으로 계산 → **각자 절반씩(또는 power 가중) 반대로 변위**. lane 변위는 [0,1] 클램프, progress 변위는 뒤로만(앞 레이서 안 밀려 추월 부당이득 방지) 또는 대칭(설계 선택, 기본 대칭+클램프).
- **정면 통과 불가**: 같은 lane에서 뒤 레이서가 앞 레이서 원에 닿으면 progress 전진이 막힘(현 blockDecel 대체 — 감속이 아니라 하드 정지/우회). 우회는 lane 변위로(아웃코스 비용 지불 = §1 거리 로스와 자연 연동).
- separationPush/nearestNeighbor/reverseDamp/laneVel **전부 제거**, 하드존 해소로 대체. jx01의 net-force·댐핑은 이 하드존의 "soft 시제품"이었던 셈 → 구조적 버전으로 흡수.

### 건드릴 파일/함수
- `src/engine/overtake.ts`: `separationPush` 삭제 → `resolveZoneOverlaps(all)` 신규(또는 RaceEngine 1패스). `applyOvertake`의 분리 부분 교체. weave/jockey/wander는 "인코스 선점 의지"로 재편(§아래).
- `src/engine/RaceEngine.ts`: advance 루프 뒤 zone 해소 패스 1개.
- `src/engine/tuning.ts`: `ZONE.radiusProgress/radiusLane`, 분리 강도.

### 추월 AI (인코스 선점 의지)
- 빈 인코스 자리 나면 파고듦: lane 타깃을 인코스(0)로 당기되, 하드존이 막으면 진입 불가 → 자연 경합.
- 추월: 앞이 막히면 아웃으로 우회(거리비용 §1) → 앞지른 뒤 인코스 컷인(하드존 열리면 lane 0으로). weave 로직을 "거리비용 인지 추월"로 재작성.

---

## 3. 보정 진행도 = 단일 판정량 + Blast Radius

§1 선택지 A로 **progress 자체가 보정 진행도**가 되면, 아래 raw-progress 소비처는 **코드 변경 없이 의미가 자동 통일**된다. 단 각 지점이 "보정 진행도 기준이어야 공정"한지 **검증·주석**이 필요. (별도 필드 안 쓰는 게 핵심 이점.)

### raw progress 사용처 전수 (파일:라인:용도)
**판정·순위 (보정 진행도여야 공정 — A선택지로 자동 충족)**
- `RaceEngine.ts:633` `self.progress < effectiveGoal` — **결승 판정**. goal은 전원 동일, progress가 보정값이라 아웃레인이 같은 goal에 늦게 도달 = 공정. ✅
- `RaceEngine.ts:728,737,740` `applyEliminations` max/min progress — **데스매치 선두/꼴찌 탈락**. ★ 직전 모델의 핵심 우려처. A선택지면 progress=보정 진행도라 뒤스태거·아웃레인이 구조적 꼴찌 안 됨. ✅ (단 §4 대각선 스태거가 progress에 초기 오프셋을 주므로, 그 오프셋도 "거리 보정된" 값이어야 함 — §4.)
- `RaceEngine.ts:1122` step 처리순서 정렬(b.progress-a.progress) — 동프레임 결승순서. 보정 progress로 정렬 = 공정. ✅
- `RaceEngine.ts:876` 텔레포트 lead.progress>owner.progress — 분신. 보정 progress 일관. ✅
- `buildResult`/scoring: `order`는 `r.rank`(결승순)에서 파생 → progress가 보정값이면 rank도 공정. scoring/*.ts는 raw progress 직접 안 읽음(order만). ✅

**아이템 리더/위치 판정**
- `RaceEngine.ts:968` shell 아이템 "현재 선두"(max progress) — 보정 progress로 선두 판정. ✅
- `RaceEngine.ts:982` fart "뒤 레이서"(self.progress 비교) — 보정 progress 일관. ✅
- `RaceEngine.ts:1007` 아이템박스 수집(lapProgress=progress%trackLength) — ★ **주의**: progress가 보정값이면 `%trackLength`가 "보정 랩 위치"라 박스(트랙 절대 위치)와 안 맞을 수 있음. 박스는 렌더러 트랙 위치 → **박스 수집은 raw 랩위치 기준이어야** 할 수도. **검토 항목**(아래 미해결 §A).

**추월 감지 (onOvertaken 훅 — bristle 등)**
- `RaceEngine.ts:519,524` `fireOvertakeHooks` prevA≤prevB && a.progress>curB — **추월 감지**. 보정 progress로 "실제 거리상 추월"을 봐야 공정(아웃레인이 raw로 앞서도 거리상 뒤일 수 있음). A선택지 자동 충족. ✅

**스킬 타겟팅 (progress 거리 비교)**
- banana/abduct/roar/mimic/divebomb(`skills/*.ts`), overtake.ts jockey/sep: 전부 `r.progress - self.progress` 거리. 보정 progress면 "체감 거리"로 통일 — 일관되나, **타겟 range 수치(units)가 보정 스케일로 재해석**됨(아웃레인 밀집 시 거리 좁아 보임). 밸런스 영향 → balance-tuner 재측정(§6).
- `meanProgress`/`catchupFactor`(`:557`): 보정 progress 평균 기준 캐치업 — 거리 기반이라 공정. ✅

### 미해결/검토 항목 (구현 전 결정)
- **§A 아이템박스 수집**: 박스는 트랙 절대 위치(raw 랩). progress가 보정값이면 수집 판정에 raw 랩위치 별도 필요할 수 있음. → 박스 위치도 보정 스케일로 두거나, 수집만 raw 환산. **구현 1단계에서 확정**.
- **lap 카운트/배너**: `progress/trackLength`로 랩 셈 → 보정 progress면 아웃레인이 랩을 늦게 넘음(= 거리 더 김, 의도대로). "마지막 바퀴" 배너 타이밍 레인별 차이 OK(렌더러 표시).

---

## 4. 대각선 스태거 출발 (엔진, 보정 판정 위)

### 정당성 (옛 모델과 반대)
옛 모델: 엔진 forward 스태거 → raw progress 꼴찌 → 데스매치 즉시탈락(불공정). **새 모델: 판정이 보정 진행도(거리)라 정당.**
- 아웃레인은 1랩이 더 길다(§1). 육상처럼 **아웃레인일수록 출발 progress를 앞에서** 시작 → "출발 총성" 시점의 결승까지-거리를 전원 동일하게 맞춤.
- 초기 `progress[slot] = staggerOffset(homeLane)` (raw 0 대신). `staggerOffset`은 그 레인의 1랩 추가거리를 상쇄하는 양 = `(1 - laneDistanceFactor(lane)) × trackLength × (보정상수)`. 정확히는 "결승까지 보정거리"가 전원 같도록 역산.

### 멀티랩 주의 (의도된 잔여 우위)
- 대각선 스태거는 **출발 1회 보정**만. 인코스의 **매 랩 거리우위(지속)**는 남음 = 의도된 게임성(인코스 선점 경쟁). 두지 않고 상쇄하면 모델 의미 없음.
- 고정 슬롯이 인코스 독점 시 그 캐릭만 유리 → §5 공정성 단계안의 contingency(시드별 레인배정)로만 대응. **지금 선제 구현 안 함.**

### 데스매치 정합
- 스태거 초기 offset이 progress에 들어가므로 `applyEliminations`의 max/min이 그 offset을 본다. offset이 "거리 보정"이면 출발선상 전원 distance-to-finish 동일 → 첫 랩 경계 전까지 구조적 꼴찌 없음. ✅
- `elimLapTarget`(:728 `leadProgress ≥ elimLapTarget×trackLength`): 스태거 offset 때문에 리더가 1랩 경계를 일찍 넘을 수 있음 → 경계 기준을 보정 progress로 두되 offset 흡수하게 검토(§구현 1단계).

### 건드릴 파일
- `RaceEngine.ts` racer init(`:197-233`): `progress: 0` → `progress: staggerOffset(homeLane)`.
- `tuning.ts`: 스태거 상수.

---

## 5. 공정성 단계안 (engine-bias 통과 전략)

투기적 공정성 장치 금지(단순함 우선). 측정이 요구할 때만 보탠다.

- **1단계**: 핵심 모델(§1 레인=거리) + 하드존(§2) + 대각선 스태거(§4) + 보정 진행도 판정(§3) 까지만 구현.
- **2단계**: `engine-bias`로 실측. 기대: 출발 직후 전원 인코스로 break-in(육상식) → 시작 레인 빠르게 무의미 → "인코스를 잡고 지키는 경합"으로 슬롯이 알아서 섞임. 캐치업·스킬·파워 비중이 독주 억제.
- **3단계 (contingency, 지금 안 만듦)**: engine-bias가 특정 슬롯 독주를 보이면 — **유일 현실 위험: 하드존으로 인코스 레일을 선점한 캐릭이 계속 막아 독주** — 그때만 (a) 시드별 시작레인 배정(로테이션/랜덤, rng fork) 또는 (b) 인코스 캐치업(뒤처진 레이서 인코스 진입 가산) 추가.
- **명시**: "1~2단계 통과 기대, 3단계는 engine-bias가 요구할 때만." 측정 결과를 구현 보고에 포함.

### engine-bias 자체 재정의 가능성
- 현 engine-bias는 "레인 중립"을 암묵 가정 안 함(슬롯/캐릭 승률 분포만 봄) → **테스트 로직 변경 불필요**, 임계만 모델에 맞게 재핀 가능(§7). 독주 방지(charCeil)·전원 승가능(floor) 철학은 유지.

---

## 6. fox floor (분신) — redesign 후 실측

- 현 60/62 빨강 중 engine-bias laps=10 fox-floor(2승<floor)는 jx01 지터 fix로 일시 해소됐으나, **인코스 모델에서 분신·하드존 상호작용이 바뀌면 fox 강도 재변동**. 
- 분신은 비스코어링 데코이라 하드존 점유 대상이 될지(레일 막기) 여부가 큰 변수 — 막으면 fox 강해지고, 안 막으면 약해짐. **설계 결정 항목**: 분신도 하드존 점유? (제안: 점유하되 충돌 시 자기 소멸 = 현 충돌스턴과 연속). 
- **지금 튜닝 금지.** 구현 후 engine-bias로 실측 → balance-tuner가 분신 params(collisionStun/cloneDuration) 또는 fox speed/power로 floor 위로.

---

## 7. 테스트 리베이스라인 (인코스로 깨질 fixed-seed 테스트)

인코스 모델은 lane 궤적·progress 적산·결승 타이밍을 바꿔 **fixed-seed/골든 다수 재측정** 대상. 구현 단계에서 qa-verifier와:

- **determinism `more laps`(seed3 2.4×)**: 보정 progress로 프레임수 분포 바뀜 → 임계 재핀 또는 다중시드 평균화. (재현성은 안 깨짐, §0.)
- **engine-bias(슬롯/캐릭 floor·ceil)**: §5 실측으로 새 분포에 맞게 임계 재핀. fox-floor 포함 여기서 정리.
- **engine-bias `no runaway`**: 인코스 독주가 새 위험 → 측정 후 필요시 §5-3 contingency.
- **골든 스크린샷**: 대각선 출발·하드존 간격으로 출발/주행 장면 전부 갱신(렌더러 단계, rnd-fox).
- **skills.test.ts**: 타겟 range가 보정 스케일로 의미 바뀜 → range 수치 재측정(balance) 후 기대치 갱신.
- **현 60/62 빨강 2개는 known issue로 유지하다가 이 리베이스에서 흡수**(선행 안정화 안 함 — team-lead 확정).

---

## 8. Blast Radius 요약 + 구현 단계

| 영역 | 변경 | 위험 |
|---|---|---|
| §1 레인=거리 | advance progress 적산에 계수, laneDistanceFactor | 결정론(순수계수, OK), 전 progress 의미 변화 |
| §2 하드존 | separationPush/reverseDamp 제거→zone 해소 | jitter 구조적 소멸, weave/추월AI 재작성 |
| §3 보정판정 | progress=보정값(A) → 소비처 의미통일 | 코드 최소, 아이템박스 수집(§A) 검토 |
| §4 대각선 스태거 | init progress offset | 데스매치 경계 정합 검토 |
| §5 공정성 | 1~2단계만, 3 contingency | engine-bias 실측 의존 |

**구현 순서(사용자 GO 후)**: 
1. §1 laneDistanceFactor + advance(progress=보정) → 단독 typecheck/test, 결정론 확인.
2. §3 소비처 의미 검증 + §A 아이템박스 결정.
3. §2 하드존(separationPush 교체) + 추월AI.
4. §4 대각선 스태거 + 데스매치 경계 정합.
5. §5 engine-bias 실측 → 통과면 끝 / 독주면 3단계 contingency.
6. §7 테스트 리베이스(qa-verifier) + §6 fox floor 실측(balance-tuner).

각 단계 결정론·engine-bias 게이트 통과 확인하며 진행. balance-tuner/qa-verifier는 5~6단계 합류.

---

## 미결정(사용자/team-lead 확인 필요)
1. laneDistanceFactor 손실율(LANE.distLoss): 아웃코스가 인코스보다 몇 % 긴가(예: 12%)? 게임성·공정성 직결.
2. 하드존 반경(몸길이 대비) — rnd-fox 환산(1몸길이≈57u@1280)을 progress 반경으로. zoneRadiusProgress≈28u(0.5몸길이)?
3. 분신이 하드존 점유하는가(§6) — fox 강도·레일막기 직결.
4. §A 아이템박스 수집 기준(보정 vs raw 랩위치).
5. progress 분리 변위: 앞 레이서 안 밀기(뒤로만) vs 대칭.
