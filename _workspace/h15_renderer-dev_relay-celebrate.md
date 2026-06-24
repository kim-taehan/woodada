# h15 renderer-dev — 릴레이 결승 테이프 0.21 + 이긴 팀 전원 깝치기

## 결과
릴레이 렌더러 2건 완료. typecheck 통과, 단위 44/44, Playwright 라이브로 (1)결승 테이프 0.21 이동 + (2)이긴 팀 전원 시상대 깝치기 육안 확인.

## 1) 결승 테이프 위치 (TrackScene.ts)
- `const finishU = relay ? 0 : FINISH_OFFSET_FRAC;` → **`const finishU = FINISH_OFFSET_FRAC;`** (릴레이도 0.21). engine-dev가 `relayAnchorGoal = trackLength*(1+FINISH_OFFSET_FRAC)`로 앵커 결승을 +0.21로 옮긴 것과 정확히 일치 확인.
- 시작/랩 라인(u=0, plain dashed)을 릴레이에도 그리도록 `if (!relay)` 가드 제거 → 릴레이도 start ≠ finish.
- 주석 "relay finishes on the lap boundary..." → 갱신.
- **고아 정리**: 이 변경으로 `buildTrackScene`의 `relay` 파라미터가 미사용이 됨 → 파라미터 제거 + 유일 호출부(RaceRenderer.ts) 인자 제거(외과수술적). FINISH_OFFSET_FRAC import는 finishU에서 계속 사용.

## 2) 이긴 팀 전원 깝치기 (RaceRenderer.ts showResult)
- **podium occupants를 릴레이-aware로**: 릴레이는 블록당 1팀이므로 `result.order`를 teamId로 dedupe(팀별 첫=앵커)해 최대 3팀. → 2팀 릴레이가 3등 블록에 우승팀 멤버를 잘못 올리는 버그 방지. 비릴레이는 기존 top-3 racer 유지.
- **우승팀 전원 클러스터**: 릴레이면 `top[0]`(앵커)의 teamId로 팀 멤버 전원 수집(top에 이미 오른 멤버 제외), 1등 블록 앞/주변 바닥(baseY+30)에 부채꼴로 옹기종기 배치(scale 0.6, zIndex 990+, 태그 숨김). 전원 `podiumChars`에 push → `podiumTick`이 매 프레임 celebrate 포즈로 계속 깝치게 함.
- 비릴레이(개인/팀)는 분기 밖이라 기존 동작 유지.

## 시각검증 (Playwright 라이브, 임시 캡처 후 삭제)
2팀×3멤버 릴레이(1랩)로 setup→출발→완주→"시상식 보러가기"→시상대:
- **결승 테이프**(race/gate 프레임): u=0 시작선(왼쪽 dashed) ≠ 0.21 체커 테이프(오른쪽 3/4 지점). 우승자가 체커 테이프에서 골인. → task1 확인.
- **시상대 A/B**(600ms 간격): 1등 골드 블록에 앵커(느림보돌이, 레드 vest 독수리) + 그 앞 바닥에 **같은 레드팀 멤버 2명(원숭이·펭귄, 모두 레드 vest) 옹기종기**. 2등 실버 블록에 블루팀 앵커 1명. 결과카드 "우승 팀: 레드", 2팀이라 블록 2개만(3등 없음 — dedup 정상). A→B로 앵커·클러스터 포즈·컨페티 변화 → 전원 계속 깝침 확인. → task2 확인.

판정: **두 건 모두 PASS. 깨짐 없음.**

## 인계 (qa-verifier)
- typecheck OK / vitest 44/44 OK.
- 골든 스크린샷: 릴레이 결승 위치 이동 + 시상대 변경으로 갱신 필요(의도된 회귀) — qa 게이트에서 재생성.
- 비릴레이 시상대·트랙은 무영향(릴레이 분기 한정).
- (참고: 본 작업물은 오케스트레이터 커밋 "Add speed/power stats..."에 이미 포함되어 working tree clean 상태.)
