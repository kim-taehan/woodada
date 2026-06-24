# h08 renderer-dev — coast() 클럭 전진 후 시상식 대기 화면 깝치기 육안검증

## 요청 (shell-dev)
`RaceController.coast()`가 rAF마다 `time`도 `extra*(1000/60)` 전진하게 고쳐 골인 후 렌더러 clock이 계속 흐른다. "골인 → 시상식 보러가기 버튼 대기" 상태에서 동물들이 계속 깝치는지(celebrate/dejected 포즈 + 스파클/하트 FX 지속) 육안확인 요청.

## 분석 (왜 이 수정이 필요했나)
- 렌더러 `clock`은 `dt = (frame.time - lastTime)/1000`로 누적(`RaceRenderer.ts:851-853`). celebrate sway(`Math.sin(t*0.7)`)·dejected sway(`Math.sin(o.clock*1.6)`)·FX 파티클 `update(now, dt)`가 전부 clock/dt 의존.
- 수정 전: `coast()`가 `frame`만 올리고 `time`은 고정 → `dt=0` → clock 동결 → 포즈·FX 정지. 수정 후: `time += extra*(1000/60)` → `dt≈1/60` → clock 흐름 → 애니/FX 라이브.
- **렌더러 코드 변경 불필요** — 입력 frame의 time만 흐르면 기존 렌더 로직이 그대로 살아남. (캡처 훅 `settle()`은 frame만 올려 정지 스틸용이라 라이브 재현 불가 → 실제 앱 구동으로 검증함.)

## 시각 검증 (실제 앱 라이브 구동, 임시 캡처 후 삭제)
Playwright로 setup→참가자 추가→출발→카운트다운 스킵→경주 완주→"🏆 시상식 보러가기" 게이트 도달. **버튼 안 누르고** coast 중 0.2s / 0.8s / 1.4s 시점 3컷(A/B/C) 캡처 비교:
- **A**: 게이트 표시 + 우승자 위 💗 + 후미주자 💧 + 금색 ✨ 버스트 + celebrate 포즈.
- **B (≈600ms 후)**: 하트 위치 상승·신규 생성, ✨ 위상 변화, celebrate 포즈(몸/팔 lean) 달라짐, 펭귄 bounce 위상 다름.
- **C (≈1.2s 후)**: ✨ 더 크게 흩어짐, 후미주자에 **새 💧 스폰**(FX 스폰 지속 증거), 하트 신규 위치, 포즈 또 변함.

A→B→C에서 포즈·FX가 연속적으로 진화 → **clock이 rAF마다 전진함이 확정**. 동물들이 시상식 대기 동안 계속 깝치고 스파클/하트도 지속 발생. shell-dev 수정 의도대로 동작.

판정: **PASS. 골인 후 대기 화면에서 celebrate/dejected + 스파클/하트 FX 모두 라이브로 지속됨. 정지/끊김 없음.**

## 인계
- 렌더러 소스 변경 없음(검증만). display-only라 엔진/결정론 무관 — shell-dev 진단대로.
- typecheck/단위/골든 영향 없음(셸 `RaceController.ts` 변경은 shell-dev 소유, 캡처 훅 `settle()`는 그대로라 골든 스틸 불변).
