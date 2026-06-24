# s18 · engine-dev · 엔진 묶음 5건 (순차·일관)

엔진 순수성/결정론 불변 규칙 준수. 모든 무작위성은 시드 `Rng` 서브스트림(`skill:<id>` + 라벨 fork), `Math.random` 0. 5건을 한 패스로 구현 후 합쳐서 검증.

## 1) 캣워크 반응형 재설계 (저스트 회피)
- **선제 tick 제거**: `catwalk.ts` 는 이제 빈 `SkillDef`(`{}`) — self-activation tick 없음 → "갑자기 켜짐" 해소. `skills.has('catwalk')` 는 유지.
- **반응형 dodge**: 엔진 `tryCatwalkDodge(cat, events)` 가 실제 `ctx.tryDodge(cat)` 호출(banana/roar/abduct/bristle/item) 시점에 결정.
  - 고양이 catwalk **쿨다운이 차 있을 때만** `dodgeChance` 굴림. 성공 → 쿨다운 소모(필드 스케일 적용) + `slipBoost` 전진 슬립(`burst`, `straying`, 막힘 가능) + `catwalk:activate` + `catwalk:dodge`(targetId=고양이) emit. 실패 → 쿨다운 미소모(다음 공격에 다시 시도 가능).
  - dodgeUntil 회피창 모델 제거(`types.ts` 에서 `dodgeUntil`/`dodgeChance` 런타임 필드 삭제, params 의 `dodgeChance` 직접 참조).
- **결정론**: 굴림은 `skill:cat:<id>` 를 `fork('dodge:'+frame)` 으로 per-(cat,frame) 메모이즈(`dodgeFrame`/`dodgeRoll`) → 한 프레임 다중 공격자 동일 결과, 드로 순서 무관. 부수효과(쿨다운/슬립/emit)는 첫 해결 호출에서 **정확히 1회**.
- **호환**: 기존 `banana:dodge`/`roar:dodge` 등 disruptor 측 dodge 이벤트(targetId=고양이) 그대로 유지 → 렌더러 냥펀치/캣워크 멘트 호환. `catwalk:activate`/`catwalk:dodge` 커멘터리 키 기존 존재.
- **dodge.ts**: `resolveDodge`/`isInDodgeWindow` → `rollDodge(cat, frame, rng, chance)` 로 교체(굴림+메모만 담당, 쿨다운/부수효과는 엔진).
- **DISRUPTORS 정리**: 반응형이라 위협목록 자체가 불필요해져 catwalk.ts 의 죽은 `DISRUPTORS`(divebomb 포함) 전부 제거.
- **applyIce 의 고양이 ice-jump**: `params.dodgeChance` 직접 참조 경로라 영향 없음(그대로).

## 2) 쿨다운 필드 인원수 스케일링 (릴레이 대기주자 제외)
- `tuning.ts` 에 `COOLDOWN_FIELD` 노브: `factor = clamp(1 + max(0, active-kneeAt)*perRacer, 1, maxFactor)`. 기본 ≤6명 ×1, 16명 ×2(cap).
- **active = 실제 달리는 주자만**: `phase` `waiting`(릴레이 대기)·`finished` 제외(`activeRunnerCount()`).
- 적용 지점 일관: **초기 쿨다운**(init, 시작 활성 주자 수 기반) + **fireSkill 재무장** + **캣워크 dodge 성공 쿨다운** + **스턴 리셋 롤** 전부 동일 factor.
- 결정론: factor 는 결정론 카운트의 순수 함수.

## 3) 스킬 발동 직후 0.3초 i-frame
- `types.ts` 에 `skillInvulnUntil`. `SKILL_INVULN_FRAMES = round(300/DT_MS)`.
- fireSkill 의 **activated 시점**(any 성공 — 외계인이 copy한 스킬도 동일 self)에서 `self.skill.skillInvulnUntil = frame + SKILL_INVULN_FRAMES`.
- 모든 방해 핸들러(banana/roar/abduct/bristle) + 아이템(lightning/shell/fart) 가 타겟 i-frame 체크해 무효 시 기존 `dodge` variant 재활용(과한 새 연출 없음).
- **우선순위 일관**: 별(star) > i-frame > 캣워크 회피 > 적중 — 각 핸들러에서 star 체크 직후 i-frame 체크, 그 다음 `tryDodge`.

## 4) 원숭이 바나나 앞/뒤 양방향
- `monkey.ts` `params.target: 'front' → 'either'`. banana.ts 는 이미 `'either'` → `rng.bool(0.5)` 로 매 발동 앞/뒤 랜덤. 핸들러 무변경. 1등도 뒤로 던질 수 있어 항상 유효 + 변주.

