# s15 shell-dev — 재생 속도 ↓ + 팀전 기본 멤버 2명

영역: `src/shell/` 만. 엔진/렌더러/데이터 무수정. 결정론 무관.

## A. 경기 재생 속도 늦추기
- `src/shell/RaceController.ts:17`
  - before: `const PLAYBACK_SPEED = 0.8; // ... 0.8 = 80% real-time ...`
  - after:  `const PLAYBACK_SPEED = 0.6; // ... 0.6 = 60% real-time ...`
- 화면 재생 속도만 변경(주석 명시대로 시뮬레이션/순위/결정론 무영향). 값+주석만 외과수술 변경.

## B. 팀전 기본 멤버 2명
각 활성 팀이 기본 2명을 갖도록 자동 시드. 개인전 `seedDefaults(2)`의 "부족할 때만 채움" 패턴과 일관 — 기존 배정/사용자 조작은 덮어쓰지 않음.

### 신규: `RoomStore.seedTeamDefaults(min = 2)` (`store.ts`, `setTeamCount` 바로 아래)
- `teamCounts()`로 활성 팀별 현재 인원 측정 → `min` 미달인 팀만 부족분을 `addName(randomName(), teamId)`로 채움.
- `addName`이 16명 상한을 자체 가드하므로 루프도 `drafts.length < 16` 조건 동반.
- 이미 2명 이상인 팀/사용자가 채운 팀은 손대지 않음 → 여러 번 호출해도 idempotent.

### 훅 위치 (`screens/SetupScreen.ts`)
1. 팀전 전환 (`teamBtn` click): 기존 `store.autoAssign()` 직후 `store.seedTeamDefaults()` 추가. 개인전→팀전 진입 시 모든 활성 팀 2명 보장.
2. 팀 수 변경 (`teamCountSelect` change): `setTeamCount` 후 `isTeamMode()`면 `seedTeamDefaults()` 호출 → 새로 추가된 팀이 빈 채로 남지 않고 2명으로 채워짐.

훅을 store 메서드가 아닌 SetupScreen 이벤트에 둔 근거: 개인전 `seedDefaults`도 첫 진입(셸)에서 호출되는 UI 트리거 패턴이고, 모드/팀수 변경은 사용자 상호작용 시점이라 여기서 채우는 것이 자연스러움. store는 "부족분 채움" 순수 로직만 제공.

### 시작 버튼 검증과의 맞물림
- `teamValidationError()`는 "빈 팀 없어야 함 / 미배정 0" 검사. seedTeamDefaults가 각 팀 ≥2를 보장하므로 팀전 전환·팀수 증가 직후 검증을 자연스럽게 통과(빈 팀 없음). 사용자가 멤버를 다 지워 빈 팀을 만들면 기존 검증이 정상적으로 출발 버튼을 비활성화.

## 검증
- `npm run typecheck` 통과 (0 오류).
- vite-node로 store 시나리오 직접 확인:
  - 개인전 2명 → 팀전(2팀): red 2 / blue 2 (총 4)
  - 팀수 2→4: 네 팀 모두 2명 (총 8)
  - 재호출 idempotent: 변화 없음
  - 빈 스토어 → 팀전: red 2 / blue 2
- 재생 속도는 값+주석 변경이라 typecheck로 충분(체감은 사용자 확인).

## 변경 파일
- `src/shell/RaceController.ts`
- `src/shell/store.ts`
- `src/shell/screens/SetupScreen.ts`
