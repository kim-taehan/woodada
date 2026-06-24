# s02 shell-dev — 초기화면 참가자 기본 2명 시드

## 요구
앱 첫 진입 시 참가자 2명을 자동으로 채워, 매번 "+ 참가자 추가"를 누르지 않아도 바로 출발 가능하게 한다. 기존 추가 방식(랜덤 이름, 캐릭터 미지정=🎲랜덤)과 동일. 초기 1회만 시드(사용자가 비웠거나 조작한 상태는 덮어쓰지 않음).

## 변경 파일 (src/shell/ 한정)

### src/shell/store.ts
- `randomName`(`../data/names.ts`) import 추가.
- `RoomStore.seedDefaults(count = 2)` 메서드 추가:
  - `this.drafts.length`이 있으면 즉시 no-op → 이미 추가/조작/비우기한 상태를 절대 덮어쓰지 않음.
  - 비어 있으면 `addName(randomName())`를 count번 호출. `addName`은 `+ 참가자 추가`가 쓰는 것과 동일 경로(랜덤 이름, characterId 미지정 → resolveParticipants에서 시드 Rng로 🎲 랜덤 배정).
  - DraftParticipant는 직렬화 가능 값만 들어감(함수/DOM 없음). RoomState 계약 무해.

### src/shell/App.ts
- `start()`에서 `showSetup()` 직전에 `this.store.seedDefaults()` 호출.
  - `start()`는 부팅 시 main.ts에서 정확히 1회만 호출됨. 레이스 후 셋업 복귀는 `showSetup()` 경로(`start()` 아님)라 재시드되지 않음 → "초기 1회만" 보장이 호출 지점에서 자연히 성립.

## 계약 준수
- 셸(`src/shell/`)만 수정. 엔진/렌더러/데이터 계약 미침범 (names.ts는 기존 데이터 소비).
- 결정론/시드 로직 무수정. 캐릭터 랜덤 배정은 기존 `resolveParticipants`의 시드 Rng 경로 그대로.
- 이름 랜덤은 기존 `randomName()` 재사용(SetupScreen의 + 버튼과 동일).
- 기존 동작 보존: 비우기 🗑️, 추가/삭제, 시작 버튼 활성 조건(`drafts.length >= 2`) 그대로 맞물림.
- 팀전/릴레이 흐름 무영향: 시드된 2명은 teamId 미지정. 모드 전환 시 기존 setTeamCount/autoAssign 로직이 그대로 처리.

## 검증
- `npm run typecheck` 통과 (에러 0).
- Playwright로 초기 화면(http://localhost:5173) 캡처:
  - 참가자 이름 입력 2개 = `["전설의호랑이","전설의돌풍"]` (랜덤 이름).
  - 두 행 모두 캐릭터 셀렉트 = 🎲 랜덤.
  - 출발 버튼 `disabled = false` (활성).
  - "비우기 🗑️" 노출(drafts.length > 0).
