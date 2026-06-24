# c05 engine-dev — 원숭이 아이템 잔머리 패시브

## 🐵 원숭이 — 아이템 잔머리 (픽업 아이템 상황별 리맵)
`applyItemPickup`에서 원숭이가 박스를 먹을 때 추첨된 아이템 kind를 상황에 맞게 바꿔 쓴다. 기존 효과 분기는 그대로 재사용(중복 구현 없음) — 추첨을 `x → kind`로 디커플링한 뒤 원숭이만 리맵.

### 리맵 규칙 (`monkeyRemapItem(kind, isLeader, rng)`)
- shell & 원숭이 1등 → **fart** (등껍질은 선두를 스턴 → 자기가 선두면 자해 → 뒤 견제 방귀)
- fart & 원숭이 1등 아님 → **shell** (추격 중 쓸모없는 방귀 대신 선두 저격)
- lightning → 확률 `MONKEY_ITEM.lightningToStarChance`(=0.4)로 **star**, 나머지 0.6은 그대로 번개
- star·그 외 → 그대로

### 변경 파일
- `src/engine/tuning.ts` — `MONKEY_ITEM = { lightningToStarChance: 0.4 }` 신규(주석에 규칙).
- `src/engine/RaceEngine.ts`
  - `type ItemKind = 'star'|'lightning'|'shell'|'fart'` 추가(ITEM const 근처).
  - `applyItemPickup` 리팩토링: 메인 추첨 `x = irng.range(0,8)`은 **그대로** 두고 `x → kind` 매핑(기존 임계값 `x<1/x<3/x<5` 동일 → 비-원숭이 동작 완전 보존). leader(active 중 max-progress)를 shell 분기와 **공유**하도록 진입부에서 1회 계산.
  - 원숭이면 `kind = monkeyRemapItem(kind, leader?.id===self.id, fork)`로 리맵 후 기존 `if(kind===...)` 효과 분기 재사용.
  - `monkeyRemapItem` 헬퍼 신규(순수, rng만 외부 주입).
  - CHARACTER PASSIVES 인덱스 주석에 🐵 monkey 추가 + 결정론 주석 보정(대부분 RNG 없음, 원숭이만 서브스트림 1 roll).
- `import` 에 `MONKEY_ITEM` 추가.

### ⚠️ 결정론 — fork 라벨에 per-pickup 판별자 필수 (버그 발견·수정)
team-lead 제안 라벨 `irng.fork('monkeyitem')`은 **그대로 쓰면 결정론-정합성 버그**:
- `prng.ts`의 `fork(label)`은 rng의 **live state가 아니라 baseSeed**에서 자식 시드를 유도(`createRng(baseSeed ^ hash(label))`). 따라서 고정 라벨이면 한 원숭이의 **모든 픽업이 동일한 lightning→star roll**을 내고(같은 fork → 같은 첫 draw), 픽업마다 결과가 변하지 않음.
- 수정: per-racer 단조 픽업 카운터(`self.skill.monkeyItemPicks`)를 라벨에 실어 `irng.fork('monkeyitem:'+pick)` — 픽업마다 고유 서브스트림. **메인 `x` 추첨 드로 순서는 손 안 댐**(서브스트림 분기라 메인 시퀀스 무소비) → 남들 아이템·결정론 유지. CLAUDE.md "아이템은 안정 라벨 서브스트림" 규칙 준수.

### 테스트
- 신규 `tests/unit/skills.test.ts` "monkey 아이템 잔머리": 80시드.
  - **원숭이 자신의 shell이 자기를 스턴하지 않음**(`shellhit.targetId ≠ monkey`) — 리맵의 핵심 계약을 tie-proof하게 단언(1등이면 fart로 바뀌어 self-stun 불가).
  - 라이브니스: 원숭이가 shell(뒤에서)·fart 둘 다 실제로 던짐 → 양 리맵 경로 실행 확인.
  - **결정론**: 같은 (config,seed) 재시뮬이 원숭이 item-event 스트림(variant+targetId)을 정확히 재생 → 카운터-fork 수정이 결정론 깨지 않음 확인.
  - (초기엔 "1등이면 shell 안 던짐"을 progress max로 단언했으나 **부동소수 정확한 동점**에서 오탐 → self-stun 단언으로 교체. 동점 시 leader는 order 첫 max라 원숭이가 max여도 leader 아닐 수 있어 정상적으로 shell 던질 수 있음.)

## 검증
- `npm run typecheck`: 통과.
- `npx vitest run skills.test.ts`: 19 통과(monkey 포함).

### engine-bias 슬롯공정성(laps=10) — 표본부족이지 밸런스 문제 아님 (테스트 N 상향)
모न키 추가 후 `engine-bias > every start slot can win (laps=10)` 1건 실패(floor): 한 슬롯이 **2/200승**(floor 2.22). 진단:
- 실패 슬롯은 원숭이가 아니라 **펭귄 슬롯**이고, 원숭이 승률은 0.20(독주 아님). 즉 원숭이가 어떤 체계적 편향을 주는 게 아니라, 아이템 리맵이 시드→결과 매핑을 재셔플해 이미 분산 큰 한 슬롯을 표본부족 구간에서 floor 아래로 떨군 것.
- N 민감도 직접 측정(동일 엔진): slot-min = **2/200(FAIL) → 9/300 → 10/400(PASS, ~공정)**. 10랩·18슬롯은 아이템/스킬 카오스가 누적돼 슬롯별 승수 분산이 커서 200표본이 너무 적음. 9/300, 10/400은 공정 근처로 수렴 → **노이즈지 편향 아님**.
- 조치: `MONKEY_ITEM` 등 **임의 튜닝 안 함**(특정 시드-슬롯 구제용 과튜닝은 team-lead 금지 규칙). 대신 `tests/unit/engine-bias.test.ts`의 laps=10 **N을 200→300**으로 올려 슬롯 floor를 통계적으로 의미있게 만듦(공정성 바 자체는 안 낮춤, slotFloorMul 0.2 유지). 사유 주석 명기.

- 전체 스위트(determinism 4 + engine-bias 7 게이트 포함): 통과 — 위 N 상향 후 재확인.

## 메모
- 리맵은 **새 SkillEvent/variant 없음**(기존 star/lightning/shell/fart variant 재사용) → renderer-dev 통지 불필요. 원숭이가 별/등껍질을 쓰면 기존 그 연출이 그대로 나옴.
- content-designer가 character-guide.md에 "아이템 잔머리" 패시브를 이미 문서화함(엔진 구현과 일치).
- 세기(`lightningToStarChance=0.4`)는 작게 시작 — 밸런스 패스에서 balance-tuner 조정.
- 남은 hedgehog·fox 패시브 지시 대기.
