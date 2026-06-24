# h21 — engine-dev: speed/power 스탯 엔진 배선 (공정 추첨 유지, A안)

## 합의 필드/스케일 (content-designer)

- `CharacterData.speed?: number`, `power?: number` (옵셔널). 정수 1~5, 중앙값 3, 캐릭터당 합≈6.
- content-designer가 7캐릭 전부 적용(내 제안 이름/스케일 그대로): dog 5/1, cat 4/2, eagle 4/2, monkey 3/3, penguin 2/4, hedgehog 2/4, bear 1/5.
- 옵셔널+미지정=중립 3(편향/저항 0) → 하위호환.
- 엔진은 `RaceConfig.characters[characterId]`로 읽음(엔진 순수성 유지, data 모듈 import 안 함).

## 매핑 (신설 `src/engine/stats.ts`, 중앙 헬퍼)

- 편차 `d = (stat-3)/2 ∈ [-1,+1]`.
- **speedGain = 0.018**: baseSpeed 편향 = speedGain·d_speed. (공정 jitter 밴드 0.2 폭의 <10%만 — flavor, 사다리 아님. 첫 시도 0.05는 과해 floor 깨짐 → 0.018로 하향.)
- **powerResist = 0.15**: 들어오는 부정효과 *크기* 스케일 `powerEffectScale = 1 - 0.15·d_power`(stun 길이·pushback 거리·slowMul 경감).
- **powerBlockEase = 0.2**: 막힘 감속을 power로 1쪽으로 완화 `powerBlockDecel`.
- `powerEaseSlow(mul, power)`: sub-1 슬로우 배수를 power로 1쪽으로 — slowMul/ice slowFactor 공용.

## 배선 (바뀐 파일)

- `src/engine/stats.ts` (신설): statDev, STATS 계수, powerEffectScale, powerBlockDecel, powerEaseSlow, speedBias.
- `src/engine/types.ts`: RacerState에 `power?: number`(init 시 복사, 효과 시점 참조). bananaImmuneUntil은 h19 것.
- `src/engine/RaceEngine.ts`:
  - init: `baseSpeed = r.range(1.3,1.5) + speedBias(stats?.speed)`, `power: stats?.power`.
  - slowMul 적용부: `powerEaseSlow(slowMul, self.power)` (bristle/lightning/fart 슬로우 *크기* 일괄 경감 — 중앙 chokepoint).
  - ice slow 2곳(cat/일반): `powerEaseSlow(zone.slowFactor, self.power)`. penguin boost는 불변.
- `src/engine/overtake.ts`: 막힘 감속 `powerBlockDecel(OVERTAKE.blockDecel, self.power)`.
- `src/engine/skills/banana.ts`: stun 길이 `× powerEffectScale(target.power)`.
- `src/engine/skills/divebomb.ts`: victim stun 길이 `× powerEffectScale(victim.power)`(자폭 시 eagle 자신 power 적용).
- `src/engine/skills/bristle.ts`: pushback 거리 `× powerEffectScale(target.power)`(슬로우 크기는 RaceEngine 중앙 경감이 처리 — 이중계상 방지).

설계 원칙: **효과 종류별 1규칙, 이중계상 없음.** slowMul 크기는 RaceEngine 한 곳에서만 경감(bristle 핸들러는 슬로우 magnitude 안 건드리고 pushback만). 결정론: 새 무작위 0, rng 사용 패턴 보존.

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **44/44 통과**(stats 신규 테스트 1건 포함, engine-bias floor/slot/no-runaway + determinism 길이 단언 green — baseSpeed 편향이 길이를 깨지 않음).

## 1차 분포 (N=3000)

speedGain 첫값 0.05 → **과함**: dog 0.240 / bear 0.053(floor 미달) — speed가 power 저항보다 훨씬 세서 한 방향 쏠림.
→ speedGain 0.018로 하향 후:
```
INDIVIDUAL: dog 0.146 cat 0.176 monkey 0.129 eagle 0.146 bear 0.132 penguin 0.142 hedgehog 0.129
```
- 0.129~0.176 = 전원 floor 위, 독주 없음(winner led 0.511, peak gap 0.072laps, lead changes 9.9). slot 0.049~0.103 게이트 통과.
- 1/7≈0.143 기준 대체로 ±3.5%p(cat +0.033 최대) — engine-bias 게이트 green(최우선 충족). 정밀 ±5%p 수렴은 balance-tuner.

## 잔여(엔진 무관, balance-tuner)

- 팀 rank-sum: bear 0.207 / eagle 0.068 등 스프레드 있음.
- 릴레이: monkey 0.346(h19에서 보고한 미해결 독주 — 스탯 배선과 별개 원인).
- 둘 다 balance-tuner가 stats 미세조정(계수 or 캐릭별 1~5값) + 릴레이 진단으로 마무리 권장. 엔진 계수(STATS)는 data처럼 한 곳에 모아둬 튜닝 쉬움.

## 통지

- content-designer: 필드명 speed/power·옵셔널·합6 그대로 배선 완료. 추가 data 작업 없음(값 튜닝은 balance-tuner).
- 렌더러: 이벤트 계약 불변. power는 엔진 내부 상태(렌더러 참조 불필요).
- 불변 규칙: 레인은 여전히 속도 무관(power는 접촉 스탯, 레인 아님). laneSpeedFactor=1 유지.
