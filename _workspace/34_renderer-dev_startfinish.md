# 34 · renderer-dev · 시작선 ≠ 결승선 (+ 좌측 상단 곡선 수정)

## 요약
엔진이 마지막 바퀴를 시작선보다 `FINISH_OFFSET_FRAC(0.12)`만큼 더 달리게 바뀐 것에 맞춰, 렌더러에서
**시작/랩선(u=0)** 과 **결승 테이프(u=0.12)** 를 시각적으로 분리해 그렸다. 작업 중 사용자가 보고한
**좌측 상단 곡선 깨짐**도 함께 잡았다(원인: 내가 세그먼트 재배열하며 좌커브 d 오프셋을 잘못 뺀 버그).

## 변경 파일
- `src/renderer/track/OvalTrack.ts` — `pointAt` 세그먼트 재배열(u=0 = 바닥직선 왼끝, 주행 왼→오) + **좌커브 d 오프셋 버그 수정**.
- `src/renderer/track/TrackScene.ts` — 시작선(점선 흰 라인 @u=0) / 결승 테이프(체커 밴드 @u=0.12) 분리, relay 분기, 곡선 샘플 160→320.
- `src/renderer/RaceRenderer.ts` — `buildTrackScene(track, w, h, config?.relay ?? false)` 한 줄(relay 전달).

## u=0 / u=0.12 배치 방식
- `pointAt`의 세그먼트 순서를 바꿔 **u=0 = 바닥직선 왼쪽 끝(시작/랩선)**, 진행은 바닥직선 **왼→오**.
  순서: `바닥직선(전체, 왼→오) → 우커브(아래→위) → 윗직선(오→왼) → 좌커브(위→아래, 시작선으로 복귀)`.
- 1~(N-1)바퀴는 u=0(왼끝)에서 끝나고, 마지막 바퀴만 좌커브→왼끝 시작선 통과→바닥직선을 달려
  **u=0.12(직선 약 43% 지점, 중간 살짝 왼쪽) 결승 테이프**로 들어옴 = 긴 직선 run-in.
- 엔진 import는 상수 `FINISH_OFFSET_FRAC`만(순수성 유지, 시뮬 피드백 0). 검증: u=0.12 → 바닥직선 시작에서 296px(직선 길이 691px의 ~43%).

## 시작선 vs 결승선 (시각 구분)
- **시작/랩선**: 트랙 가로지르는 **흰색 점선**(6분할, width 7, alpha 0.92).
- **결승 테이프**: **흑백 체커 밴드**(10칸 × 2행 staggered, 접선 방향 두께 laneSpan*0.16) — 깃발처럼 보임.

## relay 분기
- `config.relay`로 분기. **개인/팀 = 결승 u=0.12**, **relay = 결승 u=0**(엔진이 relay엔 오프셋 미적용, 결승=랩경계).
- relay일 땐 시작선(점선)을 **생략**하고 체커 테이프만 u=0에 그림(겹침 방지) → 시작=결승 한 줄.
- 확인: `relay-start.png`/`relay-leg.png`에서 체커 테이프가 바닥직선 왼끝(u=0)에 1개, 별도 점선 없음.

## 코스트/산개 정합 (#33)
- `placeFinished()` 앵커는 손대지 않음 — 기존 "바닥직선 오른쪽 절반으로 산개" 로직이 새 배치와
  자연스럽게 정합. 결승 테이프가 u=0.12(중간 왼쪽)로 옮겨지면서 그 **오른쪽 빈 구간**이 코스트 존이 됨.
  finisher는 결승 통과 후 오른쪽으로 코스트(주행 방향=왼→오와 일치), 1등 furthest-right, 뒤로 갈수록 중앙쪽.
- `race-finish-scatter.png`에서 통과·산개·순위감정(✨/💧) 정상 확인.

## 좌측 상단 곡선 버그 (사용자 보고건)
- **증상**: 좌커브↔윗직선 접합부가 깨져 보임(곡선이 직선과 안 이어짐).
- **원인**: 좌커브 `else` 분기에서 직전 세그먼트(윗직선) 길이만큼 `d -= straight` 해야 하는데
  재배열 과정에서 `d -= curve`로 잘못 뺐음 → 좌커브 시작 위치가 ~137px 점프(불연속).
  finite-diff로 확인: u=0.780(x=294.5)→u=0.784(x=157.5) 점프, heading 180°→153.8° 끊김.
- **수정**: `d -= straight`. 수정 후 위치 연속(294.5→284.7→274.8…), heading 180°→178.4°→175.1° 매끄러움.
- 클로즈업 육안 확인 완료(임시 캡처 후 정리).

## 시각 검증 (Read로 직접 확인)
- `race-start.png` — 흰 점선 시작선 @바닥직선 왼끝, 체커 테이프 @직선 중간. 레이서 시작선에 정렬. **분리 명확**.
- `race-finish.png` / `race-finish-scatter.png` — 왼→오 주행, 결승 통과 후 오른쪽 코스트·산개·순위감정 자연스러움.
- `race-lastlap.png` — "🔔 마지막 바퀴!" 배너 + 랩카운터 정상(랩 경계 불변), 직선 run-in.
- `race-curve-left.png` / `race-curve-top.png` — 네 곡선 전부 매끄러움(좌상단 kink 제거됨).
- `relay-start.png` / `relay-leg.png` — relay 결승=시작(u=0) 체커 테이프 1개, 별도 시작선 없음. FX/조끼/주자카운터 정상.
- 좌상단 클로즈업(임시) — 차선·밴드·잔디 모두 곡선↔직선 seam 없이 연속.

## 게이트
- `npm run typecheck` → 0 에러.
- `race-visual.spec.ts` + `relay-visual.spec.ts` (desktop) → 전부 통과, 골든 재캡처 완료.
- 임시 파일(`_tmp_topleft.spec.ts`, 임시 png) 정리 완료.

## 주의 (회귀 아님 / 내 변경과 무관)
- 전체 `npm run e2e`에서 `shell.spec.ts`(이름입력·IME) + `play.spec.ts`(DOM 플레이) **8건 실패**가 보이나,
  이는 이 공유 워킹트리에서 **다른 에이전트의 shell/DOM(SetupScreen·store) 변경** 영향이며 트랙 지오메트리와 무관.
  렌더러/트랙 시각 테스트(race-visual·relay-visual)는 전부 통과. → shell-dev/qa-verifier에 인계 필요.

## 스크린샷 경로
- `tests/e2e/__screens__/race-start.png`
- `tests/e2e/__screens__/race-finish.png`
- `tests/e2e/__screens__/race-finish-scatter.png`
- `tests/e2e/__screens__/race-lastlap.png`
- `tests/e2e/__screens__/race-curve-left.png`
- `tests/e2e/__screens__/race-curve-top.png`
- `tests/e2e/__screens__/relay-start.png`
- `tests/e2e/__screens__/relay-leg.png`