## 5) 스턴 시 스킬 쿨다운 리셋
- **중앙 처리**: `step()` 시작에 기존 stunned 스냅샷(`wasStunned`), 스킬+아이템 처리 후 패스에서 **이번 프레임 새로 stunned 된 주자만** `skillCooldownUntil = max(현재, 스턴종료) + 새 롤(skillRng, 필드 스케일)`.
- banana/roar/shell 등 모든 스턴 소스를 한 곳에서 일괄 처리(핸들러 수정 불필요). 스테이블 `order` 로 rng 드로 순서 결정론 유지.

## 상호작용 처리
- 별/ i-frame/ 캣워크/ 바나나가 방해 적용 경로에 얽히는 부분: 각 disruptor 에서 **star → i-frame → catwalk dodge → hit** 순서로 일관. mimic 이 copy한 스킬도 동일 ctx 경유라 같은 규칙 적용. 안티스택(banana/abduct immune)·팀 제외 기존 가드 보존.
- prng fork 는 부모 스트림 미전진 → dodge fork·icejump fork 가 쿨다운/스턴 롤 순서를 흩뜨리지 않음.

## 검증 결과
### typecheck — PASS
### npm run test — 55/55 PASS
- determinism(같은 config+seed 동일 재생), engine-bias(laps 1/3/10 char·slot 가능/비독주, no-runaway), scoring, schema, relay, skills 전부 통과.
- skills.test 갱신: catwalk 케이스 2개 반응형 재작성(쿨다운 게이트·결정론), 신규 케이스 3개 추가 — **바나나 양방향**(앞·뒤 둘 다 hit 관측), **i-frame**(landed hit 의 타겟은 i-frame 아님), **스턴 쿨다운 리셋**(새로 stunned 주자의 쿨다운 > 스턴종료). self-activation 리스트에서 catwalk 제외(이제 반응형). 16명 필드에서 abduct 타깃 확보 위해 시드 budget 확대.

### balance.ts — 독주 없음 확인
INDIVIDUAL (no ⚠ DOMINATES, no ⚠ floor 어느 lap 도):
- laps=1: bear 25%(1.96×) 최고, penguin 8%(0.64×) 최저. winner led 0.514.
- laps=3: bear 22%, 최저 0.75×. winner led 0.404, 11.8 lead-changes.
- laps=10: bear 23%, alien 0.46× 최저. winner led 0.291, 26.3 lead-changes.
- **개인전 누구도 0.45 독주 없음, 모두 can-win floor 위.**

**원숭이(바나나 양방향)·고양이(반응형) 과하지 않음**: monkey 개인 11%/team 6%(오히려 약체쪽), cat 개인 11~12%(중위). 두 변경 모두 OP 안 됨.

**유일 우려 — bear TEAM rank-sum 독주(37%→45%, 2.97~3.64×)**: 이는 **이번 묶음 이전부터 브랜치에 있던 bear roar range=28 변경**(task #12) 의 결과로, task #21(곰 팀전 교차 조율 + 엔진 묶음 후 전반 재밸런스)에 배정된 별건. 내 5건은 오히려 곰 우위를 **줄이는** 방향(i-frame 으로 roar 피해 감소, 16명 ×2 쿨다운으로 roar 빈도↓). 엔진 로직은 일관 유지하고 임의 과튜닝하지 않음 → 곰 팀 재밸런스는 balance-tuner/#21 로 위임 권장.

## 변경 파일
- src/engine/types.ts (dodgeUntil 제거, skillInvulnUntil 추가)
- src/engine/tuning.ts (COOLDOWN_FIELD)
- src/engine/RaceEngine.ts (필드 스케일·i-frame·반응형 tryCatwalkDodge·스턴 리셋·item immune)
- src/engine/skills/catwalk.ts (빈 SkillDef 반응형)
- src/engine/skills/dodge.ts (rollDodge)
- src/engine/skills/banana.ts / roar.ts / abduct.ts / bristle.ts (i-frame 가드)
- src/data/characters/monkey.ts (target: either)
- tests/unit/skills.test.ts (catwalk 재작성 + 신규 3 케이스)

## renderer-dev/qa 통지 필요
- 새 `SkillEvent.variant` 추가 없음(기존 activate/dodge 재사용). 단 **catwalk 가 이제 반응형 emit** → renderer 의 catwalk FX/멘트는 "공격받아 회피한 순간"에만 뜸(선제 버프 표시 제거 필요할 수 있음, 멘트 키는 호환).
- i-frame/스턴리셋/필드쿨다운은 결정론 상태에 영향(골든 스크린샷 시드별 재생 바뀜) → qa 골든 갱신 필요.
