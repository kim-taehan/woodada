# t02 — renderer-dev: 트랙 테마(여러 경기장) 렌더링 (feat/arenas)

렌더러만 변경. 엔진/데이터 침범 0. typecheck 통과. 6종 캡처 육안 통과.

## 변경 파일 (렌더러 + 캡처 훅)
- `src/renderer/track/TrackScene.ts` — 하드코딩 색 → `TrackTheme` 팔레트 소비형으로 리팩토링. sky 그라데이션, decor 12종, ambient 3종 추가.
- `src/renderer/RaceRenderer.ts` — `buildScene(config, opts?: { arenaId? })` seam, 테마 해석(`resolveTheme`), `rebuildTrack`에 theme 전달.
- `src/main.ts` — 캡처 훅 `CaptureOpts.arenaId` 추가. **캡처 기본값 'grassland'**(골든 드리프트 방지). 게임 기본은 'random'(shell store).

> shell-dev가 RaceController/App/store/SetupScreen, content-designer가 src/data/tracks/*는 별도 담당. 나는 소비만.

## 테마 주입 seam (shell-dev와 합의)
```
RaceRenderer.buildScene(config: RaceConfig, opts?: { arenaId?: string })
```
- arenaId 미지정 또는 'random' → `pickArena(config.seed)` (결정론)
- 알려진 id → `trackCatalog[id]` (없으면 pickArena 폴백)
- 엔진 `RaceConfig`는 미변경(arenaId 없음) → 엔진 순수성 유지. arenaId는 렌더러 전용.
- 호출 경로: shell `App.ts` → `new RaceController(renderer, config, store.arenaId)` → `buildScene(config, { arenaId })`.

## 레이어 순서 (가독성 = 최우선)
sky(flat/grad) → stands(중립 회색, 비테마) → surface → surfaceAlt(옵션) → kerb → infield → infieldEdge → **decor** → **ambient** → laneLine → start/finish.
- decor/ambient는 트랙 위·레인선/결승선 아래·**캐릭터 뒤**(trackLayer는 stage idx 0). 오발이 캔버스 대부분을 덮으므로 이 위치라야 소품이 보임.
- decor 데이터 좌표 대부분 y<0.2(상단 하늘 띠)·중앙 infield(y~0.5)라 트랙면을 거의 안 가림.

## decor 12종 / ambient 3종
content-designer `t04_content-designer_decor-spec.md`의 도형·hex·크기감을 그대로 구현(채도/명도 한 단계 죽임). 배치 좌표/scale은 `src/data/tracks/*.ts` DecorSpec 소비(미변경).
- sun/moon/cloud/cactus/palm/parasol/tube/building/pine/snowman/leaf/vine — Pixi Graphics 도형 2~4개 조합.
- ambient: sand(가로 모래 줄), snow(낙하 점), fireflies(글로우 점). 'none'/미설정이면 없음. **결정론** — Math.random 0, 인덱스 기반 격자 스캐터. TrackScene은 정적 build라 모션은 라이브에서만(스틸로도 분위기 충분).

## 6종 육안 소견 (seed 7, mid frame, desktop 1280×800)
| 경기장 | 가독성 | 분위기/소견 |
|--------|--------|-------------|
| **grassland** | 원본과 픽셀 동일 | 빨강 트랙·초록 필드·회색 스탠드·흰 레인·평평한 초록 배경. **decor/ambient 없음 → 회귀 0 확인**. |
| **desert** | 양호 | 모래 트랙+베이지 듄. 쨍한 해, 죽은 녹색 선인장×2·야자×2(배경으로 물러남), 모래바람 줄. 컨셉 OK. |
| **beach** | 매우 양호 | 젖은 모래 트랙 + 청록 바다 infield 대비가 시원. 해·구름·코랄 파라솔×2·중앙 튜브. 캐릭터 또렷. |
| **citynight** | **양호(중점 확인)** | surface mid-slate(0x444a63)라 밝은 치비 캐릭터 대비 강함, 네온 시안 레인선이 또렷이 뜸. 보름달(웜화이트+글로우)+창문 켜진 스카이라인 빌딩×4 → "도시 야경" 즉시 읽힘. 어둠 속 가독성 문제 없음. |
| **snow** | 양호 | 옅은 얼음 트랙+눈 필드. 눈 덮인 전나무×2·중앙 눈사람·구름, 눈송이 낙하. 페일톤이라 캐릭터가 살짝 더 도드라짐(긍정). |
| **jungle** | 양호 | 흙 트랙+짙은 녹 캐노피. 늘어진 덩굴×2·큰 잎×2(짙은 녹, 배경)·반딧불 글로우 점. 컨셉 OK. |

기타 연출 회귀 확인: grassland 기본 캡처 경로에서 스킬 FX(골드버스트/다이브밤)·실황 자막·스코어보드·TOP3 HUD·아이템박스·결승 체커 모두 기존과 동일(스크린샷 `regress-fx.png`, `regress-finish.png`).

## 1회 보정 내역
1. 초기 구현은 decor를 트랙 **뒤(stage 아래)** 에 그려 오발에 전부 가려 안 보임 → decor/ambient 레이어를 **infield 위·레인선 아래**로 이동(캐릭터 뒤 유지). 재캡처 후 전 테마 소품 가시화 확인.
2. content-designer `t04` 스펙 도착 후 decor/ambient hex를 스펙값으로 정렬(특히 과채도 녹색 cactus/palm/pine/leaf/vine → 죽은 녹, moon 콜드화이트 → 웜화이트+글로우, parasol/tube 코랄 톤다운, building 창문 0xffd66b). 재캡처 후 소품이 배경답게 물러나며 캐릭터 가독성 향상 확인.

## 캡처/검증 메모
- 포트 5190 dev 서버 재사용, Playwright(channel 'chrome')로 `window.__woodada.showRaceAt(frame, { seed, arenaId })` 훅 호출해 6종 + 회귀 캡처. **playwright.config.ts 영구 변경 없음**(임시 인레포 .mjs 스크립트 사용 후 삭제).
- 스크린샷: `_workspace/shots/arena-{grassland,desert,beach,citynight,snow,jungle}.png`, `_workspace/shots/regress-{fx,finish}.png`.

## content-designer에게 보낸 피드백 (1건)
- beach parasol y=0.7/0.74는 하단 직선 트랙/외곽에 걸침(작고 캐릭터 뒤라 거슬리진 않으나 "트랙면 미겹침" 원칙과 약간 어긋남). 의도면 유지, 아니면 y≈0.82(외곽) 또는 infield(y~0.45) 권장. 좌표는 데이터(content-designer 소관)라 미변경.

## qa-verifier 인계
- 스크린샷 8장: `_workspace/shots/arena-*.png`(6) + `regress-*.png`(2).
- 결정론: arena별 캡처는 `arenaId` 명시 → 안정. 기존 race-visual 스펙은 캡처 훅 기본 'grassland'라 골든 드리프트 없음(스펙 파일 미변경).
