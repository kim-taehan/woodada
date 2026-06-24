# h26 content-designer — 독수리 "진짜 새" 샘플 3종 (탐색·비교용)

사용자: "독수리를 진짜 새모양으로 바꾸고 싶다, 샘플 몇 개 보여줘." → 비교용 PartModel 3변형. **확정/커밋 아님.** production(src/data/partmodels/eagle.ts·characters/eagle.ts) **무변경**.

## 산출물
- 임시 모듈: `_workspace/eagle-samples.ts` — PartModel 3개 export.
  - 타입 검증 통과(standalone tsc strict, PartModel 스키마 적합). import 경로 `../src/data/partmodels/types.ts`.
  - 팔레트는 기존 eagle 키(base/point/outline/wing/beak/crest) 재사용 + 일부 literal #hex(talon 골드 등). partsFactory가 키/hex resolve, 미정의 키는 무fill(crash 없음).
  - 회전단위 rot=도. 좌표는 다른 partmodel과 동일한 ~120px 로컬 공간.

## 3변형 (서로 확실히 다름)
1. **`eagleSampleSpread`** — 펼친 날개 글라이더. 양 날개를 크게 펼친 비행 실루엣, 끝에 노치 들어간 날카로운 primary 깃 4개. 정면 몸 + 어깨 사이 작은 머리. 글라이드 연출과 어울림.
2. **`eagleStanding`** — 위풍당당 직립 맹금. 풀 토르소(머리:몸 비율을 리얼하게, 베이비 축소), 옆구리로 접은 날개, 깃털 허벅지 + 큰 talon 발, 후크 부리, 무거운 brow + 뒤로 쓸린 nape crest. 늠름·위협적.
3. **`eagleProfile`** — 측면 실루엣(가장 real bird). +x를 보는 옆모습: 경사진 머리 + 앞으로 뻗은 긴 후크 부리, 유선형 몸, 뒤(-x)로 빠지는 fanned 꼬리, 옆구리 접은 날개, 긴 talon 다리(원측 다리는 어둡게 깊이감). 정면 치비 큐 전혀 없음.

## renderer-dev 인계 (포트레이트 캡처용)
- 모듈: `_workspace/eagle-samples.ts`
- export: `eagleSampleSpread`, `eagleStanding`, `eagleProfile`
- 팔레트: production eagle 팔레트(characters/eagle.ts) 그대로 쓰면 톤 맞음(base/point/outline/wing/beak/crest). 추가 literal hex는 모듈 내 const(TALON 등).
- 각 PartModel은 idle 포즈로 캡처하면 컨셉이 가장 잘 보임(절차 애니/runStyle 불필요 — 정적 포트레이트). poses에 idle/run/skill/win/fall 다 넣어둬서 어떤 경로로 렌더해도 안 깨짐.
- 셋을 나란히 포트레이트로 뽑아 사용자 비교용으로.

## 상태
- production·테스트 무변경. 확정되면 그때 정식 eagle.ts에 반영(별도 작업). 지금은 비교 샘플만.
