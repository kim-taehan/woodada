# h33 renderer-dev — 아레나 seam 골든-안전 수정

## 결과
아레나(배경 테마) 렌더링은 **이미 구현돼 있었음**(buildTrackScene이 TrackTheme palette/sky/decor 13종/ambient 소비, buildScene/RaceController/CaptureOpts에 arenaId 배선됨 — 이전 iteration 산출). 하지만 shell-dev가 경고한 **골든-안전 핵심 규칙이 어긋나 있어 수정**: `arenaId === undefined`가 seed 파생(pickArena)으로 떨어지고 있었음 → 기존 race-visual 골든(seed 7/35)이 grassland 아닌 desert/jungle로 렌더돼 전부 깨질 상태. typecheck OK, 단위 49/49, Playwright 해석 규칙 육안 확인.

## 버그 & 수정
- **RaceRenderer.resolveTheme**: `if (!arenaId || arenaId==='random') return pickArena(seed)` → undefined도 pickArena로 감(버그). 
  - 수정: `undefined → grassland` / `'random' → pickArena(seed)` / known id → trackCatalog[id] / unknown → grassland 폴백(pickArena는 명시적 random일 때만). buildScene 인터페이스 주석도 갱신.
- **RaceController**: 기본값 `arenaId = 'random'` → `arenaId?: string`(undefined 패스스루 → resolveTheme에서 grassland). 주석 갱신. shell의 App.ts는 store.selectedArenaId(기본 grassland) 전달하므로 정상.
- (main.ts showRaceAt는 이미 `opts.arenaId ?? 'grassland'`라 캡처 경로는 원래 안전했음 — 유지.)

## seam (확정, shell-dev와 합의)
- `buildScene(config, opts?: { arenaId? })`, `RaceController(renderer, config, arenaId?)`, `CaptureOpts.arenaId?` — 모두 배선 확인.
- 해석: undefined→grassland(골든0) / 'random'→pickArena(seed) / known→theme / unknown→grassland.

## 시각검증 (Playwright 5191, seed 7, 임시 캡처 후 삭제)
- **default(arenaId 생략)** → grassland: 원본 그대로(평평 초록·빨강트랙·decor 없음). seed 7인데 desert 안 나옴 ✅ (버그였으면 desert).
- **'snow'/'desert'/'citynight'** → 각 테마 팔레트+하늘+decor 렌더(citynight=네이비 하늘+초승달+빌딩, desert=모래+태양+선인장/야자). 트랙 표면 가독성 유지 ✅.
- **'random'(seed 7)** → desert(pickArena(7)=[1]) — 명시 random은 정상 동작 ✅.
- **unknown id** → grassland 폴백(random 아님) ✅.

## 인계
- typecheck OK / vitest 49/49 OK.
- **골든 회귀 0**: undefined→grassland 고정으로 기존 race-visual 골든 그대로. (단, race-visual 재생성 자체는 여전히 포트 5173 타프로젝트 점유 환경이슈로 블록 — 내 변경 무관.)
- decor 13종 + ambient 렌더는 이미 구현돼 있어 별도 작업 불필요했음(단계화 제안했으나 이미 done). 비-grassland 아레나에만 영향.
- display-only, 엔진/결정론/RaceConfig 무관(테마는 RoomState/주입 경로에만, 엔진 순수성 유지).
