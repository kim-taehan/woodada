# u02 renderer-dev — 초원/해변 신규 decor 6종 렌더링

브랜치: `polish/arena-beach-grassland`
범위: 렌더러만 (`src/renderer/track/TrackScene.ts`). 엔진/데이터 무수정.
typecheck: 통과 (`tsc --noEmit`).

## 1. 추가한 draw 함수 (6개, u01 §4 스펙대로)

| 함수 | kind | 도형/색 요약 |
|---|---|---|
| `decorBunting` | bunting | 처지는 끈(`0x8a6d3a` quad sag +18s) + 삼각 깃발 8개, 4색 순환 `[0xe7574d,0xf5b13d,0x4fa3e0,0x5fbf6a]` |
| `decorFlower` | flower | 꽃 4송이(결정적 오프셋 ±14s), 꽃잎 5장 교대색 분홍/연노/연보라 + 노란 중심 + 초록 줄기 |
| `decorSeagull` | seagull | M자 갈매기 실루엣, 좌우 2차 베지어, `0x55606e` width 3s alpha 0.85, 몸통 없음 |
| `decorSandcastle` | sandcastle | 사다리꼴 본체(40→30, h26, `0xddb878`) + 탑3 + 코랄 깃발 `0xff6f61` + 아치문 `0xbf9a5e` |
| `decorStarfish` | starfish | 5각 별(외14s/내6s) `0xff9f5a`, 윤곽 `0xe07f3a`, -0.3rad 기울임 + 옅은 점무늬 |
| `decorBeachball` | beachball | 흰 원(r16s) + 6웨지 `[0xff5a5a,0x4fa3e0,0xffd64a]` 순환 + 윤곽 + 좌상단 하이라이트 |

- 모두 `DECOR_DRAW` 디스패치 맵에 등록.
- 기존 12 kind 함수/ambient(petals·sand)·레이어 순서·교차 코드 무수정 — 새 함수 + 맵 6줄만 추가.
- 결정론: 랜덤 0(꽃 클럼프·불가사리 점무늬는 하드코딩 오프셋 배열).

## 2. 시각 검증 (Playwright, 포트 5190 재사용)

캡처: `_workspace/shots/` (임시 인레포 스크립트로 `showRaceAt(0,{arenaId})`, reducedMotion. 스크립트는 종료 후 삭제, playwright.config.ts 영구 변경 없음).

- `arena-grassland.png` — 상단 만국기 가랜드 2스팬(처짐·4색 또렷, 작아서 배경처럼), 구름2·태양1, 인필드 정중앙 꽃 클럼프(초록 위 분홍/노랑 대비 또렷). 트랙면·캐릭터·이름표 모두 선명. "운동회" 분위기 살아남.
- `arena-beach.png` — 상단 갈매기 2마리(회색 M 실루엣, 하늘 대비 충분), 청량한 터쿼이즈 바다 인필드 위 튜브+비치볼(원색 6웨지 강한 대비), 하단 모래밭에 불가사리(좌)·모래성(중앙, 탑+코랄 깃발+아치문)·파라솔2(외곽), sand 줄무늬 ambient. "활기찬 바닷가" 달성. 트랙·캐릭터 또렷.
- `arena-desert.png` (회귀 점검) — 선인장·야자수·태양·sand 그대로, 변화 없음. 공유코드 무수정이라 사막/도시야경/설원/정글 무영향 확인.

## 3. 육안 소견 요약
어색함 없음 → 보정 불필요. 소품 전부 트랙면 밖(하늘/인필드 안전존/하단 모래 surround)이라 가독성 저하 없고, bunting만 컬러풀하되 작게 처리되어 캐릭터보다 뒤로 읽힘.
