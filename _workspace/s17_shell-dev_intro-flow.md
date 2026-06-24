# s17 shell-dev — 레인 소개 단계 + 스킵 버튼 (셸 흐름)

## 삽입 위치
`App.startRace()` 안, **RaceController 생성 직후 → runCountdown 직전**.
- RaceController 생성자가 `buildScene` + `renderFrame(frame 0)`를 수행하므로 출발선 정지 장면이 이미 화면에 떠 있음. 그 위에 소개 단계를 얹는다.
- 시퀀스: `setup → (출발선 장면 렌더) → 레인 소개 → 카운트다운 → 경주` (소개만 신규 삽입).
- 근거: 시작 프레임 렌더는 컨트롤러 생성 시점에 이미 발생하므로 별도 프레임 렌더 코드를 추가할 필요 없이 그 직후가 가장 자연스러운 삽입점.

## 추가한 것
1. `LaneIntroRenderer` 로컬 seam 타입(App.ts 상단): `playLaneIntro?(onDone)` / `skipLaneIntro?()`.
   - `RaceRenderer` 인터페이스(introfx 담당 파일)는 건드리지 않음. 셸은 optional view로 소비.
   - 런타임에 메서드가 없으면 즉시 카운트다운으로 폴백.
2. `App.runLaneIntro(race)`:
   - `reducedMotion`이거나 `playLaneIntro` 부재 시 `Promise.resolve()` 즉시 통과(카운트다운과 동일 정책).
   - '건너뛰기 ⏭' 버튼(`.skip .intro-skip`) DOM 오버레이 표시.
   - `playLaneIntro(finish)` 호출 — onDone 콜백이 소개 종료 시 카운트다운으로 진행.
   - 스킵 클릭 → `skipLaneIntro?.()` → `finish()`.
3. styles.css: `.intro-skip { z-index: 6; cursor: pointer; }` (기존 `.skip` 스타일 상속).

## 더블 진행 가드
`runLaneIntro` 내부 `done` 플래그 1개로 `finish()`를 한 번만 실행. renderer onDone과 스킵 클릭이 둘 다 와도 카운트다운 진입은 정확히 1회. 버튼은 finish에서 제거.

## seam 계약 (renderer-dev/introfx와 합의 — team-lead 지정)
- `playLaneIntro(onDone: () => void): void` — 1레인부터 스포트라이트, 끝나면 onDone() 1회.
- `skipLaneIntro(): void` — 즉시 정리 + (미호출 시) onDone 1회, idempotent.
- 셸은 buildScene+renderFrame(0) 이후 playLaneIntro 호출. 양쪽 idempotent.

## 주의
- renderer-dev가 이 세션 팀에 없어 SendMessage 미도달. 계약은 team-lead 지정 시그니처대로 진행. RaceRenderer.ts 인터페이스 선언/구현은 introfx가 채울 것 — 그때 로컬 seam 타입과 맞물림.

## 검증
- `npm run typecheck`: **셸 파일(src/shell) 오류 0** 확인. 남은 오류는 `RaceRenderer.ts`의 intro* 미사용 변수(introfx 작업 진행 중)로 셸 책임 아님.
- 비주얼(스포트라이트 육안)은 introfx 담당.

## 변경 파일
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/shell/App.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/shell/styles.css
