# s26 renderer-dev — 팀전: 1등 팀만 환호 (결승 + 시상식)

## 요구
팀전일 때 1등 팀만 기뻐하게. 두 군데:
1. 결승 후 온트랙 환호(placeFinished): rank별 emote/하트/방방을 팀전이면 1등 팀 멤버에게만. 나머지 팀은 완주·정렬은 하되 중립.
2. 결과 시상식 podium: 1등 팀만 방방 뜀, 나머지 팀은 서 있되 깝치기 안 함.
개인전은 기존 그대로. 렌더러만(RaceRenderer). 엔진/데이터/셸 무수정.

## 1등 팀 판정
- 온트랙: `renderFrame`에서 teamMode면 `r.rank`가 가장 작은(=1등) 완주자의 `teamId` = 승리 팀(`winningTeamId`). placeFinished에 전달.
- 시상식: `top[0]`(1등 완주자)의 teamId = 승리 팀(`winTeamId`). 개인전이면 undefined.

## 변경 (src/renderer/RaceRenderer.ts 만)
### 1) placeFinished (온트랙)
- 인자 `winningTeamId?` 추가. `teamGated = winningTeamId !== undefined && r.teamId !== winningTeamId`.
- `celebrates = rank<=3 && !teamGated` → 환호 티어는 승리 팀만. 비승리 팀은 top3여도 중립('finished' 윈스탠스, 바운스 없음), 하트/스파클 없음.
- 비승리 팀은 꼴찌라도 'dejected'(시무룩 슬럼프) 안 함 — "졌다" 과장 피하고 중립 정리. sweat(💧)도 승리팀 아니면 표시 안 함.
- 개인전(winningTeamId undefined): teamGated 항상 false → 기존 rank별 연출 그대로.

### 2) showResult podium (시상식)
- `podiumChars`에 `celebrates: boolean` 추가. 승리 팀이면 true.
- `celebratesId(id)`: teamMode면 해당 racer.teamId === winTeamId, 개인전이면 항상 true(전원 환호 유지).
- top-3 블록 push는 celebratesId(id), 릴레이 winnerExtras는 모두 승리팀이라 celebrates:true.
- podiumTick: `phase = celebrates ? 'celebrate' : 'finished'`(중립 윈스탠스, 깝치기 없음), speedNorm도 그에 맞게.

## 검증
- `npm run typecheck` 그린.
- 임시 훅(main.ts showPodium)+스펙으로 캡처 후 삭제(렌더러만 남김, main.ts net-zero).
- 캡처(육안 확인, 클린 4명 2팀 red=펭귄·고양이 / blue=강아지·원숭이):
  - `tests/e2e/__screens__/team-celebrate-finish.png` — 온트랙 결승: 1등 blue(원숭이4 💗, 강아지2 ✨) 환호, red 고양이3(rank3)은 중립·연출 없음.
  - `tests/e2e/__screens__/team-celebrate-podium.png` — 시상식: blue(원숭이4 1번/강아지2 2번) 방방, red 고양이3(3번)은 블록에 서 있고 깝치기 없음.
  - `tests/e2e/__screens__/team-celebrate-individual-podium.png` — 개인전: 전원 깝치기(회귀 없음).
- 회귀: race-visual 5/5, relay-visual 통과.
- relay-podium.spec.ts(실 UI 구동, 하드코딩 5180·90s gate 대기)는 podium-gate 미출현으로 실패하나 **셸 플로우/타이밍 인프라 이슈**(서버 5180 별도 기동 필요 + 릴레이 실 UI 경주가 90s 내 결승 게이트 미도달)로 본 렌더러 변경과 무관. 릴레이 승리팀 환호는 showPodium 임시 캡처로 직접 검증(extras celebrates:true).

## 보강: 1등 팀 판정을 팀 점수 기준으로 (리드 피드백)
- 문제: 시상식 podium의 승팀 판정이 `top[0].teamId`(개인 1등의 팀)였음 → 팀 점수(rank-sum) 승자와 어긋날 수 있음.
- 수정: podium `winTeamId`를 **`result.scoring.order[0]`**(엔진 팀 스코어링이 winner-first teamId로 반환 — teamRankSum/relay 공통, 권위 있는 팀 랭크1)로. 미스/개인전이면 기존 top[0] 폴백. 릴레이 winnerExtras도 동일 `winTeamId` 사용해 일관.
- 온트랙(placeFinished)은 race 중 result 없음 → 리드가 허용한 폴백(완주 1등 팀의 라이브 근사) 유지.
- 검증: showPodium 임시훅이 scoring.order 반환하게 해 시드별 승팀 확인.
  - seed7 scoringOrder=blue,red → blue(원숭이4·강아지2) 방방, red(고양이3) 중립. `team-win-podium-seed7.png`.
  - seed30 scoringOrder=red,blue → **승팀이 red로 뒤집힘**: red(펭귄1·고양이3) 방방, blue(강아지2) 중립. `team-win-podium-seed30.png`. (승팀이 시드 따라 바뀜 = 팀 점수 추종 증거)
  - 개인전 회귀: 전원 깝치기 `team-win-individual.png`.
