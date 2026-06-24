# c01 engine-dev — speed/power 제거 + 곰 패시브 "몸통 밀치기"

## 변경 파일 (라인은 변경 후 기준)

### 1) speed/power 완전 제거
- `src/data/schema.ts` — `CharacterData`에서 `speed?`/`power?` 필드 + 인버스 스탯 주석 제거. `cornering?` 유지.
- `src/engine/stats.ts` — `speedBias`, `powerEffectScale`, `powerBlockDecel`, `powerEaseSlow` 4개 함수 제거. 모듈 헤더 주석을 cornering 단일 스탯 기준으로 갱신. `statDev`·`sectionSpeedBias` 유지.
- `src/engine/tuning.ts` — `STATS`에서 `speedGain`/`powerResist`/`powerBlockEase` 제거(`corneringGain: 0.35` 유지, 튜닝 안 함). `BEAR_SHOVE` 신규 추가.
- `src/engine/types.ts` — `RacerState.power` 필드 + 주석 제거. `SkillRuntime` 무손.
- `src/engine/RaceEngine.ts`
  - import: `speedBias, powerEaseSlow` 제거, `BEAR_SHOVE` 추가.
  - baseSpeed(~204): `+ speedBias(...)` 제거 → `r.range(BASE_SPEED.min, BASE_SPEED.max)`.
  - racer init(~227): `power: stats?.power` 제거.
  - slowMul 적용부(~675): `powerEaseSlow(slowMul, self.power)` → `Number(self.skill.slowMul ?? 1)` 풀효과.
  - ice 적용부(~992/996): `powerEaseSlow(zone.slowFactor, self.power)` → `zone.slowFactor` 풀효과. penguin boostFactor 분기 유지.
- `src/engine/overtake.ts` — `powerBlockDecel` import 제거. 두 blockDecel 호출부(~125/138) → `OVERTAKE.blockDecel` 직접.
- `src/engine/skills/banana.ts` — `powerEffectScale` import 제거. stunFrames에서 곱하기 제거(풀 스턴).
- `src/engine/skills/abduct.ts` — `powerEffectScale` import + `resist` 변수 제거. pull 거리 풀효과. 스탯 언급 주석 갱신.
- `src/engine/skills/bristle.ts` — `powerEffectScale` import 제거. pushBack 풀효과.

### 2) 곰 패시브 "몸통 밀치기" (신규)
- `src/engine/tuning.ts`의 `BEAR_SHOVE = { lanePush: 0.03 }` (작게 시작).
- `src/engine/RaceEngine.ts`의 `applyBearShove()` 함수 추가 + 프레임 루프에서 `resolveForwardZones` 직후 `fireOvertakeHooks` 직전 호출.
- 동작: 곰(`characterId==='bear'`, active)이 같은 레인 밴드(`|Δlane| ≤ OVERTAKE.laneNear`) + 전방 근접(`0 ≤ gap ≤ ZONE.minGap`)인 상대를 매 프레임 바깥(lane += 0.03, max 0.95 clamp)으로 밀어냄. 곰 자신 페이스 무변경.
- 막혔을 때만(blockDecel)이 아니라 **접촉 시 상시** 발동 → 난투 팩에서 자주 발동. 죽은 blockDecel과 반대.
- 결정론: Math.random 없음, rng draw 추가 없음. 순수 위치/조건 기반. progress 확정 후 실행이라 순서 안정.
- 곰의 `roar` 스킬은 무손.

## 깨진/갱신 테스트
- `tests/unit/schema.test.ts` — `'every character has inverse speed/power flavor stats'` 블록 삭제(스탯 제거됨).
- `tests/unit/skills.test.ts` — pinnedAlien 스프레드의 `speed:3, power:3` 제거(필드 없어짐), 주석 갱신.
- `tests/unit/relay.test.ts` — `'handoffs land… incoming restarts from 0'`에서 `incoming.phase === 'running'` 단언 완화.
  - 원인: speedBias 제거로 전 레이서 baseSpeed가 미세 이동 → 특정 시드에서 릴레이 주자가 출발선 교통량 속으로 재시작해 첫 프레임 `blocked`로 읽힘(계약 위반 아님, 핸드오프 정상). 곰 셔브 끄고도 동일 → 순수 수치 이동.
  - 변경: `phase !== 'waiting' && phase !== 'finished'` (= 온트랙·재시작 확인)으로 완화. progress<5, before.phase==='waiting'/progress===0 단언은 유지.

## 검증 결과
- `npm run typecheck`: 통과(에러 0). 데이터 캐릭터 파일은 content-designer가 이미 speed/power 제거해둠 → 데이터發 타입에러 없음.
- `npm run test`: **9 files / 61 tests 전부 통과.**
- **engine-bias 게이트 7개 전부 통과** (laps 1/3/10): 모든 캐릭터 승리 가능·아무도 >0.45 독주 안 함, 모든 출발 슬롯 공정, no-runaway(팩 뭉침 + 리드 교체). → cornering 직선편향으로 인한 게이트 붕괴 없음. corneringGain 임의 조정 안 함.
- determinism 테스트: 같은 config 두 런 동일 재생 통과(절대 스냅샷 핀 없음, 양쪽 동일 이동이라 무영향).

## 보류/위험
- `BEAR_SHOVE.lanePush=0.03`은 의도적으로 작게 시작. 실제 곰 어드밴티지 체감/승률 영향은 밸런스 정밀 튜닝과 함께 추후(사용자 명시 보류). balance-tuner가 하니스로 측정 후 조정 권장.
- 곰 셔브는 레인만 밀어 속도 무영향(레인 중립성 유지). 밀린 상대는 바깥 레인 → 곡선에서 distLoss로 약간 손해 → 곰의 간접 어드밴티지. 직접 감속 아님.
