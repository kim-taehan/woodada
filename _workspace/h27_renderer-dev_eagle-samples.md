# h27 renderer-dev — 독수리 "진짜 새" 3변형 비교 포트레이트 캡처 (탐색)

## 결과
content-designer의 `_workspace/eagle-samples.ts` 3변형을 **동일 조건**(같은 charId 렌더 경로, frame 60, 230×200 크롭, production eagle 팔레트)으로 포트레이트 캡처. production 무변경(임시 wiring은 캡처 후 git checkout으로 원복). 3 PNG는 비교용으로 `_workspace/`에 남겨둠.

## 캡처 방식 (production 안전)
- `src/data/partmodels/index.ts`·`characters/index.ts`에 **임시로** 샘플 3개를 등록(eagle CharacterData 복제 + partModelId만 교체 → charId `eagleSpread`/`eagleStanding`/`eagleProfile`). typecheck 통과 확인.
- 빈 포트(5191)에 우다다 띄워 기존 `showRaceAt` 훅으로 각 charId를 frame 60에서 렌더 → 동일 230×200 클립으로 크롭.
- 캡처 후 **두 index 파일 `git checkout`으로 원복**(미커밋·무변경 확인), 임시 spec/로케이터 삭제. typecheck 재확인 green.

## 산출물 (남겨둠 — main이 Read해 사용자에게 제시)
- `_workspace/eagle-sample-1.png` — **eagleSampleSpread (펼친 날개 글라이더)**: 양 날개 크게 펼친 비행 실루엣, 노치 깃, angry brow, talon 접음. → 날아가는 "진짜 새" 느낌 가장 강함. 포트레이트에서 날개가 좌우로 꽉 참(역동적).
- `_workspace/eagle-sample-2.png` — **eagleStanding (위풍당당 직립 맹금)**: 접은 날개, 깃털다리+talon, 후크부리, brow+nape crest. → 점잖고 위엄 있는 정면 직립. 베이비비율 낮춰 더 "맹금다움". 가장 캐릭터-마스코트 균형 좋음.
- `_workspace/eagle-sample-3.png` — **eagleProfile (측면 실루엣)**: 옆모습 긴 후크부리·유선형 몸·꼬리깃·talon 다리. → 가장 사실적인 raptor. 단 측면이라 큰 눈 1개만 보여 귀여움은 셋 중 가장 약함(real bird 지향).

## 육안 판정
3개 모두 깨짐/실루엣 이상 없음. 동일 프레임·크롭이라 나란히 비교 가능. 셋 다 펭귄과 명확 구분.

## 인계
- production/골든 변경 없음(탐색 캡처만). 사용자가 하나 고르면 content-designer가 정식 eagle.ts에 반영, 그때 renderer가 포트레이트/골든 갱신.
- 환경: 5173=다른 앱 점유 → 5191에 신선 우다다 띄워 캡처(임시 config 불필요, 절대 URL 사용). 캡처 후 서버 종료.
