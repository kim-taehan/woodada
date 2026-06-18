# 15 · engine-dev · 신 스킬 catwalk·snatch + nap·brace 제거 + 면역 일반화

## 결과 요약
- `npm run typecheck` PASS
- `npm run test` PASS (36/36, engine 전부 통과: determinism/bias/scoring/relay/overtake/skills)
- 시각 골든(race-visual)은 qa-verifier 영역 — 여기서 미실행.

---

## 면역 헬퍼 설계 (핵심)
`src/engine/skills/immunity.ts` 신설 — "이 레이서가 지금 방해 면역인가" 단일 진실원천.

```ts
export function isDisruptImmune(racer: RacerState, frame: number): boolean {
  return (racer.skill.immuneUntil ?? 0) > frame;
}
```

- catwalk 핸들러가 `self.skill.immuneUntil = frame + immuneMs/DT` 로 설정.
- banana·roar·snatch·아이템 미끄덩(RaceEngine.updateBoxes) 4곳 모두 이 헬퍼로 면역 판정.
- 기존 brace 전용 `braceUntil` 패턴을 완전히 대체. `SkillRuntime.braceUntil` 필드 제거 → `immuneUntil` 추가.

---

## 신 스킬 핸들러

### catwalk (`src/engine/skills/catwalk.ts`, cat)
- `immuneUntil` = frame + immuneMs 환산. 이 창 동안 모든 방해 무시(dodge).
- 같은 창 길이로 `burst = slipBoost` 부여(매끄러운 전진). **phase는 running 유지(블록 가능)** — zoomies처럼 plow 안 함.
- 창 종료 시 burst 클리어: `RaceEngine.resolveTimer`에 "running 상태에서 effectUntil 만료 시 burst 일반 클리어" 분기 추가(straying 외 케이스).
- emit: `activate`(line=cat.skill).

### snatch (`src/engine/skills/snatch.ts`, eagle)
- 자기보다 앞(progress 큰)·range 내 가장 가까운 1명 선택. 팀원·finished·waiting 제외.
- 동률 progress tie-break = **racer id 사전순**(결정론·드로순서 독립, sort 중 rng 미사용).
- 표적이 면역(catwalk) → 강탈 실패 `dodge` emit. 표적 없음 → `activate`만(헛스윙).
- 명중 시 `target.progress = max(0, progress - dropBack)` + `hit` emit.
- **rng 미사용**(tie-break를 id로 처리해 서브스트림 안정).

---

## 제거/정리
- 삭제: `src/engine/skills/nap.ts`, `src/engine/skills/brace.ts`. `skills/index.ts`에서 등록 해제, catwalk/snatch 등록.
- `RaceEngine.ts`: resolveTimer의 nap wake 분기 삭제(events 인자 제거), tryActivateSkill/advance/updateBoxes의 `napping` 분기 삭제, 아이템 미끄덩 면역체크 `braceUntil`→`isDisruptImmune`.
- `overtake.ts`: brace 전용 unblockable 블록 삭제. (`straying`은 zoomies가 쓰므로 유지.)
- `types.ts`: `SkillRuntime`에서 `hasNapped/wakeBurst/wakeFrames/wakeLine/braceUntil` 제거, `immuneUntil` 추가.
- `schema.ts`: `SkillType` 유니온 = `zoomies|catwalk|banana|snatch|roar|(string&{})`.
- `scripts/balance.ts`: ids/wins 맵 새 로스터(dog/cat/monkey/eagle/bear)로 갱신.

### ⚠️ renderer-dev 인계 (내 변경으로 dead 됐지만 렌더러가 아직 참조 → 안 건드림)
- `RacerPhase`의 `'napping'`: **엔진은 더 이상 생성 안 함**. 단 `src/renderer/character/PartsCharacter.ts:261`이 `phase === 'napping'`을 참조 중 → 타입 유지(legacy 주석 달아둠). 렌더러 정리 필요.
- `SkillEvent.variant`의 `'wake'`: 엔진 미발행. `src/shell/RaceController.ts:58`이 참조 중 → 유니온 유지. 렌더러/셸 정리 필요.

---

## renderer-dev용 이벤트 형태 (정확한 계약)
모든 이벤트는 엔진이 `{frame, racerId, type}`을 자동 채움(type = 활성자의 skill.type). 아래는 핸들러가 emit하는 부분.

| 스킬 | variant | racerId | targetId | line | 의미 |
|---|---|---|---|---|---|
| catwalk | `activate` | cat | — | cat.lines.skill (`캣워크~ 😼`) | 면역+슬립 발동 |
| snatch | `activate` | eagle | — | eagle.lines.skill (`콱! 낚아챈다!`) | 발동(헛스윙 포함) |
| snatch | `hit` | eagle | 표적 | — | 표적을 dropBack만큼 끌어내림 |
| snatch | `dodge` | eagle | 표적(면역 cat) | — | 면역 표적 놓침 |
| banana | `dodge` | monkey | 표적(면역 cat) | — | **신규**: 면역 표적이 바나나 회피 |
| roar | `dodge` | bear | 표적(면역 cat) | — | **신규**: 면역 표적이 포효 무시 |

