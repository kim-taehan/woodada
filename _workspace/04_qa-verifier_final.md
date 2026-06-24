# 04 — QA 최종 게이트: 독수리(A) + 결승선 우측이동(B)

## 게이트 요약
| 게이트 | 결과 |
|---|---|
| typecheck (`tsc --noEmit`) | ✅ 통과 |
| Vitest 전체 (43 tests) | ⚠️ **42 통과 / 1 실패** — engine-bias (독수리 승률 0.0983 < 0.1) |
| Playwright `race-visual.spec.ts --project=desktop` | ✅ 5/5 통과 (골든 갱신은 의도된 회귀) |
| 경계면 교차검증 (divebomb variant, FINISH_OFFSET 단일소스) | ✅ 정합 |
| 스크린샷 육안 (A 독수리 / B 결승선·스캐터) | ✅ 통과 |

---

## 1) typecheck — 통과

## 2) Vitest — 1건 실패 (engine-bias). **근본 원인 = 변경 B (FINISH_OFFSET), 변경 A 아님**

실패 단언:
```
engine fairness > every character can win and none dominates
AssertionError: expected 0.09833333333333333 to be greater than 0.1
  tests/unit/engine-bias.test.ts:31  expect(rate).toBeGreaterThan(0.1)
```

### 원인 분리 (bisect, N=1200 결정론 시드 0..1199)
| 구성 | 독수리 승률 |
|---|---|
| HEAD(baseline, 변경 전) | **0.1183** (통과) |
| 변경 A+B 전부 (현재 브랜치) | **0.0983** (실패) |
| 변경 A만 (eagle data+divebomb) + **옛 FINISH 0.12** | **0.1183** (통과, baseline과 동일) |
| **새 FINISH 0.21** + 옛 divebomb (A 데이터만) | **0.0983** (실패) |

→ 결론: **divebomb.ts·eagle 데이터 변경(A)은 밸런스 중립**(승률 비트 단위로 baseline 동일). 회귀는 **`FINISH_OFFSET_FRAC` 0.12→0.21(B)** 단독 책임. 결승선이 ~9%랩 뒤로 가며 캐치업/러버밴딩이 다르게 수렴해 독수리만 0.118→0.098로 하락, 0.1 floor를 0.0017 차이로 통과 실패.

전체 승률(현재): dog 0.229 / cat 0.248 / monkey 0.140 / eagle **0.098** / bear 0.127 / penguin 0.158.

### 성격: 경계선 미스 (하드 회귀 아님)
- 이 테스트는 "정밀 밸런스 게이트가 아니라 loose-sanity"로 명시(파일 §13-16 주석, "balance tuned later"). floor 0.1은 임의의 느슨한 하한.
- 독수리는 1200판 중 118판 우승 → "이길 수 있다"는 성립. 0.098은 floor를 0.0017 밑돈 것.
- 나머지 두 bias 테스트(슬롯 공정성 / anti-runaway)는 통과. 결승선 이동이 슬롯편향·독주를 유발하진 않음.

### 회부
- **balance-tuner**: FINISH_OFFSET 0.21에 맞춰 독수리 `skill.params`(divebomb diveBurst/stunMs 등)만 미세 상향해 floor 복구 권장. 엔진 로직·결승선 위치는 건드리지 말 것(B는 의도된 디자인 변경).
- 또는 디자인 판단으로 floor를 0.09로 완화하는 선택지(테스트 의도가 "이길 수 있음" 확인이라면 정당). 단 이는 테스트 계약 변경이므로 team-lead 승인 필요.

## 3) Playwright — 5/5 통과 (골든 스크린샷 갱신 = 의도된 회귀)
divebomb 4컷 + 결승선 위치 이동으로 `tests/e2e/__screens__/` 다수 갱신됨(diff stat의 .png). regression 실패 아님 — 테스트는 모두 green.

---

## 4) 스크린샷 육안 (캔버스는 이미지로만 검증)

### A — 독수리 공중→지상 전환: ✅
- `race-mid.png`, `race-finish.png`, `race-finish-scatter.png`: 독수리(독수리5)가 흰 정면 치비 **biped로 땅 baseline에 서서** 곰·펭귄·원숭이·강아지와 동일 높이로 달림. **공중 부유 없음**(fly 리프트 제거 확인).
- `race-divebomb-apex.png`/`-impact.png`: 머리 위 말풍선 "받아랏! 🦅" + 하단 자막 "독수리5 머리로 허공만 들이받았다!" — **지상 점프 박치기** 내러티브 일관, 골드 박치기 FX 읽힘. 하늘에서 내리꽂는 모션 아님.
- `race-divebomb-self.png`: 자막 "독수리5 헛박치기로 자폭! 별이 빙글빙글~" — self-risk 도박이 박치기 톤으로 정합.
- 깨짐/사라짐 없음.

### B — 결승선 우측 이동(약 3/4 지점): ✅
- 전 컷 공통: 체커 밴드(결승 테이프)가 **아래 직선의 우측 ~3/4 지점**(우코너 근처)에 그려짐. `race-mid.png`에서 좌측의 흰 점선 **출발선**과 명확히 분리 → start≠finish 정합. 이전(0.12, 중앙 부근) 대비 확연히 오른쪽.

### B 부작용 — 코스팅/스캐터: ✅ 문제 없음
- `race-finish.png`/`race-finish-scatter.png`: 골인 레이서들이 결승 테이프 직후 모여 코스팅하지만 **전부 트랙 면 위**에 머묾 — 인필드(초록)·아프론(회색)·우커브로 **튀어나가거나 우커브에 부자연스럽게 뭉치지 않음**. 좁아진 코스팅 꼬리에도 자연스러운 산개. team-lead가 우려한 out-of-bounds/curve-clump 미발생.

---

## 5) 경계면 교차검증: ✅
- **엔진↔렌더러 (divebomb variant)**: divebomb.ts는 코멘트만 변경, emit variant('activate'/'hit'/'dodge'/'self-botch') 무변. 렌더러 핸들링 정합(스크린샷에서 hit/whiff/self-botch FX·자막 모두 렌더됨).
- **FINISH_OFFSET 단일소스**: `src/engine/types.ts`에서만 export(=0.21). `RaceEngine.ts`(시뮬)·`renderer/track/TrackScene.ts`(렌더)가 동일 import. `OvalTrack.ts`는 주석 언급뿐(하드코딩 중복 없음). 엔진/렌더러 결승선 단일 진실원천 유지.
- schema/skills 테스트: 스킬 type·카탈로그 무변이라 통과(예상대로).

---

## 최종 판정
- **A(독수리)**: 전 항목 통과. 시각·밸런스 모두 클린.
- **B(결승선)**: 시각·코스팅 통과. **단** engine-bias 독수리 승률이 floor를 0.0017 미달(0.098<0.1) → balance-tuner 회부 또는 floor 완화(team-lead 결정) 필요. 다른 밸런스 속성(슬롯/독주)은 영향 없음.
- 시각 확인 완료. 미해결 이슈 1건(bias floor) 명시 보고 — 완료처리 보류.
