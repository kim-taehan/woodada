# h25 renderer-dev — 독수리 "기울인 글라이드" 비행 연출 (display-only)

## 결과
독수리에 **가벼운 틸트 글라이드**(앞으로 약간 기울이고 살짝 떠서 부드럽게) 추가. 옛 fly 코드(수직 호버+flap+뱅킹)는 되살리지 않음 — 방법 A(PartsCharacter biped 흐름에 eagle 전용 틸트+작은 lift+완만 bob만 얹기) 채택. runStyle 'biped' 그대로. typecheck 통과, 단위 44/44, Playwright 육안 확인.

## 구현 (src/renderer/character/PartsCharacter.ts, 외과수술적)
eagle 전용 플래그 1개 + 분기 2곳. 다른 캐릭터/baseline 무영향.
- `const eagleGlide = this.model.id === 'eagle' && !o.reducedMotion && moving;` — 달릴 때만(정지/시상대 제외), reduced-motion 제외.
- **lift**: `if (eagleGlide) lift = 10 + Math.sin(o.clock*3.2)*4;` — 작은 상시 부양(≈10px) + 완만 bob(±4). 옛 호버(26px)보다 가볍게. leg-cycle `t`가 아닌 부드러운 `clock` 사용.
- **tilt**: `else if (eagleGlide) this.root.rotation = dir*(0.18 + speedNorm*0.08) + Math.sin(o.clock*3.2)*0.03;` — 진행방향으로 앞으로 기울임(plain biped lean보다 약간↑, ≈11°) + bob 동기 미세 sway. **flap/뱅킹 없음.** root.rotation=라디안, 파트 rot=도 단위 함정 준수.
- 정지/celebrate/finished/skill/stunned 등은 기존 분기가 잡으므로 무영향(eagleGlide는 moving일 때만 true).

## 시각검증 (Playwright 라이브, 임시 캡처 후 삭제)
solo 독수리를 오벌 한 바퀴 샘플:
- **하단 직선(우측 진행)**: 앞(우)으로 기울고 트랙선에서 살짝 떠 글라이딩. talon이 바닥에서 약간 들림. 과하지 않음("약간").
- **우측 곡선**: 진행방향 따라 기울며 뱅크하듯 돎, 떠 있음 — 자연스러움.
- **상단 직선(좌측 진행)**: 반대로(좌) 기울어 글라이딩. dir 기반 틸트가 진행방향에 맞게 미러됨.
- **bob 애니**: 근접 프레임(an-60/64) 비교 시 부양 높이·틸트가 미세 변동 → 정적 아님, 부드러운 글라이드.
- 깨짐/사라짐/과회전 없음. 다른 캐릭터 영향 없음(플래그 eagle 한정).

판정: **PASS. 떠 있되 과하지 않고 곡선/직선 모두 자연스러운 기울인 글라이드. 옛 호버/펄럭임 문제 재발 없음.**

## 인계
- display-only, runStyle 엔진 미참조 → 밸런스/결정론 무관(단위 44/44 그대로).
- 코드 변경: PartsCharacter.ts만(eagle 분기 추가). 데이터/타 파일 무변경 → content-designer 협업 불필요(방법 A).
- 골든 스크린샷: 독수리가 등장하는 컷에 틸트/부양 반영 → 갱신 필요(의도된 변경), qa 게이트에서 재생성.
