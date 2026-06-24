# t03 — shell-dev: 경기장 선택 UI + 배선 (feat/arenas)

셸만 수정(src/shell + 직렬화 상태 1필드). 엔진/렌더러 로직 침범 0. content-designer t01 데이터 소비, renderer-dev seam과 합의.

## 변경 파일 (4)
- `src/shell/store.ts` — `RoomStore.arenaId = 'random'` 필드 추가(직렬화·시각 전용 주석). `buildRoomState()`에 `arenaId: this.arenaId` 반영. **`buildRaceConfig()`는 손대지 않음** — arena는 엔진 config에 안 들어감(순수 시각).
- `src/transport/types.ts` — `RoomState.arenaId?: string`(optional, 하위호환 역직렬화: 없으면 'random' 취급). 직렬화 상태 일관성/리플레이용.
- `src/shell/screens/SetupScreen.ts` — `trackCatalog`/`defaultArenaIds` import. opts-row(바퀴 수 옆)에 `경기장` `<select>` 추가: 기본 `🎲 랜덤`(value 'random') + 6종(theme.emoji + theme.label). change 시 `store.arenaId` 갱신. CSS 변경 불필요(.opts-row가 이미 flex-wrap, .opt-group 패턴 재사용).
- `src/shell/RaceController.ts` — 생성자에 `arenaId = 'random'` 3번째 인자. `buildScene(config, { arenaId })`로 전달. 시각 전용·엔진 미접촉 주석.
- `src/shell/App.ts` — `new RaceController(this.renderer, config, this.store.arenaId)`.

## seam 합의 (renderer-dev)
- 합의 결과: `RaceRenderer.buildScene(config: RaceConfig, opts?: { arenaId?: string })`.
- **랜덤 해석은 렌더러 단일 소스**: opts.arenaId가 undefined/'random'이면 renderer의 `resolveTheme`이 `pickArena(config.seed)`로 풀고, 알려진 id면 `trackCatalog[id]`(미스 시 pickArena 폴백). 셸은 절대 미리 풀지 않고 'random' 또는 id 문자열만 실어 보냄.
- 협상 중 시그니처가 한 번 `(config, arenaId?: string)`(평문)로 흔들렸다가 최종 객체형 `{ arenaId }`로 수렴 — 셸 호출부를 거기 맞춤. 현재 typecheck 0.
- RaceConfig(=src/engine/types.ts)에는 arenaId를 넣지 않음(엔진 타입 오염 회피, 양측 "엔진 미접촉" 계약 유지).

## 검증
- `npm run typecheck` → 0 에러.
- Playwright(임시 스크립트, dev 5190 재사용; playwright.config.ts 영구변경 없음, 스크립트는 실행 후 삭제):
  - 경기장 옵션 = `["🎲 랜덤","🌿 초원","🏜️ 사막 오아시스","🌊 해변","🏙️ 도시 야경","❄️ 설원","🌴 정글"]`, 기본값 `random` 확인.
  - citynight 선택 → 참가자 2명 추가 → 출발 → 카운트다운 통과 → `.canvas-host canvas` 1개 존재. 회귀 없음.
  - 스크린샷 육안: 설정 화면 경기장 select가 바퀴 수 옆에 자연스럽게 배치(기존 톤 유지). 레이스 화면은 선택한 도시 야경(어두운 슬레이트 트랙·빌딩·달·네온 레인선)이 정확히 렌더 → 셸 선택→seam→렌더러 테마 체인 동작 확인.

## 기본값 메모
게임 사용자 기본은 'random' 유지(사용자 요구). 골든/캡처 레이어의 grassland 고정은 renderer-dev가 캡처훅/race-visual 스펙에서 arenaId를 명시 전달해 처리(셸 기본 불변).
