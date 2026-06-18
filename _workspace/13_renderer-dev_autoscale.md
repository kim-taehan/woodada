# 13 · renderer-dev · 인원수 기반 트랙 레인/캐릭터 자동 스케일

## 요약
"동시에 트랙 위 인원"(필드 크기)에 따라 캐릭터 크기를 줄이고 레인 밴드를 넓혀 겹침을 줄였다.
필드 크기는 **경주 시작(buildScene) 시 1회 산출해 경주 내내 고정**(중간 리사이즈/깜빡임 없음).

- 비릴레이: 필드 = `participants.length` (≤16)
- 릴레이: 필드 = **활성 팀 수**(서로 다른 teamId 개수, ≤4) — 16명 릴레이여도 본선 4명이라 안 작아짐

## 변경 파일
- `src/renderer/RaceRenderer.ts` — 필드-스케일 계수 산출 + 캐릭터 스케일/레인밴드/이름표 오프셋에 전달
- `src/renderer/track/OvalTrack.ts` — `ovalForCanvas(w,h,bandMul=1)` 인자 추가(레인밴드 폭 배율)

`TrackScene.ts`는 손대지 않아도 됨: 레인선·마진·결승선이 모두 `laneSpan`에서 파생 → 밴드가 넓어지면 자동으로 같이 넓어짐.

## 산출식 (한 곳: RaceRenderer.ts)
상수: `FIELD_MIN=6`, `FIELD_MAX=16`, `SIZE_FLOOR=0.62`, `BAND_CEIL=1.5`

```
crowding(f) = smoothstep( (f-6)/(16-6) )      // 0 at f≤6, 1 at f≥16, 부드러운 곡선
fieldSizeScale(f) = 1 - (1-0.62)*crowding(f)  // 캐릭터 크기 배율: 1.0 → 0.62
fieldBandMul(f)   = 1 + (1.5-1)*crowding(f)   // 레인밴드 폭 배율: 1.0 → 1.5
```

- **필드 ≤6 → 계수 1.0** (현 로스터/골든 회귀 없음).
- **smoothstep** 곡선이라 6→16 사이가 부드럽게 줄고, 양 끝 기울기 0.
- **SIZE_FLOOR=0.62** 가독성 하한 클램프 — 16명에서도 이름표 읽힘.
- 캐릭터별 `renderScale`(코끼리/곰 1.15)은 그대로 두고 `fieldScale`를 **곱**해 적용.

### 레인 밴드 분배
엔진은 `homeLane`을 `[0.1,0.9]`에 필드 크기와 무관하게 고르게 흩뿌림(연속값). 렌더러는
`laneOffset(lane)=(lane-0.5)*laneSpan` 로 픽셀 매핑. `laneSpan`에 `fieldBandMul`을 곱하면
**같은 0~1 분포가 더 넓은 픽셀 폭으로 펼쳐져** 좌우 겹침이 줄어든다(엔진 계약 불변: 레인은 속도에 무영향).
이름표 오프셋(`66*scale`)에도 `fieldScale`을 곱해 작은 캐릭터 머리 위에 딱 붙게 했다.

## 시각 검증 (스크린샷 + 육안 코멘트)
seed=7, 중반 프레임(총프레임*0.4) 캡처. characterIds는 dog/rabbit/monkey/elephant/bear 순환.

1. **기본 5명 비릴레이** — `tests/e2e/__screens__/autoscale-05-nonrelay.png`
   → 캐릭터 풀사이즈, 3레인 밴드, 넓은 인필드 잔디. **현행과 동일(회귀 없음).** ✅

2. **16명 비릴레이** — `tests/e2e/__screens__/autoscale-16-nonrelay.png`
   → 캐릭터가 작아지고 레인 밴드가 넓어져 16명이 인코스(강아지16)~아웃코스(토끼12)까지
   고르게 퍼짐. **좌우 겹침이 눈에 띄게 감소.** 모든 이름표(강아지/코끼리/곰/원숭이/토끼+번호) 읽힘. ✅
   (시작부 진행도 뭉침은 짧은 단일랩 특성 — 레인 폭이 아니라 progress 축 문제)

3. **4:4:4:4 릴레이(16명)** — `tests/e2e/__screens__/autoscale-16-relay4x4.png`
   → 활성 팀 4 → fieldScale=1, fieldBand=1. **본선 4명(곰5·원숭이8·토끼-질주)이 작은 경주처럼 크고 쾌적.**
   인필드 대기열 8명은 정상적으로 작게 파킹. **릴레이 안 작아짐 — 핵심 뉘앙스 성공.** ✅

(10명 비릴레이도 확인: 적당히 작아지고 밴드 넓어짐 — 중간 PNG는 검증 후 삭제, 위 3장만 골든 보존.)

## 검증 게이트
- `npm run typecheck` 통과.
- `npx playwright test race-visual.spec.ts --project=desktop` 3개 모두 통과(기존 캡처 회귀 없음).

## 못 잡은/한계 (사실 보고)
- 16명이 **출발 직후~짧은 단일랩 초반**엔 같은 progress 구간에 몰려 세로(진행축)로 뭉쳐 보임.
  레인 폭 확대는 좌우 겹침만 줄임 — 진행축 뭉침은 경주가 진행되며 자연히 풀림(엔진 분산 영역).
- `BAND_CEIL`을 1.7→1.5로 낮춰 인필드 잔디 보존과 밴드 확장의 균형을 잡음. 더 넓히면 겹침은 더
  줄지만 인필드가 거의 사라짐 — 1.5가 현재 트레이드오프 지점.
