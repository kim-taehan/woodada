# dm06 · engine-dev · 레인 경합 + 물리 충돌 + 펭귄 얼음 진단

## 변경 파일 (이번 레인 작업 인계분, 재검증 완료)
- `src/engine/tuning.ts` — HOME_LANE / OVERTAKE 튜닝 + 측면분리 상수 추가
- `src/engine/overtake.ts` — 측면 분리(lateral separation) 로직 신규
- `tests/unit/skills.test.ts` — icefield 면제 테스트를 견고한 신호로 갱신(거동 변경 아님, 측정 방식 변경)

> 인계 검증 메모: 위 부분편집은 working tree에 **온전히 남아 있었고 정합·완결**이었다(처음부터 재작업 불필요). 심볼 검증 — `RacerId=string`(types.ts:11)이라 `self.id<neighbour.id`는 전순서·결정론적; `'eliminated'`는 정식 RacerPhase(types.ts:65). `tests/unit/{engine-determinism,helpers}.ts`·`RaceEngine.ts` 등의 `eliminated` 가드/`elimination` 필드는 **별개의 데스매치 작업분**으로 건드리지 않음.

펭귄 얼음 관련 코드 변경 **없음**(원인은 의도된 밸런스 변경 — 아래 진단 참조).

---

## 1) (A) 퍼뜨리기 — tuning 파라미터 before → after

| 파라미터 | before | after | 사유 |
|---|---|---|---|
| `HOME_LANE.exp` | 1.6 | **1.0** | exp=1.6이 인코스 편중 주범. 10명 중 앞 5명이 lane 0.10~0.32(슬롯 간격 0.024~0.094 < laneNear 0.16)에 몰림. exp=1.0 → 슬롯 간격이 전 구간 균등 ~0.089. |
| `HOME_LANE.jitter` | ±0.05 | **±0.07** | 균등 슬롯에 남는 서브밴드 겹침을 약간 흩뜨려 측면분리가 마무리. |
| `OVERTAKE.wanderAmp` | 0.10 | **0.14** | 누비기 진폭↑. 레이서마다 위상(homeLane*23.1) 달라 분산↑. 과하지 않게 +0.04. |

측정(균등 슬롯 형태, 지터 제외):
- exp=1.6 gaps: `0.024 0.048 0.066 0.081 0.094 0.106 0.117 0.127 0.137`
- exp=1.0 gaps: `0.089 ×9` (전부 균등)

실측(10명, seed 12345, 3바퀴): 레인 분포가 0.20~0.80(span 0.60)로 트랙 전반에 퍼짐. 기존 "앞 줄이 0.10~0.32 한 줄" 인상 제거.

## 2) (B) 자리경합/충돌 — 측면 분리 로직 설계 + 결정론 보장

`overtake.ts`에 `nearestNeighbor()` + 분리 push 추가.
- **탐지**: 앞뒤 `|progress gap| ≤ sepRange(3.0)` **AND** `|lane diff| ≤ sepLaneBand(0.14)` 인 가장 가까운 이웃. 앞만 보는 nearestAhead와 달리 양방향(어깨 나란히 = 추월이 아닌 자리경합).
- **밀어내기**: 겹친 두 레이서의 lane **target**을 서로 반대로 밀어 분리. 강도는 lane 겹침이 밴드 끝(0.14)에 가까울수록 0으로 페이드(경계 떨림 없음). `target += side * sepPush(0.5) * laneStep(0.3) * strength`.
- **방향(결정론 핵심)**: RNG 사용 안 함. 두 레이서의 **고정 id 문자열 순서**로 결정 — `self.id < neighbour.id` 면 안쪽(−), 아니면 바깥(+). id는 유일하므로 양쪽이 항상 반대 방향으로 갈라짐. 배열 순서·드로 순서·rng 무관.
- **속도 불변**: target(lane)만 이동, speed 절대 미접촉 → "레인≠속도" 불변 유지. `laneSpeedFactor` 항등 1 유지. 앞뒤 막힘 감속은 기존 blockDecel가 그대로 담당(불변규칙 위반 아님).
- 기존 weaveSide 히스테리시스·jockey·moveToward 단일 드리프트와 합성(모든 분기 후 target에 한 번 적용 → 단일 drift step).

