# c06 engine-dev — 고슴도치 작은 표적 패시브

## 🦔 고슴도치 — 작은 표적 (원거리 타격 확률 회피)
작고 낮아 원거리 타격이 일정 확률로 빗나간다. 대상 3종: 🍌 바나나(banana), 🕸️ 거미줄(abduct), 🐢 등껍질(shell 아이템). 외계인 aoeImmune과 달리 **확률적**(면역 아님).

### 트레이트 + 결정론 회피 roll (catwalk dodge 패턴 그대로)
- `src/data/schema.ts` — `CharacterData.rangedEvade?: number`(0~1) 트레이트.
- `src/engine/types.ts` — `RacerState.rangedEvade?` + SkillRuntime에 `evadeFrame`/`evadeRoll` 메모(= dodgeFrame/dodgeRoll 미러).
- `src/engine/skills/dodge.ts` — `rollRangedEvade(target, frame, targetRng, chance)` 신규. 타겟 자기 시드 서브스트림을 `fork('evade:'+frame)`(dodge:와 다른 라벨)로 굴리고 (target,frame)당 메모 → 같은 프레임 여러 공격자 일관(공격자 순서 무관). chance 0이면 즉시 false.
- `src/engine/skills/types.ts` — SkillContext에 `tryRangedEvade(target)` 추가.
- `src/engine/RaceEngine.ts`
  - racer init `rangedEvade: stats?.rangedEvade` 복사.
  - `tryHedgehogEvade(target)` 엔진 헬퍼(= tryCatwalkDodge 미러, but 쿨다운/부작용 없음 — 상시 트레이트). 데이터 트레이트 기반, id 하드코딩 없음.
  - 공유 컨텍스트에 `tryRangedEvade: (t) => tryHedgehogEvade(t)` 와이어(메인 ctx + mimic 서브컨텍스트 둘 다 `...shared`로 포함 → 외계인이 바나나/거미줄 카피해도 회피 적용).
  - CHARACTER PASSIVES 인덱스에 🦔 추가 + 결정론 주석 보정.
- `src/data/characters/hedgehog.ts` — `rangedEvade: 0.3`.

### 적용 지점 (3종, 타격 직전 회피 체크 → 미스 + dodge emit)
- `banana.ts` — `tryDodge` 다음에 `if (ctx.tryRangedEvade(target)) { emit dodge; return; }` (fizzle, 재타겟 안 함).
- `abduct.ts` — 동일 위치에 추가(끌기 전 미스).
- `applyItemPickup` shell 분기 — 선두가 회피 시 stun 안 걸고 `item/dodge` emit, 아니면 기존 shellhit.

### 결정론
- 회피 roll은 타겟 시드 서브스트림 fork(안정 라벨 `evade:frame`), (target,frame) 메모 → 공격자 순서 무관·재생 동일. RNG는 시드 스트림만. 메인 드로 순서 영향 없음.

### 테스트
- 신규 `tests/unit/skills.test.ts` "hedgehog 작은 표적": 고슴도치 팩(monkey·spider 공격자 + shell)에서 원거리 소스가 고슴도치에게 **dodge도 hit도 둘 다** 발생(면역 아님 확인) + 같은 (config,seed) 재시뮬이 고슴도치 원거리-이벤트 스트림 정확 재생(결정론). 단독 실행 20 테스트 통과.

## ⚠️ 동시편집 충돌 관측 (내 작업 아님 — 보고)
전체 스위트 1차 실행에서 **`nearestBoxLane is not defined` 런타임 에러로 거의 전 테스트가 무더기 실패**(44 failed). 조사:
- `nearestBoxLane`은 내가 만든 게 아님 — **다른 에이전트가 RaceEngine.ts에 동시 추가한 "아이템 박스 적극 획득(box-seek)" 기능**(`nearestBoxLane` 헬퍼 + `applyOvertake` 5번째 인자 `boxLane?` + `ITEM.seekReach/seekLaneReach`).
- 내 단독 `vitest run skills.test.ts`는 직전에 20개 전부 통과했었음 → 그 사이 공유 워킹트리에 다른 에이전트의 미완/전이중 편집이 끼어든 타이밍 충돌(hoisted function이 "not defined"인 건 부분 저장 상태에서만 가능).
- 직후 `npm run typecheck`는 **클린 통과**(파일이 이제 정합) → 일시적 mid-edit 상태였음. 그 기능은 건드리지 않고 전체 스위트 재실행으로 내 변경 정합성만 재확인.

## 검증
- `npm run typecheck`: 통과.
- `npx vitest run skills.test.ts`(단독): 20 통과.
- 전체 스위트(determinism + engine-bias 포함): box-seek 정합 후 재실행 **67 tests / 9 files 전부 통과**(engine-bias 7 게이트 포함, 슬롯공정성 회귀 없음 — 앞서 올린 laps=10 N=300 유지).

## 메모
- 새 SkillEvent variant 없음(`dodge`·`shellhit` 기존 재사용). banana/abduct dodge는 엔진 emit이 `type`을 스킬타입으로 스탬프, shell은 `type:'item'/variant:'dodge'` → renderer는 기존 미스 연출 재사용. renderer-dev 통지 불필요.
- 세기(`rangedEvade=0.3`)는 작게 시작 — 밸런스 패스에서 balance-tuner 조정.
- content-designer가 character-guide.md에 작은 표적 문서화(엔진과 일치).
- 마지막 fox 패시브 지시 대기.
