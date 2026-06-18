# 19 — renderer-dev: 릴레이 레그 카운터 = laps + self-handoff 보정

## 요약
engine-dev의 "레그 수 = `laps`, 멤버 순환(`members[i % size]`)" 모델(`18_engine-dev_relay-cycle.md`)에 렌더러를 맞춤.
레그 카운터 총수를 팀 최대 인원 → `cfg.laps`로 변경, self-handoff(targetId === racerId) 바통 연출 가드 추가.
비릴레이·인원 자동스케일·조끼 회귀 0(릴레이 분기만 손봄). 결정론·렌더러→엔진 피드백 0 유지.

## 변경 파일
- `src/renderer/RaceRenderer.ts`
  - **레그 총수**: `relayLegTotal`을 팀 인원 카운트 map → `cfg.relay ? max(1, cfg.laps) : 0`으로 단순화(391~397 부근). 카운터는 그대로 `running` racer의 `max(leg)+1 / relayLegTotal`을 표시하므로 "n / 5 주자"가 맞음. 마지막레그(leg+1 >= laps) 트리거(배너/종) 그대로 동작.
  - **self-handoff**(`relay:handoff` 케이스, 285 부근): `targetId === racerId`(1인팀/순환 wrap)면 바통 도착점이 자기 자신이라 arc가 0길이로 제자리 까딱. 가드로 도착점을 진행방향 `dir * 40` 앞으로 hop시켜 "한 바퀴 더!" 토스처럼 보이게 하고, 글로우는 자기 자신(`v`)에 부여. 일반 핸드오프(다른 멤버)는 기존과 동일.
- `tests/e2e/relay-visual.spec.ts`
  - 캡처 로스터를 신모델로 교체: **2팀 × 3멤버, laps=5** (`TEAM_IDS=['red','blue','red','blue','red','blue']`). 레그 순환 `p0,p1,p2,p0,p1`라 p0/p1이 재등장(waiting↔running). `showRaceAt`/`simulate` 호출에 `laps` 전달. `relay-final-leg`(최종 레그) 캡처 추가.

## 카운터/self-handoff 처리 결론
- 카운터: `RacerState.leg`(동적 현재 레그) 기반 `max+1`을 그대로 사용 → 옛 "고정 참가 인덱스" 가정 없음. 대기열 정렬(`leg` 오름차순)은 재등장 멤버의 갱신된 `leg`로도 의미 유지. 추가 손질 불필요했음.
- self-handoff: 이 시드/로스터에선 frame 723 핸드오프가 멤버→멤버(self 아님)였으나, 가드는 `targetId===racerId` 경로에서 항상 발동. 프레임 깨짐 없음.

## 시각 검증 (육안)
`tests/e2e/__screens__/` (npx playwright test relay-visual.spec.ts --project=desktop, 1 passed):
- `relay-start.png` — 카운터 **"1 / 5 주자"**. 활성 2주자 출발선, 대기 4멤버 조끼 색(red/blue) 인필드 정렬. OK.
- `relay-leg.png` — **"3 / 5 주자"**. 레그 진행, 스킬 연출(독수리 snatch) 정상, 대기열 유지. OK.
- `relay-final-leg.png` — **"5 / 5 주자"** = 앤커 레그(laps 기준). 카운터가 팀인원(3) 아닌 laps(5)로 끝까지 셈 → 의도대로. OK.
- `relay-handoff.png` — **"2 / 5 주자"**, 자막 "곰1 배턴 넘겼다! 이어달려!". 출발선 인근 바통 핸드오프, 다음 2주자 라인업, 큐 정렬. 깨짐 없음. OK.

## 검증
- `npm run typecheck`: 통과.
- 디버그 임시 파일 없음, 골든 4장(start/leg/final-leg/handoff) 유지.

## qa-verifier 회부
- 골든 스크린샷 4장 갱신됨(신 릴레이 모델 기준). 경로: `tests/e2e/__screens__/relay-{start,leg,final-leg,handoff}.png`.
- 결정론: 변경은 카운터 텍스트·FX 분기만(무작위 0). 동일 (cfg+seed) 동일 씬.
