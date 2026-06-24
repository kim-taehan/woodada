# h22 — balance-tuner: speed/power 도입 후 팀 스프레드 완화

요청: 개인전 ±5%p 유지(이미 충족) + 팀 rank-sum 스프레드 완화(bear 0.207 과강 / eagle 0.068 과약을 공정선 쪽으로). 릴레이는 보류(측정만).

레버 우선순위(team-lead): stats.ts 계수(powerResist 등) → bear/eagle 스탯 → skill.params 보조.

## 결론 (요약)

- **채택**: bear roar `range 18→16, staggerMs 340→320` (skill.params만). 팀 bear **0.207 → 0.182** 로 고강 완화, 개인 bear는 floor 위(0.119) 유지. 44/44 green.
- **powerResist 계수는 못 씀 — relay 테스트가 막음**: powerResist를 0.15→0.11 이하로 내려야 팀 스프레드가 유의미하게 압축되는데, 그 순간 `relay.test.ts:140`("handoffs land at the line…")이 깨짐(인계 프레임의 incoming runner phase가 'running'이 아닌 'blocked'로 판정). powerResist가 speed 적용 경로(powerEffectScale/powerEaseSlow)에 들어가 인계 프레임 계산을 흔드는데, 테스트가 그 프레임의 phase를 정확히 단언. 0.13까지는 통과하나 그 정도론 팀 bear 0.207→0.197로 거의 효과 없음. → **engine-dev 회부**(아래).
- **eagle 팀 과약(0.071)은 power로 해결 불가**: powerResist↓·eagle 스탯 4/2→3/3·selfRisk↓ 모두 eagle 팀을 0.07x에서 거의 못 끌어올림. eagle 팀 약점은 divebomb 자폭 도박이 rank-sum을 깎는 구조적 원인(스탯/계수 무관). 임의 selfRisk 하향은 개인 eagle만 과상승(0.146→0.18)시켜 미채택.

## 측정 (N=3000)

### 개인전 (공정선 1/7 ≈ 0.143, ±5%p = 0.093~0.193)

| 캐릭터 | baseline | after (bear roar↓) |
|---|---|---|
| 🐱 cat | 0.176 | 0.168 |
| 🐧 penguin | 0.142 | 0.150 |
| 🦅 eagle | 0.146 | 0.150 |
| 🐶 dog | 0.146 | 0.146 |
| 🐒 monkey | 0.129 | 0.140 |
| 🦔 hedgehog | 0.129 | 0.127 |
| 🐻 bear | 0.132 | 0.119 |

전원 ±5%p 안 유지(0.119–0.168), floor 위, 독주 없음. 런어웨이 건강성 유지(lead changes 10.0, winner led 0.502).

### 팀 rank-sum (동질 2쌍, 공정선 ≈ 0.143)

| | baseline | after |
|---|---|---|
| 🐻 bear | **0.207** | **0.182** ← 고강 완화 |
| 🦔 hedgehog | 0.182 | 0.185 |
| 🐧 penguin | 0.164 | 0.158 |
| 🐱 cat | 0.161 | 0.155 |
| 🐒 monkey | 0.136 | 0.153 |
| 🐶 dog | 0.082 | 0.096 |
| 🦅 eagle | **0.068** | 0.071 ← 미해결(구조적) |

스프레드 폭(최고−최저) 0.139 → 0.114. 고강(bear) 압축 성공. 저약(eagle)은 구조적이라 거의 불변.

### 릴레이 (보류 — 측정만)

monkey 0.346 → 0.347(불변). 사용자 지시대로 쫓지 않음. (anti-stack immuneMs=900가 이미 적용됐으나 릴레이 monkey는 여전히 독주 — 알려진 미해결 사항.)

## 변경한 값 (전 → 후)

**bear** (roar) — `src/data/characters/bear.ts`:
- range 18 → 16, staggerMs 340 → 320

그 외 stats.ts·다른 캐릭터·이전 변경 전부 불변(eagle/monkey 등 committed 상태 유지).

## engine-dev 회부 (팀 스프레드 추가 완화에 필요)

1. **relay 핸드오프 테스트의 powerResist 민감성**: `tests/unit/relay.test.ts:140`이 인계 프레임의 incoming runner phase를 'running'으로 정확히 단언 → powerResist를 효과적 구간(≤0.11)으로 내리면 이 프레임이 'blocked'로 판정되어 깨짐. 테스트 의도(인계가 일어났는지)에 비해 과민한 단언. **테스트를 phase 'running'∪'blocked' 허용으로 완화**하면 powerResist를 팀 스프레드 압축에 쓸 수 있게 됨. (밸런스 영역 밖이라 직접 안 건드림.)

2. **팀 power 기여 별도 조정 여지**: bear 팀 과강의 본질은 power=5가 팀 스크럼에서 상대 방해(banana/roar/stun)를 잘 견디는 것. power가 개인전 bear를 떠받치는(speed=1 보완) 유일한 축이라, 계수를 내리면 팀↓·개인↓이 동반됨(분리 불가). "팀 모드에서만 power 기여 약화" 같은 모드 분기가 필요하면 engine 영역.

3. **eagle 팀 floor(0.07)**: divebomb 자폭이 rank-sum을 구조적으로 깎음. params로는 개인전을 망치지 않고 못 올림. 팀에서 eagle을 살리려면 divebomb 로직 보강(예: 팀전 자폭 페널티 경감 또는 자폭 시 팀 손실 완화) 검토 필요.

## 검증

- `npx vite-node scripts/balance.ts` → 위 분포.
- `npx vitest run` → **44/44 통과** (engine-bias per-char floor·slot floor·no-runaway + determinism + stats + relay 포함).
- `npm run typecheck` → clean.
