# 18 — engine-dev: 릴레이 "레그 수 = laps, 멤버 순환" 모델

## 요약
릴레이를 "팀원 1명 = 1레그(=팀크기만큼 레그)" 고정에서 **"레그 수 = 사용자 선택 `laps`, 멤버 순환"**으로 변경.
레그 i(0-base) 주자 = `members[i % size]`. 앤커 = 레그 `laps-1` 주자. 멤버 재등장(running↔waiting) 지원.
비릴레이 경로·스킬·스코어링·아이템·레인 전부 불변. 결정론 유지.

## 변경 파일
- `src/engine/RaceEngine.ts` — 릴레이 레그 큐/완주/핸드오프 로직 전면 재작성.
- `src/engine/scoring/relay.ts` — 앤커 산정을 "마지막 참가자"에서 **`members[(laps-1)%size]`**로 변경.
- `tests/unit/relay.test.ts` — 순환 모델에 맞춰 재작성 + 신규 케이스 5종 추가.
- `src/shell/store.ts` — **변경 없음**(원래 `this.laps`(1~5 셀렉터)를 그대로 RaceConfig에 전달. laps를 팀크기로 덮어쓰던 곳은 store가 아니라 엔진 릴레이 분기였음).

## 새 레그 모델 (요점)
- 팀별 레그 총수 = `config.laps`. 레그 i 주자 = `members[i % size]` (참가 순서, 0-base).
- `RacerState.leg` = **현재 레그(0-base)**. running이면 지금 달리는 레그, waiting이면 다음에 달릴 레그, finished면 최종(앤커) 레그.
- 초기: 레그 0 주자(`members[0]`)만 `running`, 나머지 `waiting`. 멤버 첫 레그 = 참가 인덱스 j.
- 레그 경계(결승선 통과):
  - **앤커 레그(`leg >= laps-1`)**: 팀 완주. 주자에게 `finished` + `rank`(도착 프레임 순) 부여, `teamsFinished++`.
  - **비앤커 레그**: `teamLeg` +1, 다음 주자 = `members[(leg+1)%size]`.
    - 다음 주자가 **자기 자신**(순환 wrap, 예 1인팀): progress=0, leg+1, `running` 유지(waiting hop 없음). 핸드오프 이벤트 targetId=self.
    - 다음 주자가 **다른 멤버**: finisher → `waiting`(progress=0, 다음 자기 레그 `leg+size`로 leg 갱신, skill burst/effect 클리어), 다음 멤버 → `running`(progress=0, leg=leg+1). 핸드오프 이벤트 emit.
- **레이스 종료 조건**: 릴레이는 `teamsFinished >= 팀수`(전역 racer 카운트 아님 — 멤버 재등장으로 카운트가 안 정착하므로). 비릴레이는 기존 `finishedCount >= racers.length` 그대로.
- `size > laps`로 한 번도 안 달리는 멤버: `leg=undefined`, `waiting` 영구(불활성, 타깃 안 됨). 팀 종료 조건이 team 기반이라 레이스를 막지 않음.
- 무작위성 0 — 순수 규칙 파생. 결정론·레인 중립성 영향 없음.

## 핸드오프 이벤트 (현행 유지)
- `{ type:'relay', variant:'handoff', racerId:<finisher>, targetId:<다음 레그 주자> }`.
- targetId가 finisher 자신일 수 있음(1인팀/순환 wrap). 비앤커 레그마다 1개 → 팀당 `laps-1`개.
- 앤커 레그는 핸드오프 없음(그 완주가 곧 팀 완주).

## 스코어링 (relay.ts)
- 앤커 = `members[(laps-1)%size]` (이전: "마지막 참가자"). 팀 순위 = 앤커의 `order` 내 위치.
- 엔진이 앤커 레그 완주자에게만 rank를 주므로, 그 racer의 `order` 위치가 팀 순위.

## 자가검증
- `npm run typecheck`: 통과.
- `npm run test`: **40/40 통과** (relay 10, determinism 4, bias 2, skills 7 등). 비릴레이 회귀 0.

### relay.test.ts 갱신 사유
기존 3개 테스트가 깨졌고 **모델 변경으로 인한 정당한 실패**라 갱신:
1. `handoff: each team runs exactly (size) legs` — 기본 laps=1 가정("size 레그, size-1 핸드오프")이 무효. 이제 레그=laps. → laps 명시 + "레그=laps, 핸드오프=laps-1"로 재작성.
2. `anchor scoring` — 기존 앤커="마지막 참가자"(p2/p3) 가정. laps=1이면 앤커=레그0 주자(p0/p1). → 앤커=`(laps-1)%size`로 재작성.
3. `teamRelay scoring strategy` — 동일 사유. detail 기대값 갱신.

### 추가된 신규 케이스
- ① **3명+5바퀴 → 5레그, 주자 i%3** (`p0,p1,p2,p0,p1`).
- ② **앤커=레그(laps-1) 주자, 팀순위=앤커 골인순** (finished는 앤커만).
- ③ **멤버 재등장 running↔waiting 정확** (waiting 구간 progress/speed=0 불활성, 비앤커는 finished 안 됨, 앤커만 finished).
- ④ **팀 크기 불균등(2명 vs 3명) 둘 다 laps 레그**.
- ⑤ **결정론** (laps=5 동일 재생).
- 보너스: `laps>size` 순환 앤커(`(laps-1)%size`) 스코어링, 1인팀(매 레그 자기 핸드오프).

## 후속 회부 명세

### shell-dev
1. **릴레이 시 팀 인원 균등 더 이상 필수 아님.** 모든 팀이 정확히 `laps` 레그를 달리므로 인원이 달라도 공정. shell 검증을 "각 팀 ≥1명·미배정 0"만으로 완화 가능("인원 같아야" 제약 제거).
2. `laps` 셀렉터(1~5)는 그대로 릴레이의 **레그 수**로 쓰임. store.buildRaceConfig는 이미 `this.laps`를 그대로 전달하므로 추가 변경 불필요.

### renderer-dev
1. **레그 카운터 총수 = `laps`** (현재 `relayLegTotal`을 팀 최대 인원으로 계산 — `src/renderer/RaceRenderer.ts:391-397`). 릴레이일 때 `relayLegTotal = cfg.laps`로 바꿔야 "n / laps 주자"가 맞음. 카운터 표시는 `running` racer의 `leg+1`을 쓰므로 그대로 동작.
2. **`waiting` 의미 확장**: "내 첫 레그 대기"뿐 아니라 **"내 다음 레그 대기"**(이미 한 번 달리고 돌아온 멤버)도 포함. 대기열 정렬은 `leg` 오름차순(`RaceRenderer.ts:464`)이며, 재등장 멤버의 `leg`는 다음 자기 레그로 갱신되므로 정렬 의미는 유지됨.
3. **`RacerState.leg` = 현재 레그(0-base)**임을 확정. running=지금 레그, waiting=다음 레그, finished=최종(앤커) 레그. (이전엔 "고정 참가 인덱스"였음 — 이제 동적.) 핸드오프 이벤트 `targetId`가 **자기 자신**일 수 있음(1인팀/순환 wrap) — 연출에서 self-handoff 처리 확인 필요.

### qa-verifier
- 결정론 영향 있는 변경(릴레이 레그/완주/종료 로직 재작성). relay.test 10종 + determinism 통과 확인됨. e2e 릴레이 시각(`relay-visual.spec.ts`)은 renderer-dev의 `relayLegTotal` 반영 후 재캡처 권장.