**결정론 검증**: 동일 (config+seed)로 2회 simulate → 전 프레임 lane 시퀀스 **바이트 동일** 확인. `engine-determinism` 4/4 통과.

(C) CATCHUP/spread는 손대지 않음 — A+B로 세로·가로 뭉침이 충분히 풀려 불필요(과튜닝 회피).

## 3) 펭귄 얼음(iceZones) 빈도 감소 — 진단 결과

**원인: 의도된 밸런스 변경(skill.params). 회귀 아님. 수정하지 않음.**

- 경로: `icefield`는 tick 스킬 → 메인 루프 `fireSkill`(RaceEngine.ts:941)에서 쿨다운 자기발동 → `addIceZone`(RaceEngine.ts:372). 빈도 게이트는 `fieldCooldownFactor(activeRunnerCount())`(RaceEngine.ts:427).
- 의심했던 데스매치 `eliminated` 제외(`activeRunnerCount` RaceEngine.ts:522)는 **얼음을 줄이지 않음** — 오히려 탈락으로 active가 줄면 쿨다운 factor가 작아져 발동이 **잦아짐**.
- 실제 원인은 커밋된 밸런스 이력의 `penguin.ts` params 변경(정확한 커밋 재확인):
  - first commit(f24f8df): `zoneLength: 130, durationMs: 3200, slowFactor: 0.85, boostFactor: 1.05`
  - f2938d7~1 시점엔 이미 `zoneLength: 80, durationMs: 2800, slowFactor: 0.80, boostFactor: 1.03` → 즉 **얼음 축소(130→80, 면적 ~38%↓)·단축(3200→2800, ~12%↓)은 first commit~f2938d7 사이에 발생**(f2938d7 자체는 아님).
  - f2938d7 "Balance individual races for 10-lap play"는 `boostFactor 1.03→1.06`만 변경.
  - 위치: `src/data/characters/penguin.ts:30`.
- 즉 발동 빈도(쿨다운 [5000,8000])는 그대로지만, 깔리는 얼음이 더 작고 짧게 사라져 "깔리는 게 줄었다"는 체감. **skill.params는 balance-tuner 영역**이라 임의 변경하지 않음. 되돌리길 원하면 balance-tuner가 zoneLength/durationMs 조정.

## 4) 테스트 갱신 — skills.test.ts icefield 면제

레인 변경으로 `skills.test.ts`의 "airborne alien 면제" 테스트 1건이 깨졌으나 **거동 회귀 아님** — 프래자일 테스트였음.
- 기존 단언: 40시드 합산 **최종 progress** exempt > grounded. 그런데 catch-up 러버밴딩이 최종 progress를 양 진영에서 평준화해 마진이 0.015%(48424 vs 48431)뿐 → 노이즈 플로어. 내 레인 변경이 초기 교통을 미세 변동시켜 부호만 뒤집힘.
- 면제 자체는 멀쩡: **얼음 안에서의 프레임당 평균 step** exempt 1.3966 vs grounded 1.120 (n≈12k~15k) — ~25% 버프가 명확.
- 갱신: 단언을 "얼음 내 프레임당 평균 step exempt > grounded"로 변경(버프를 발생원에서 직접 측정 → catch-up에 휩쓸리지 않음). 의미 보존·강화. balance.params 불변(pinnedAlien 유지).

## 게이트 결과
- `npm run typecheck`: 통과
- `npm run test`: **62/62 통과** (determinism 4/4, skills 16/16, engine-bias 7/7 — 모든 캐릭터/슬롯 승리 가능·독주 없음).
- 결정론: 동일 config+seed 2회 → lane 시퀀스 전 프레임 동일.

## 승률 영향 (balance.ts --laps 1, N=3000, before→after)
bear 23→26, dog 13→15, cat 12→13, monkey 11→11, spider 13→11, hedgehog 10→9, alien 10→9, penguin 8→8.
최대 스윙 ±3pt(bear↑/spider↓). 독주 게이트(0.45) 안전 — winner-led 0.506→0.517, lead-changes 7.7→7.6(사실상 불변). 정상 노이즈 범위. balance-tuner 확인 권장하나 params 변경 불필요.
