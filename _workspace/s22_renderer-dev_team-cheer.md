# s22 — 팀전: 1등 팀만 환호 (renderer-dev)

## 작업 요약
팀전일 때 **1등 팀 멤버만** 결승/시상식에서 기뻐하게 하고, 나머지 팀은 중립으로 만든다.
개인전은 기존 등수 기준 그대로. `src/renderer/RaceRenderer.ts`만 수정.

## 변경 (src/renderer/RaceRenderer.ts)

### 1) 온트랙 결승 환호 — `placeFinished` (~842-928) + 호출부 (~1209-1239)
- `placeFinished`에 `winningTeamId?: string` 인자 추가.
- `teamGated = winningTeamId !== undefined && r.teamId !== winningTeamId` — "팀전이고 1등팀이 아님".
- `celebrates = (rank <= 3) && !teamGated` — 행복 티어는 팀전에선 1등팀에게만.
- `phase`: settled 시 `celebrates ? 'celebrate' : (lastish && !teamGated) ? 'dejected' : 'finished'`.
  팀게이트된 멤버는 꼴찌여도 'finished'(중립)로 둠("졌다"는 인상에 슬럼프까지 겹치지 않게).
- 하트/✨/💧 FX도 동일 게이트.
- 호출부: 팀전이면 완주 1등(최소 rank) 레이서의 teamId를 `winningTeamId`로 산출(릴레이 1589 방식과 일관). 개인전이면 undefined → 기존대로 placement별 emote 유지.

### 2) 결과 시상대 — 포디움 (~1593-1683)
- `winTeamId = config.teamMode ? top[0]의 teamId : undefined` (1등 완주자의 팀).
- `celebratesId(id)`: 개인전이면 항상 true(전원 깝침, 기존 유지). 팀전이면 `teamId === winTeamId`만 true.
- `podiumChars.push({ winner: rank===0, celebrates: celebratesId(id) })`.
- `podiumTick`: `phase = celebrates ? 'celebrate' : 'finished'`, `speedNorm = celebrates ? (winner?1:0.5) : 0.4`.
  → 1등팀 깝침, 진 팀 포디움 캐릭은 블록 위에 중립으로 서 있음.
- 릴레이 1등팀 전원 묶음(winnerExtras, ~1629)은 기존대로 celebrate:true 유지.

## 검증
- `npm run typecheck` 통과.
- `race-visual.spec.ts --project=desktop` **5/5 통과**(회귀 없음).

### 온트랙 결승 (필수, Read 육안 확인 완료)
clean 4-up 2팀(red=penguin+cat, blue=dog+monkey), seed 7.
완주 순서: 1.원숭이4(blue) 2.강아지2(blue) 3.고양이3(red) 4.펭귄1(red) → **1등팀 = blue**.
- `tests/e2e/__screens__/s22-team-finish.png`
  - 원숭이4(blue,1등): 팔 들고 💗+✨ — **환호**. 강아지2(blue,2등): "우다다다!!!" 팔 들고 ✨ — **환호**.
  - 고양이3(red,3등): 네발 중립 코스트, 하트/스파클 없음 — **중립**(기존이면 3등이라 환호했을 것 → 정상적으로 억제됨).
  - 펭귄1(red,4등): 중립. **결론: blue팀만 기뻐, red팀 중립. 정확.**
- `tests/e2e/__screens__/s22-individual-finish.png` (개인전 회귀)
  - top3(원숭이4·펭귄1·고양이3) 전원 💗+✨+팔 들고 환호, 4등 강아지2만 빠짐. **기존 등수 기준 그대로, 회귀 없음.**

### 시상대 (부분 확인)
- 개인전 포디움 `team-celebrate-individual-podium.png`: top3 전원 깝침 — 기존 유지 확인.
- 팀전 포디움: 포디움 코드는 읽어서 검증 완료(온트랙과 동일한 teamId 게이팅 패턴). **단, 깨끗한 2팀 포디움 캡처는 보류** — 이유는 아래.

## ⚠️ 동시작업 충돌 (team-lead 보고 필요)
- 캡처 훅 `window.__woodada.showPodium`이 **작업 도중 `src/main.ts`에서 제거됨**(다른 에이전트가 #28 "팀전 3가지 모드 + 선택 UI" / #25 작업 중 main.ts hooks 섹션 재작성, `arenaId` 옵션 신설). 첫 실행 때는 존재해 팀/개인 포디움을 1장씩 찍었으나(8캐릭 degenerate 팀셋), 재실행 시 함수 사라짐.
- `main.ts`는 셸 영역이라 내 스코프(src/renderer/만) 밖 → 내가 복원하지 않음.
- 포디움 로직 자체(RaceRenderer.ts)는 변경/검증 완료. `showPodium` 훅이 복원되면 clean 2팀 포디움 1장 재캡처로 마무리 가능.
- 추가: #25 "필드 펴기"가 같은 `placeFinished`(scatter)를 건드릴 수 있으니 머지 충돌 주의.
- 우회 시도: 캡처 훅 없이 **실 UI 흐름**(setup→팀전→출발→skip→podium-gate)으로 팀 포디움을 찍으려 했으나, #28 작업으로 팀전 setup이 재작성 중(커스텀 팀명 "날쌘천재/까부는총알…", 5바퀴 기본)이라 90초 내 완주 안 함 → 보류. 셸/세팅 작업이 안정되면 1장 재캡처로 마무리 권장.
- 정리 완료: 임시 spec(s22-*-tmp.spec.ts) 및 debug 스크린샷 모두 삭제. 남은 산출 스크린샷: s22-team-finish.png, s22-individual-finish.png.
