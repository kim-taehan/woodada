# 팀전 강화: 편 나누기 UI · 릴레이 · 팀 색상 조끼 — 설계

작성일: 2026-06-18
상태: 구현 완료 (Phase 1·2 모두 통과, 2026-06-18)

## 목표
n대n 팀전을 쉽고 직관적으로 만든다. 세 가지를 하나의 응집된 기능으로 묶는다.
1. **편 나누기 UI** — 셋업 화면에서 참가자를 팀에 쉽게 배정 (현재 `teamId`가 어디서도 채워지지 않는 갭을 메움).
2. **릴레이(이어달리기)** — 팀전 한정, 한 명당 한 바퀴 이어달리기.
3. **팀 색상 조끼** — 레드/블루/화이트/블랙 조끼로 팀을 시각 구분.

## 배경 (현황)
- `DraftParticipant.teamId`·`RaceParticipant.teamId` 필드는 존재하나 UI/로직에서 **한 번도 배정되지 않음**. 팀 모드를 골라도 사실상 편이 안 갈림.
- 모드: `individual`, `2v2`, `3v3`, `2v2v2` (고정 teamLayout, `teamRankSum`). 4팀·릴레이를 표현 불가.
- 엔진은 모든 참가자가 동시에 `laps`바퀴를 도는 구조. 릴레이는 이 모델을 바꾼다.

---

## 1. 모드 구조

고정 팀모드 3개(`2v2`/`3v3`/`2v2v2`)를 제거하고 **두 모드**로 단순화한다.

- **개인전** (`individual`) — 기존 그대로.
- **팀전** (`team`) — 하위 옵션:
  - **팀 수**: 2 ~ 4 (기본 2)
  - **릴레이 토글**: ON = 이어달리기, OFF = 기존 동시출발 랭크합산.

> 기각한 대안: 릴레이/팀수 조합마다 모드를 추가 → 모드 폭발. 토글 방식이 단순.

데이터:
- `gameModes`를 `individual`, `team`으로 재정의. `team`은 `team: true`, 스코어링은 런타임에 릴레이 여부로 분기.
- 팀 수·릴레이 여부는 `RoomStore`/`RaceConfig`가 보유(고정 `teamLayout` 대신).

## 2. 데이터 모델 변경

- **팀 식별자**: `teamId ∈ {'red','blue','white','black'}`.
- **팀 팔레트** (신규, 예: `src/data/teams.ts`):
  | 팀 | id | 라벨 | 조끼 fill | 트림(가독성) |
  |---|---|---|---|---|
  | 레드 | `red` | 레드 | `#E2483D` | 자체 어두운 외곽 |
  | 블루 | `blue` | 블루 | `#2F6BE0` | 자체 어두운 외곽 |
  | 화이트 | `white` | 화이트 | `#F4F4F4` | 짙은 트림 `#444` |
  | 블랙 | `black` | 블랙 | `#2B2B2B` | 밝은 트림 `#DDD` |
- **`RaceConfig.relay: boolean`** 추가 (결정론·리플레이 보존 위해 설정에 포함).
- **`RacerPhase`에 `'waiting'`** 추가 (릴레이 대기 주자).
- **`RoomStore`**: `teamCount: number`(2~4), `relay: boolean` 추가. `DraftParticipant.teamId`는 UI가 채움.

## 3. 편 나누기 UI (SetupScreen)

팀전 선택 시에만 표시:
- 상단: **`자동 편성 🎲`** 버튼(균등 라운드로빈 배분) + **팀 수 셀렉터(2~4)**.
- 각 참가자 행: 기존 캐릭터 칩 옆에 **팀 색 칩 행**(🔴🔵⚪⚫, 팀 수만큼). 현재 팀 칩은 active 표시. 칩 탭 = 그 팀으로 이동.
- 팀 수를 줄이면 사라진 팀에 속한 인원은 자동 재배분(또는 미배정 표시).

검증:
- **릴레이 ON**: 모든 활성 팀의 인원이 같아야 `출발` 활성. 불균등이면 비활성 + 안내("릴레이는 팀 인원이 같아야 해요").
- **릴레이 OFF (랭크합산)**: 불균등 허용. 단 각 팀 최소 1명, 미배정 0명일 때 출발 가능.

## 4. 팀 조끼 렌더링 (PartsCharacter / partsFactory)

- 몸통(torso) 파츠 위에 팀 색 조끼 오버레이를 그린다. 얼굴·눈·다리·꼬리는 원래 색 유지(귀여움 보존).
- 화이트/블랙은 트림 외곽선으로 배경 대비 확보.
- `teamId`가 없으면(개인전) 조끼 미표시.
- 렌더러는 `participant.teamId` → 팀 팔레트 → 조끼 색을 매핑. 엔진은 이미 `RacerState.teamId` 보유.

## 5. 릴레이 엔진 (RaceEngine)

