# 곰(bear) roar 충격파 FX 반경 확대 — renderer-dev

engine-dev가 roar 광역 게임플레이 range 13→18(×1.38)로 넓힘(`01_engine-dev_roar-range.md`).
시각 충격파가 게임플레이 확대를 못 드러내던 문제를 FX 측에서 보강.

## 변경 파일
- `src/renderer/fx/FxLayer.ts` — `shockwave(x, y, now)` 단 1줄 영역만 수정.

## before / after 수치
| 항목 | before (작업 시작 시 파일 상태) | after | 변화 |
|---|---|---|---|
| 초기 반경 | 24px | **30px** | ×1.25 |
| grow (생애 동안 스케일 성장 배율) | 8 | **11** | ×1.375 |
| stroke width | 7 | **11** | 굵게(확장 웨이브 가독성) |
| ttl | 0.6s | 0.6s | 유지 |
| 색 | 0xfff0c0 (따뜻한 베이지) | 0xfff0c0 | 유지 |

> 참고: 작업지시서가 기재한 "현재값(18px/0.55/grow5)"은 stale. 실제 파일은 이미 24/0.6/8 상태였음(engine-dev 패스 직후 캡처된 `race-roar-activate.png` 20:24 기준이 before). 그래서 **실제 파일 상태에서** 확대해 캡처 회귀로 "이전보다 넓음"을 보장.

### 체감 반경(캡처 시점 ≈ mid-life, settle 250ms → k≈0.42)
- before: 24 × (1 + 0.42×8) ≈ **105px**
- after: 30 × (1 + 0.42×11) ≈ **169px** (약 +60% 넓음)
- 생애 끝(k=1)은 alpha 0으로 완전 페이드 → 최대 반경이 커도 화면을 가리지 않음(hollow stroke라 내부 캐릭터도 항상 보임).

엔진 ×1.38 확대 대비 시각은 약간 더 과감(시원한 광역 연출). 화면 덮음/캐릭터 가림 없음 확인.

## 불변 규칙 준수
- 시뮬레이션 피드백 0 — `shockwave`는 순수 시각, 엔진 결과 불변(`RaceRenderer.ts:207 roar:activate`에서 호출만).
- 회전 단위 함정 무관(원형 링, rot 미사용).
- 무작위 시각요소 추가 없음 → 결정론/골든 캡처 보존.

## 시각 검증 (육안)
- 명령: `npx playwright test race-visual.spec.ts --project=desktop` → 3 passed.
- typecheck: 통과(`tsc --noEmit`).
- 캡처: **`tests/e2e/__screens__/race-roar-activate.png`** (Read로 열어 확인).
- 검증 코멘트: 곰(곰) 위치에서 굵은 베이지 충격파 웨이브가 바깥으로 퍼져 주변 무리(원숭이4·곰6·코끼리5)를 감싸고 인필드 주황 경계까지 닿음. 이전(20:24) 캡처의 가늘고 작은 링 대비 명확히 넓고 굵음. hollow stroke라 동물 얼굴/몸은 링 안/뒤로 그대로 보이며 가려지지 않음. 따뜻한 베이지 정체성·0.6s 페이드 유지.
- 추가로 throwaway 디버그 스펙(young 80ms vs expanded 300ms)으로 확장 곡선을 분리 캡처해 "링이 실제로 바깥으로 스윕"함을 확인 후 스펙·임시 PNG 삭제(레포 클린).

## 후속/통지
- qa-verifier: `race-roar-activate.png` 갱신됨(골든 회귀 검토 대상). 경로 위와 같음.
- content-designer: 파츠/팔레트 변경 없음.
