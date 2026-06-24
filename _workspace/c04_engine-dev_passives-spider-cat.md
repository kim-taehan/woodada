# c04 engine-dev — 거미 벽타기 + 고양이 코너탈출 (이미 구현 완료)

> 주의: team-lead 메시지는 stale. 이 두 패시브는 **직전 작업(c03 배치)에서 이미 구현·검증 완료**되어
> 코드에 반영돼 있다. 재구현하지 않고 현재 상태를 확인(typecheck + 해당 테스트 통과)했다.
> 상세 설계/밸런스 근거는 `c03_engine-dev_passives-alien-penguin.md`(4종 통합본)에 있음.

## 🕷️ 거미 — 벽타기 (곡선 바깥 레인 거리손해 감소) — 반영됨
- `src/data/schema.ts:83` — `CharacterData.outerGrip?: number` (트레이트).
- `src/engine/types.ts:140` — `RacerState.outerGrip?: number`.
- `src/engine/RaceEngine.ts:229` — racer init `outerGrip: stats?.outerGrip` 복사.
- `src/engine/overtake.ts:48` — `laneDistanceFactor(lane, onCurve, outerGrip = 0)`; 유효 distLoss = `LANE.distLoss * (1 - clamp(outerGrip,0,1))`. 기본값 0 → 기존 호출부/`engine/index.ts` 공개 re-export 전부 하위호환.
- `src/engine/RaceEngine.ts:762` — 유일 호출부 `laneDistanceFactor(self.lane, onCurve, self.outerGrip)`.
- `src/data/characters/spider.ts:29` — `outerGrip: 0.3`.
- 테스트: `tests/unit/overtake.test.ts` "벽타기 (outerGrip)" 통과.

### 밸런스 주의 (이미 보고함)
team-lead 제시 시작값 **0.5는 engine-bias 슬롯공정성 게이트(laps=10)를 깸** → 측정 후 **0.3**으로 시작값 조정.
거미 승률은 베이스라인과 거의 동일(0.17), 슬롯공정성 floor 위반만 해소. corneringGain 등 공유 노브는 안 건드림. 최종 세기는 밸런스 패스에서 balance-tuner 재검토 요망. (표/근거는 c03 참조.)

## 🐱 고양이 — 코너 탈출 가속 — 반영됨
- `src/engine/tuning.ts:277` — `CAT_CORNER_EXIT = { boost: 0.06, windowFrames: 15 }`.
- `src/engine/RaceEngine.ts:707` `applyCharacterSpeedPassives()` — 곡선→직선 전환 시 `self.skill.cornerExitUntil = frame + windowFrames` 래치, 윈도우 동안 `speed *= 1 + boost`. 스킬백 키 `prevOnCurve`/`cornerExitUntil`(기존 키와 충돌 없음). characterId 분기(1캐릭터 전용이라 트레이트 안 만듦). 순수 구간/프레임, RNG 없음.
- 테스트: `tests/unit/skills.test.ts` "cat 코너 탈출 가속" 통과(전환 프레임 무장 + 무장 시 항상 직선 단언).

## 패시브 정리 (요청대로 이미 반영됨)
- `RaceEngine.ts:646` `// ─── CHARACTER PASSIVES ───` 인덱스 주석 1개로 6종(곰·강아지·alien·penguin·거미·고양이) 한눈에.
- penguin + cat을 `applyCharacterSpeedPassives()` 헬퍼 1곳으로 통합(per-racer 속도, advance 내부). 펭귄 기존 인라인 블록 이동(동작 동일).
- bear(`applyBearShove`)·dog(스턴루프)는 훅 지점이 본질적으로 달라 단일 호출점 강제 안 함(과한 추상화 회피) — 분산 지점에 `(see CHARACTER PASSIVES)` 포인터. 강아지·곰 동작 보존.

## 검증 (이번 턴 재확인)
- `npm run typecheck`: 통과.
- `npx vitest run overtake.test.ts skills.test.ts`: 24 통과(벽타기·코너탈출·alien AOE 포함).
- 전체 스위트는 직전 c03 배치에서 **65 tests 통과**(determinism 4 + engine-bias 7 게이트 포함). 이번 코드와 동일.

## 메모
- 두 패시브 모두 **새 SkillEvent/variant/phase 없는 순수 거리/속도 변경** → 전용 연출 없음, renderer-dev 통지 불필요. content-designer 통지: spider `outerGrip:0.3` 반영(고양이는 데이터 변경 없음).
- 남은 monkey·hedgehog·fox 패시브 지시 대기.