- typecheck 그린, race-visual 5/5, main.ts net-zero, 임시훅/스펙 삭제.

## #28 2단계(렌더러): 승팀 판정 = result.scoring.order[0] 3모드 정식 일반화
- 배경: 직전 보강이 배포본에 안 들어가 있었음(deployed는 다시 top[0].teamId). 엔진 3모드 계약(s24) 완성됨 → 정식 적용.
- 수정(RaceRenderer.ts만):
  - podium `winTeamId = result.scoring.type==='team' ? result.scoring.order[0] : undefined ?? top[0]폴백`. **teamRankSum/teamFirstPlace/teamRelay 3모드 동일 계약**(winner-first teamId).
  - 릴레이 winnerExtras도 `winTeamId` 사용(일관). 개인전 불변.
  - 온트랙(placeFinished)은 race 중 result 없어 라이브 폴백(완주 1등 팀) 유지(허용됨).
- 검증(임시 showPodium 훅이 scoringId 오버라이드 + scoring.order 반환):
  - **3팀×2(red=펭귄·강아지, blue=고양이·원숭이, white=곰·고슴도치) seed7**: 같은 경주인데 모드별 승팀 다름 — finish=곰(white) 1등.
    - teamRankSum: scoringOrder=blue>white>red(합 5/7/9) → **blue 환호, white 곰(1등 동물팀이지만 합 패배) 중립**. `mode-rankSum-podium.png` (곰 안 뛰고 원숭이 환호).
    - teamFirstPlace: scoringOrder=white>blue>red → **white 곰(1등 보유) 방방**, blue 중립. `mode-firstPlace-podium.png`.
    - 두 캡처에서 곰의 점프 유무가 갈림 = 모드별 승팀 추종 증거(top[0]였다면 둘 다 white 환호).
  - teamRelay(2팀): scoringOrder=blue>red → blue 전원(앵커+extra) 환호, red 앵커 중립. `mode-relay-podium.png`.
  - 개인전 회귀: 전원 깝치기 `mode-individual-podium.png`.
- typecheck 그린, race-visual 5/5, 임시 훅/스펙 삭제(main.ts의 내 훅 0개; main.ts 잔여 diff는 modeUI의 TEAM_SCORING_TO_ID 일반화로 내 것 아님).

## #29: 팀 단위 시상대 (1·2·3등팀 단상 + 4등팀↓ 단상 밑 좌절)
- showResult 포디움을 팀/개인 분기로 재구성(RaceRenderer.ts만):
  - **팀모드**: 단상 블록 = 팀(`result.scoring.order` 순). 1·2·3등팀 → 블록1/2/3, 각 블록에 팀 멤버 최대 4 클러스터(완주순 정렬, 리드만 태그). **1등팀만 celebrate(방방), 2·3등팀 'finished'(중립 서있음), 4등팀↓는 단상 못 올라가고 단상 밑(baseY+56)에서 'dejected' 좌절**(태그 숨김). 기존 릴레이 winnerExtras 특수경로 제거 → 이 일반 팀배치로 통합(릴레이도 동일 경로).
  - **개인모드**: 기존 top-3 개인 단상 그대로(전원 celebrate) — 불변.
  - podiumChars에 `phase:'celebrate'|'finished'|'dejected'` 명시 필드. tick이 그대로 적용.
  - **블록 오버플로(팀 4마리 초과, 리드 추가 요구)**: 4마리만 블록 위, 나머지는 블록 앞 바닥(baseY+30)에 클러스터하되 **팀과 동일 포즈**(1등팀이면 오버플로도 환호). 멤버 드롭 없음. 4등팀↓ 좌절 그룹도 전원 표시(드롭 없음).
- 검증(임시 showPodium 훅+스펙, 캡처 후 삭제):
  - 4팀×2(red/blue/white/black) seed7 scoringOrder=white>red>blue>black → 블록1 white(곰·고슴도치) 방방, 블록2 red(펭귄·강아지) 중립, 블록3 blue(고양이·원숭이) 중립, **black(외계인·거미) 단상 밑 좌절**. `team-podium-4teams.png`.
  - **오버플로(1등팀 6명, teamFirstPlace, red 우승)**: 블록1에 red 4 + 바닥에 red 2 둘 다 환호, 블록2 blue 2 중립. `team-podium-overflow.png`.
  - 개인전 회귀: top-3 전원 깝치기. `team-podium-individual-regression.png`.
- typecheck 그린, race-visual 5/5, 임시 훅/스펙 삭제(main.ts에 내 훅 0개).

## 파일
- `src/renderer/RaceRenderer.ts` (placeFinished teamGated + 팀단위 포디움 재구성 + winTeamId=result.scoring.order[0] 3모드 + podiumChars.phase)
