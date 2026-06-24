# h10 content-designer — 강아지 renderScale 추가

사용자: "강아지가 다른 동물에 비해 너무 크다." 원인: `dog.ts`에 renderScale 없어 기본 1.0으로 렌더(다른 캐릭은 모두 명시: bear1.15/cat0.88/monkey0.82/penguin0.9/eagle0.95/hedgehog0.95).

## 수정
- `src/data/characters/dog.ts`: `renderScale: 0.86` 추가. 다른 필드 불변.

## 값 근거 (0.86)
강아지·고양이 둘 다 측면 갤럽. 파츠 native 크기 비교:
- dog: head r36, body 31×25
- cat: head r33, body 27×19 (renderScale 0.88)
강아지 파츠가 머리 ~9%·몸 ~15% 더 큼 → 같은 scale이면 더 크게 보임. 고양이(0.88)보다 살짝 낮은 **0.86**으로 native 차이를 상쇄해 트랙에서 비슷한 크기로 읽히게. team-lead 제시 범위 0.85~0.92 내.

## 검증 (Playwright 캡처, dev 서버)
- 기본 로스터 7종 중반 프레임 캡처 → 강아지가 옆의 고양이와 거의 동일 크기로 읽힘. 더 이상 최대가 아니고, 최대는 곰(1.15)으로 의도대로. 0.86 적정 확인.
- (보너스) 같은 캡처에서 고슴도치 측면 갤럽 + 등 가시 실루엣 정상 렌더, '따끔! 붙지 마!' 스킬 버블 발동 확인.
- 임시 spec/스크린샷은 검증 후 삭제(레포 오염 없음).

## 영향
- renderScale은 렌더러 표시 배율만. 엔진/밸런스/스킬 무관. 등록/테스트 변경 없음. typecheck 영향 없음(값 추가).
