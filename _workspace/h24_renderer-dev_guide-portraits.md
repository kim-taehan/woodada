# h24 renderer-dev — 캐릭터 가이드 포트레이트 2건 (hedgehog 신규 / eagle 갱신)

## 결과
`docs/img/hedgehog.png` 신규 생성, `docs/img/eagle.png` 갱신. 둘 다 기존 6종과 **동일 규격(230×200)·스타일**(이름표 상단 + 캐릭터 트랙 줌 크롭)로 렌더 캡처. Read로 육안 확인 완료.

## 방식
- 기존 `docs/img/{dog,penguin,...}.png` 규격 확인 → **230×200**, 단일 캐릭터 + 이름표가 빨간 트랙 위에 줌된 크롭.
- main.ts 시뮬/렌더 훅으로 단일 캐릭터를 5180 dev 서버에 렌더(`showRaceAt(60, { seed:5, characterIds:[id] })`), frame 60(캐릭터가 하단 직선 중앙·출발선 지난 위치)에서 Playwright `screenshot({ clip: {x:395,y:452,w:230,h:200} })`로 크롭해 `docs/img/`에 직접 저장.
- 임시 후보 캡처 여러 프레임 비교 후 frame 60이 가장 중앙·또렷 → 채택. 후보/스펙 파일은 삭제.

## 육안 검증 (Read)
- **hedgehog.png**: 이름표 "고슴도치1" 상단, 측면 갤럽 고슴도치 — 등 가시 줄·뾰족 quill·주둥이·큰 눈 또렷. 가시 정체성 한눈에 읽힘.
- **eagle.png**: 이름표 "독수리1" 상단, 날카로운 지상 독수리 — 정수리 크레스트 tufts·angry brow·후크 부리·뾰족 날개팁·굽은 talon. 사나운 맹금류로 또렷, **펭귄(둥근 흑백)과 명확히 구분**. 옛 비행 버전 아님(지상 biped).
- 규격: 둘 다 230×200, 기존 6종과 일치(이름표 위치·트랙 배경·여백 동일).

## 가이드 정합성
- `docs/character-guide.md`의 이미지 ref 7종(`img/{bear,cat,dog,eagle,hedgehog,monkey,penguin}.png`) **전부 `docs/img/`에 파일 존재** 확인 → 깨진 이미지 없음. 고슴도치 항목도 1건 ref 매칭.
- GuideOverlay가 `BASE_URL/guide/`로 rewrite하는 경로 규약(`img/<id>.png`) 그대로 충족.

## 산출
- 변경: `docs/img/eagle.png`(M), `docs/img/hedgehog.png`(신규). 코드 변경 없음.
- 임시 e2e 스펙/후보 PNG 정리 완료.
