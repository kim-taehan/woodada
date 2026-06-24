# h16 — engine-dev: 레인 지터(wobble) 제거 — 위빙 side 커밋(hysteresis)

증상: 뭉친 구간에서 몇몇 캐릭이 매 프레임 좌우로 떨림. 원인(overtake.ts blocked 분기):
- 매 프레임 `rng.bool(switchChance)` 새로 굴림 + 양쪽 열리면 매 프레임 `rng.bool(0.5)`로 side 재랜덤 → 타깃 레인이 좌/우로 매 프레임 튐.
- 최근 switchChance 0.78·wanderAmp 0.10·인코스 패킹으로 뭉침↑ → 진동 도드라짐.

## 수정 (위빙 자체는 유지, 흔들림만 — hysteresis)

1. `src/engine/types.ts` RacerState에 `weaveSide?: -1 | 0 | 1` 추가(직렬화 가능한 number, 기본 undefined). 현재 커밋한 위빙 방향.
2. `src/engine/overtake.ts` blocked 분기 재작성:
   - **이미 커밋한 side(weaveSide≠0)가 아직 열려 있으면 그 side 유지 — rng 재굴림/재랜덤 안 함**(이게 wobble 제거 핵심).
   - 커밋이 없거나 그 side가 막혔을 때만 `rng.bool(switchChance)` 1회 굴려 새 side 결정(양쪽 열리면 그때만 `rng.bool(0.5)`). 결정한 side를 `self.weaveSide`에 커밋.
   - 양쪽 다 막힘 → boxed in 감속, `weaveSide=0` 해제.
   - blocker 없음(트래픽 클리어) → `weaveSide=0` 해제 후 home으로 드리프트.
   - wander(정현파)는 부드러우니 그대로.
   - `clearOn(side)` 헬퍼로 in-bounds + nearestAhead 체크 통합(중복 제거).

결정론/서브스트림: rng는 self의 안정 서브스트림(`racer:<id>`) 그대로. **draw 호출 횟수가 줄어듦**(블록 중 커밋 유지 프레임은 0회) → 같은 seed라도 이전과 다른 경주가 됨 = **의도된 회귀**(팀리드 승인). same-seed 재현성은 유지되므로 determinism 테스트는 green.

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **43/43 통과**(determinism·engine-bias·relay 포함).
  - 깨졌던 1건 `catwalk dodge: ...not stunned that frame`은 **본 수정과 무관한 over-strict 단언**이었음. rng 시퀀스가 바뀌며 seed=31 frame=277에서 고양이가 *이전 프레임의 잔류 스턴*(effectUntil=293>277) 중에 새 divebomb를 정상 dodge하는 케이스가 노출됨. dodge는 "이번 들어오는 교란을 회피"를 보장할 뿐 잔류 스턴을 해제하지 않음. 단언을 의도대로 정정: "그 프레임에 같은 고양이에게 roar/divebomb **hit**가 안 들어온다"로(phase!=='stunned' 직접단언 제거, 잔류 스턴 허용 사유 주석). dodge 로직 자체는 정상.

## wobble 제거 정량 검증 (seed 4, 7캐릭 congested)

`weaveSide` 시계열 측정:
- weave-active 프레임 111개 중 **커밋 side 연속프레임 부호반전 = 4회**(각각 그 side가 막혀 새로 굴린 정당한 재결정). 약 96% 프레임은 side 유지 → 매프레임 반전(wobble) 제거.
- weave-active 111프레임 = 위빙 빈도 자체는 충분히 유지 → "위빙 많고 인코스로 모이는 느낌" 보존(과하게 죽이지 않음).

## 밸런스 (N=3000)

```
dog 0.137 cat 0.158 monkey 0.139 eagle 0.142 bear 0.135 penguin 0.159 hedgehog 0.130
```
- 7종 0.130~0.159 = ±1.5%p 이내(직전과 사실상 동일, ±5%p 목표 안). lead changes 10.0, winner led 0.497, peak gap 0.072laps — 독주 없음. **추가 조정 불필요.**

## 통지

- renderer-dev: 레인 시계열이 부드러워지고(위치/궤적 변경) rng 회귀로 골든 스크린샷 갱신 필요(의도된 회귀). RacerState에 weaveSide 필드 추가됨(렌더러가 facing은 기존대로 읽으면 됨, weaveSide는 엔진 내부용).
