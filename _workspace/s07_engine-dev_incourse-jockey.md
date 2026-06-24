# s07 engine-dev — 저트래픽 인코스 자리싸움(jockeying)

## 목표
1대1/저트래픽 경주가 평행 주행으로 정적인 문제 해결. 추월 막힘이 없어도 추격자가
선두의 레인 쪽으로 다가가 '승부를 거는' 자리싸움 연출 추가. **속도/순위 로직 불변**,
오직 `lane` 타깃만 조정.

## 변경 파일
- `src/engine/overtake.ts`
- `src/engine/tuning.ts` (OVERTAKE에 `jockeyRange`, `jockeyLean` 추가)

## 무엇을 어떻게 바꿨나
`applyOvertake`의 **막힘 없음(else) 분기**에만 jockey 로직 추가:

1. `nearestRival(all, self)` — 레인 밴드 무시하고 progress 기준 `jockeyRange`(9.0) 이내
   바로 앞 레이서를 찾는다. (기존 `nearestAhead`는 같은 레인 밴드일 때만 찾으므로 1대1에선
   안 걸림 → 그래서 새 헬퍼 필요.)
2. 라이벌이 있으면 `target` 레인을 라이벌 레인 쪽으로 `lean`만큼 끌어당김:
   `target = target + (rival.lane - target) * lean`.
3. `lean`은 거리의 **연속 함수**: `jockeyLean * (1 - gap/jockeyRange)`.
   point-blank에서 최대(0.6), 윈도 끝에서 0으로 부드럽게 감쇠.
   → on/off 경계가 없으므로 **히스테리시스 상태 없이도 wobble 안 생김** (새 RacerState 필드 불필요,
   types.ts 안 건드림).
4. 최종 `self.lane = moveToward(self.lane, target, laneDrift)`로 기존 드리프트가 한 번 더 완만화.

### 트래픽 많을 때 과겹침 방지
`jockeyRange`(9.0) > `nearAhead`(4.0)로 설계. 라이벌이 4.0 이내로 바짝 붙어 **같은 레인 밴드**가
되면 기존 위빙/블로킹(blocker) 분기가 지배하고, jockey 분기(else)는 실행되지 않는다. 즉 막힘이
있는 밀집 구간은 기존 로직, 막힘 없는 저트래픽 구간만 jockey가 채운다 — 겹치지 않음.

## 속도중립 · 결정론 보존 근거
- **속도 경로 무수정**: `laneSpeedFactor`는 그대로 항상 1. progress 어드밴스/jitter/catchup/슬로우
  어떤 것도 `lane`을 읽지 않음. jockey는 `target`(레인)만 만지고 speed는 안 만짐.
- **결정론**: 새 무작위성 0 (rng 추가 draw 없음). lean은 순수 결정론적 거리 함수. 같은 (config+seed)는
  동일 lane 궤적 → determinism 테스트(lane을 4자리까지 해시)에 부합, 통과.
- **인코스 중립**: 라이벌 레인이 인코스든 아웃코스든 그 **쪽으로** 끌릴 뿐, 인코스로 쏠리는 편향 없음.

## 솔직한 주의점 (결과 결합)
`self.lane`은 아이템 박스 수거 판정(`RaceEngine.ts:630` `|self.lane - box.lane| <= ITEM.collectLane`)에
쓰인다. 따라서 lane을 바꾸는 모든 연출(jockey)은 **어떤 박스를 줍는지 → 속도 → 순위**에 간접적으로
영향을 줄 수 있다. 단, 이는 **기존 wander/위빙도 이미 가진 동일한 결합**이며 새 종류의 결합이 아니다.
공정성(engine-bias)이 통과하므로 이 결합 하에서도 독주/편향 없음이 유지됨. (완전 무영향을 원하면
별도 작업으로 박스 판정에서 jockey 오프셋을 빼는 변형을 검토 가능 — 현재 범위 밖.)

## 검증 결과
- `npm run typecheck` — 통과.
- `npm run test` — **51/51 통과** (determinism 4, engine-bias 7 포함). 동시 진행 중인 eagle/divebomb
  제거로 인한 일시 실패는 관측되지 않음(내 변경과 무관하게 전부 green).
- `npx vite-node scripts/balance.ts` — 현재 로스터(8: dog cat monkey bear penguin hedgehog spider alien,
  eagle은 동시 제거됨) 기준 정상. individual laps=10에서 최고 spider 21%(1.68×), 아무도 >0.45 없음,
  `runaway: winner led 0.301, 35.0 lead-changes/race` — 독주 없음·역전 풍부. 느슨한 공정성 밴드 유지.
- 2인 경주 간이 검증(20시드, jockey 윈도 안/밖 레인갭 비교):
  - 가까울 때(progGap<9) 평균 레인갭 **0.588**
  - 멀 때(progGap>=9) 평균 레인갭 **0.757**
  - → 추격자가 근접 시 선두 레인으로 확실히 붙음(자리싸움 발생). 의도대로 동작.

## 튜닝 노브 (tuning.ts OVERTAKE)
- `jockeyRange: 9.0` — 자리싸움 윈도(클수록 멀리서부터 붙음). nearAhead(4.0)보다 커야 함.
- `jockeyLean: 0.6` — 최대 끌림 강도(1.0=라이벌 레인에 완전 합류, 0=비활성). 더 도드라지게 하려면 ↑.
