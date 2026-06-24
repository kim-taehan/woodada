# h29 renderer-dev — 독수리 측면 글라이드(eagleProfile) production 반영

## 결과
사용자 선택 샘플3(측면 진짜새)을 production 렌더로 반영. content-designer가 eagle.ts를 측면 리그 + `runStyle: 'glide'`로 이관 완료, 렌더러에 **새 `glide` 분기** 추가. typecheck 통과, 단위 44/44, Playwright(5191) 측면 미러+글라이드+divebomb+포트레이트 육안 확인.

## 합의 (content-designer)
- runStyle 새 값 **`'glide'`** (측면 미러 ON + 다리 사이클 OFF + 틸트 글라이드). schema는 runStyle:string·테스트 화이트리스트 없음 → 검증목록 변경 불필요(확인함).
- 파트(측면, head +x): tail / legR(원측·darker) / body / legL(근측 talon) / wingL(근측 접은 날개=flutter) / head(후크부리). 다리 정적, flutter는 wingL.

## 변경 (src/renderer/character/PartsCharacter.ts)
이전 front-facing `eagleGlide`(id 기반) 특수처리 **제거**, style 기반 `glide`로 일반화:
- `const gliding = style === 'glide' && !reducedMotion && moving;` (id 비의존).
- **미러**: `inner.scale.x = (runStyle==='gallop' || runStyle==='glide') ? dir : 1;` → 측면이라 진행방향 봄(아래직선 우/위직선 좌). 주석 갱신.
- **locomotion 분기 신설** `else if (style==='glide')`: **다리 사이클 없음**(legL/legR 정적, talon 트레일) + wingL 미세 flutter(sin*5°) + tail sway(sin*6°) + body breathe + head 미세 bob. flap/호버 아님.
- **lift**: `if (gliding) lift = 10 + sin(clock*3.2)*4` (가벼운 부양+완만 bob).
- **tilt**: `else if (gliding) root.rotation = dir*(0.18+speedNorm*0.08) + sin(clock*3.2)*0.03` (앞으로 ~11° + 미세 sway, dir로 진행방향 기울임=미러와 정합). 라디안 단위.
- 회전단위 함정 준수(root=라디안, 파트 rot=도). 다른 캐릭터 무영향(glide는 eagle만).

## divebomb (RaceRenderer 무변경)
기존 divebomb 화면공간 hop+lunge가 측면 eagle에 그대로 정합 — 이벤트 계약(activate/hit/dodge·self-botch targetId===racerId) 불변, glide onto target 메커닉도 그대로. 시각상 측면 독수리가 앞으로 박치기 lunge + 임팩트 FX 정상. 코드 변경 불필요.

## 포트레이트
`docs/img/eagle.png` → 측면 글라이드 독수리로 재캡처(frame 60, 230×200, 기존 규격 일치). 옛 정면/비행본 대체.

## 시각검증 (Playwright 5191, 임시 캡처 후 삭제)
- 하단직선(우 진행): 머리/후크부리 +x, 꼬리 트레일, 앞으로 기울여 트랙선 위로 떠 글라이딩, 다리 정적. ✅
- 상단직선(좌 진행): inner.scale.x=dir로 좌향 미러, 기울여 글라이딩. ✅
- divebomb(seed1): 측면 독수리 lunge + 별/먼지 임팩트, self-botch 자막 정상. ✅
- 포트레이트: 측면 raptor 또렷(후크부리·유선형·꼬리깃·talon), 펭귄과 구분. ✅
- 깨짐/회전단위 이상 없음, 다른 캐릭터 영향 없음.

## 인계 (qa-verifier)
- typecheck OK / vitest 44/44 OK.
- ⚠️ `race-visual.spec.ts` 골든 재생성은 **환경 이슈로 블록**: 포트 5173을 다른 프로젝트("아웅다웅")가 점유 → Playwright webServer(reuseExistingServer)가 그 서버를 재사용해 `window.__woodada` undefined로 5/5 실패. **내 변경과 무관**(나는 5191 신선 서버+절대URL로 검증). qa는 5173 정리 또는 임시 config로 깨끗한 포트에서 골든 재생성 필요.
- 골든은 독수리 측면 글라이드 + 포트레이트로 갱신 필요(의도된 회귀).
