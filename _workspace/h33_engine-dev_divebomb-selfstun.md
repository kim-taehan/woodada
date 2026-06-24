# h33 — engine-dev: divebomb 자폭 기절 분리 (selfStunMs)

## 문제

독수리 멀티랩(10바퀴) 양극화: 꼴찌 ~33%. 구조적 원인 — **자폭(실패) 시 독수리가 공격 성공 때와 똑같은 길이(stunMs)로 기절** → 10바퀴 동안 자폭 누적이 곧 꼴찌. selfRiskChance↓로는 자폭을 승리로 전환해 재양극화라 안 됨.

## 수정 (공격력 유지, 자폭 회복만 단축)

`src/engine/skills/divebomb.ts`:
- 단일 `stunFrames`(stunMs 기반)를 **분기별**로 분리:
  - 성공(victim=target): `stunMs` (공격력 그대로).
  - 실패(자폭, victim=self): `selfStunMs` (더 짧게).
  - `const baseStunMs = success ? stunMs : (selfStunMs ?? stunMs)` → frame 변환. `selfStunMs` 미지정 시 stunMs로 폴백(하위호환/중립).
- power 저항(`powerEffectScale(victim.power)`)은 기존과 동일하게 victim에 일관 적용(자폭 시 eagle 자신 power).
- 결정론: rng 호출 순서 불변(분기 길이만 바뀜). 새 variant 없음, self-botch 이벤트 계약 그대로.

`src/data/characters/eagle.ts`:
- params에 `selfStunMs: 400` 추가(기존 stunMs 720의 ~55%). 나머지 유지(stunMs 720, selfRiskChance 0.42, diveBurst 0.92, diveBurstMs 850 — balance-tuner 멀티랩 튜닝값 보존).

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **44/44 통과** — 단판 engine-bias floor/slot/no-runaway green(자기 기절 단축이 단판 monkey/bear floor 안 흔듦).

### 10바퀴 재측정 (7종 1마리, laps=10, maxFrames=60×400, seed 0~99)

독수리 순위 분포, selfStunMs 전(=720, 기존동작) → 후(=400):

| 지표 | BEFORE (720) | AFTER (400) |
|---|---|---|
| 꼴찌(7등)% | **33%** | **21%** (−12%p) |
| 1등% | 17% | **15%** (오히려 ↓) |
| 평균 순위 | 4.43 | 4.20 (중앙 4.0쪽으로) |

→ **꼴찌% 유의미 하락 + 1등%/평균 과상승 없음**(재양극화 방지). 양 끝이 줄고 중앙으로 수렴 = 양극화 완화. 목표 달성.

### 단판 개인전 (N=3000) 참고

```
dog 0.142 cat 0.165 monkey 0.115 eagle 0.165 bear 0.109 penguin 0.181 hedgehog 0.123
```
- 0.109~0.181 전원 floor 위, 독주 없음. 독수리 단판도 자폭 회복 빨라져 0.146→0.165(여전히 band 안). penguin 0.181 최고, bear 0.109 최저(floor 위). 정밀 ±5%p는 balance-tuner.

## 메모

- selfStunMs 400은 과하지 않음(1등%·평균 과상승 없음 확인). 더 줄이면 독수리 강해질 여지 → 필요 시 balance-tuner가 380~450 범위에서 미세조정. STATS/params 한 곳이라 튜닝 쉬움.
- 렌더러/콘텐츠 영향 없음(이벤트/variant 불변). selfStunMs는 data param.