- 팀별 멤버를 **참가 순서 = 레그 순서**로 묶는다. 앤커 = 마지막 레그. 레그 재정렬은 범위 외(YAGNI).
- 릴레이 시 `laps`(팀 기준) = 팀 인원 수.
- **초기 상태**: 각 팀 1번 주자만 `running`(활성), 나머지 `waiting`(트랙 밖, progress 0).
- **매 프레임**: 활성 주자만 전진. 활성 주자가 1바퀴(= `trackLength`) 완주 시:
  - 그 주자 `finished`(파킹).
  - 다음 팀원 `running`으로 결승선에서 출발.
  - **`baton` 핸드오프 `SkillEvent`** emit (변형 신설: `'handoff'`).
- **팀 완주** = 앤커 완주. **팀 순위 = 앤커 골인 프레임 순**.
- **스킬 상호작용**: 활성(`running`) 주자만 스킬 발동·피격. 대기(`waiting`) 주자는 면역·타겟 제외. 기존 핸들러들이 `finished`뿐 아니라 `waiting`도 건너뛰도록 보강. (roar/banana/zoomies/nap/brace 전수 점검.)
- **결정론 보존**: 모든 무작위성은 시드 Rng 서브스트림. 핸드오프·레그 전환은 순수 규칙.

## 6. 릴레이 렌더러

- 동시에 트랙 위 = 팀 수만큼(팀당 활성 1명). 대기 주자는 결승선 옆에 줄 서서 대기 → 바통 받으면 출발.
- **바통 터치 FX** + 실황자막("🔁 바통 터치!", `commentaryLines`에 `handoff` 추가).
- 랩 카운터를 **레그 표시**로 전환(예: "2/3 주자").
- 결정론 보존(무작위 시각요소 없음).

## 7. 결과 화면

- 팀전(릴레이/랭크합산 공통)은 **팀 순위**로 결과 표시. 기존 팀 스코어링 경로 활용, 릴레이는 앤커 골인 순.
- 시상대/색 조끼로 우승 팀 강조.

## 8. 구현 단계

릴레이가 팀 정의에 의존하므로 자연 분할:

- **Phase 1 — 팀 기반 (동시출발 팀전까지 동작)**
  1. 모드 구조 재정의 (`modes.ts`, `teams.ts`, store `teamCount`).
  2. 편 나누기 UI (`SetupScreen`, store `teamId` 배정 + 자동 편성 + 검증).
  3. 팀 조끼 렌더링 (`PartsCharacter`/`partsFactory`).
  4. 결과 화면 팀 표시 확인.
  - 검증: typecheck + 단위테스트 + Playwright 시각검증(조끼 색 육안).
- **Phase 2 — 릴레이**
  1. `RaceConfig.relay`, `RacerPhase 'waiting'`, 레그 시퀀싱·핸드오프 엔진.
  2. 스킬 핸들러 `waiting` 제외 보강.
  3. 릴레이 렌더러(대기/활성, 바통 FX, 레그 카운터).
  4. 릴레이 스코어링(앤커 순) + 결과.
  - 검증: 릴레이 결정론·핸드오프 순서·팀 스코어링 단위테스트 + 바통 연출 시각검증.

## 9. 검증/테스트 계획

- **결정론**: 같은 (config+seed)는 동일 릴레이 재생 — 신규 단위테스트.
- **핸드오프 순서**: 레그 전환이 결승선에서만, 순서대로 일어나는지.
- **팀 스코어링**: 앤커 골인 순으로 팀 순위 산출.
- **공정성**: `engine-bias`는 개인전 기준 유지(릴레이는 별도 느슨한 점검).
- **시각**: 조끼 4색 식별 + 바통 터치 연출 Playwright 캡처 육안.
- **스킬 정합**: 대기 주자가 스킬에 영향받지 않음.

## 10. 영향받는 파일 (예상)

- `src/data/modes.ts`, `src/data/teams.ts`(신규), `src/data/schema.ts`
- `src/engine/types.ts`(RaceConfig.relay, RacerPhase), `src/engine/RaceEngine.ts`, `src/engine/skills/*`(waiting 제외), `src/engine/scoring/team.ts`
- `src/renderer/character/PartsCharacter.ts`·`partsFactory.ts`(조끼), `src/renderer/RaceRenderer.ts`·`fx/*`(바통), `Scoreboard.ts`(레그 카운터)
- `src/shell/store.ts`, `src/shell/screens/SetupScreen.ts`, `ResultScreen.ts`
- 테스트: `tests/unit/`(릴레이·스코어링·schema), `tests/e2e/`(시각)

## 11. 미해결/주의

- 화이트 조끼가 밝은 배경에서, 블랙 조끼가 어두운 외곽선과 묻힐 수 있음 → 트림으로 해결하되 시각검증에서 최종 확인.
- 릴레이에서 팀 수×인원이 참가자 상한(8)과 맞물림 — 4팀이면 팀당 최대 2명.
- 레그 순서 = 추가 순서 고정(재정렬 UI 없음, YAGNI).