### dodge line 규칙 (중요)
- **catwalk 회피 dodge**(snatch/banana/roar가 면역 cat을 칠 때): 이벤트에 `line` **없음**. 회피하는 주체는 cat이므로, 렌더러가 `targetId`의 캐릭터(cat)의 `lines.dodge`(`냐옹, 안 맞지롱`)를 띄워야 함.
- banana의 기존 `dodgeChance` 자체 dodge는 **종전대로** monkey의 `lines.dodge`를 line으로 실어 보냄(던진 쪽이 빗나간 개그). 즉 banana는 두 종류 dodge가 있음: ① 면역 회피(line 없음, targetId=cat) ② 확률 빗나감(line=monkey dodge).
- catwalk 자체는 dodge를 emit하지 않음(면역의 결과는 가해 핸들러가 emit). renderer는 cat 위에 dodge 말풍선을 띄울 때 targetId=cat인 dodge 이벤트를 보고 처리.

### content-designer 인계
- 새 스킬은 추가 params 요구 없음(cat: immuneMs/slipBoost, eagle: range/dropBack 그대로 사용). 단 **밸런스로 일부 수치 조정**(아래) — 검토 바람.

---

## 밸런스 (npx vite-node scripts/balance.ts, N=3000 / bias N=1200)

새 로스터 dog/cat/monkey/eagle/bear ×2. 자기부스트 2종(dog,cat)·방해 3종(monkey,eagle,bear) 구조라 방해형(특히 단일표적 monkey)이 눌리는 경향.

### params 조정 내역 (before → after)
| 캐릭터 | param | before(content-designer) | after(밸런스) | 이유 |
|---|---|---|---|---|
| cat | slipBoost | 0.6 | **0.16** | 0.6은 cat 단독 독주(승률 0.77, >0.45). 면역+상시부스트가 과함. |
| monkey | dodgeChance | 0.35 | **0.2** | 새 필드에서 monkey가 약체(<0.1 floor). 던지기 명중률↑로 0.1 floor 통과. |
| eagle | dropBack | 90 | 90 (유지) | dropBack↓는 monkey floor에 무효 → 원복. |

slipBoost는 0.6→0.3→0.18→0.14→0.16 반복 측정. catwalk를 straying(plow)→running(블록가능)으로 바꿔도 필드가 흩어져 있어 밸런스 영향 미미(보정은 boost 크기로). 최종 0.16.

### 최종 수치 (N=3000)
```
win rate: dog 0.283  cat 0.275  monkey 0.112  eagle 0.122  bear 0.208
slot wins: 0.162 0.131 0.051 0.062 0.096 | 0.121 0.143 0.061 0.060 0.112
avg lead changes/race: 7.7
```
- 독주(>0.45) 없음 ✅  약체(<0.18 floor=0.1 기준) 없음 ✅(monkey 0.112가 최저).
- monkey는 구조적으로 가장 약함(단일표적 스턴, 자기전진 없음). 0.11~0.12로 floor를 넘기지만 여유가 크진 않음. 추후 monkey 역할 강화 시 content-designer와 재조율 권장.
- bias 테스트(N=1200) 2종 모두 PASS.

---

## 변경 파일
**신설**: `src/engine/skills/immunity.ts`, `catwalk.ts`, `snatch.ts`
**삭제**: `src/engine/skills/nap.ts`, `brace.ts`
**수정(engine)**: `skills/index.ts`, `RaceEngine.ts`, `overtake.ts`, `types.ts`, `skills/banana.ts`, `skills/roar.ts`
**수정(data/schema)**: `src/data/schema.ts`, `src/data/characters/cat.ts`(slipBoost), `eagle.ts`(주석만/dropBack 유지), `monkey.ts`(dodgeChance)
**수정(script)**: `scripts/balance.ts`
**수정(test)**: `tests/unit/schema.test.ts`, `skills.test.ts`(catwalk/snatch/결정론 신규), `scoring.test.ts`, `engine-bias.test.ts`, `relay.test.ts`

## 추가한 catwalk/snatch 단위테스트 (skills.test.ts)
1. catwalk 면역 창 동안 `phase !== 'stunned'`(banana/roar/snatch/item 무시) 검증.
2. snatch가 앞 표적을 dropBack(~90)만큼 뒤로 떨굼 + progress≥0.
3. snatch가 면역(catwalk) 표적은 hit 못 함 → dodge만(면역 cat 표적 dodge 관측).
4. 새 로스터에서 (config,seed) 동일 시 order+이벤트열 동일(결정론).
