# p06 · Drafting / Slipstream — 구현 계획 (engine-dev)

> **상태: 계획만. 코드 변경 0.** TODO #6 "드래프팅(슬립스트림)" 설계 문서.
> 목표: 앞 주자 바로 뒤에 깔끔히 붙으면 *작은* 가속을 받아 추월에 전략성을 부여.
> 철학: 정밀 승률 튜닝 아님. "독주 없음 + 끝까지 역전 가능" 공정성 유지(YAGNI, 최소 변경).

---

## 0. 현재 코드 사실 확인 (계획의 근거)

`src/engine/overtake.ts` `applyOvertake(self, all, rng, frame)`:
- 매 프레임 `nearestAhead(all, self, self.lane, OVERTAKE.laneNear)` 로 **같은 레인밴드(±0.16)·앞쪽 `nearAhead`(4.0) 이내**의 최근접 앞 주자 `blocker` 를 찾음.
- blocker 있고 양옆 다 막히면(`side===0`) → `self.speed = min(self.speed, blocker.speed) * powerBlockDecel(blockDecel=0.5)`, `phase='blocked'`.
- blocker 있고 한쪽 열림 → 위빙(`phase='running'`, `weaveSide` 커밋).
- blocker 없음 → `phase='running'`, 홈레인으로 드리프트.

`src/engine/RaceEngine.ts` `advance()` 순서(중요):
1. `self.speed = baseSpeed*jitter + burst`
2. `self.speed *= catchupFactor(self)`  ← 러버밴딩 먼저
3. `applyOvertake(...)`  ← 여기서 막힘 감속이 일어남
4. `applyIce`, slowMul, `self.progress += self.speed`

→ **드래프팅도 `applyOvertake` 안에서 처리하는 것이 자연스럽다.** 이미 blocker 탐색·레인 정렬·phase 분기를 다 갖고 있고, catchup 이후·progress 적분 이전 지점이라 동일한 합산 모델에 얹힌다. 새 함수/새 루프 단계 추가 불필요(YAGNI).

`procKey`·`racerRng`(서브스트림)·결정론 게이트(`engine-determinism.test.ts`), 공정성 게이트(`engine-bias.test.ts`, 1/3/10랩, charCeil **0.45**) 존재. power는 `statDev=(stat-3)/2`, 작은 계수.

---

## 1. 핵심 설계 난제: "막힘(감속)" vs "드래프트(가속)" 구분

같은 조건 — *앞 주자가 nearAhead 안에, 같은 레인밴드에 있음* — 이 지금은 **막힘**의 트리거다. 드래프팅은 정반대(가속)이므로 한 조건을 둘로 쪼개야 한다. 후보 3안:

### A안 — phase로 구분: "추월 시도 중 막힘" vs "얌전히 추종"
- blocker 있을 때 **양옆이 다 막혔으면** = 추월 못 함 → 기존 `blockDecel`(감속) 그대로.
- blocker 있고 옆이 열려 위빙 중이면 = 추월 시도 중 → 가속/감속 없음(기존 그대로).
- **드래프트는 별도 조건**: blocker 가 *더 가까운* 창(`draftWindow` < `nearAhead`)에 있고, 자기가 **위빙도 막힘도 아닌 정렬 상태**(레인이 blocker 와 거의 일치)일 때 → `draftBoost`.
- 장점: 막힘/드래프트가 phase로 깔끔히 배타적. 단점: "정렬 상태" 정의가 추가로 필요.

### B안 — 거리 2단 창: 가까우면 드래프트, 더 가까우면 막힘
- `nearAhead`(4.0) 안을 두 구간으로:
  - blocker 와 gap 이 `[draftMin, draftWindow]` (예: 1.5~3.0) → **드래프트 존**: 너무 붙지 않은 추종 → `draftBoost`.
  - gap 이 `draftMin` 미만(예: <1.5) → **너무 붙음 = 막힘 위험**: 옆 열리면 위빙, 다 막히면 `blockDecel`.
- 장점: 직관적("바짝 뒤=정체, 한 박자 뒤=빨대"). 현실 슬립스트림과도 맞음. 단점: 드래프트로 가속 → gap 줄어듦 → 막힘 존 진입 → 감속 → 다시 벌어짐의 **떨림(oscillation)** 가능. 히스테리시스나 부드러운 boost 곡선 필요.

### C안 (추천) — A안 + B안 절충: "추월 못 하는 추종자에게만 드래프트"
가장 단순하면서 의도("추월에 전략성")에 직결. 규칙:

```
blocker = nearestAhead(...)
if (blocker):
    side = (기존 위빙 결정 로직 그대로)
    if (side != 0):
        # 옆이 열림 → 추월 시도. 드래프트 없음, 기존대로 위빙.
        weave...
    else:
        # 양옆 막힘 = 추월 불가. 여기서 둘로 분기:
        if (gap in [draftMin, nearAhead] AND 레인정렬):
            # 뒤에 얌전히 붙어 빨대 → 감속 대신 작은 가속
            self.speed = min(self.speed, blocker.speed * draftCap) * (1 + draftBoost)
            phase = 'drafting'   # (신규 phase 또는 기존 running 유지 — 4.3 참조)
        else:
            # 너무 바짝(gap < draftMin) 붙었거나 정렬 안 됨 → 기존 막힘 감속
            self.speed = min(self.speed, blocker.speed) * powerBlockDecel(...)
            phase = 'blocked'
else:
    # 클리어 — 기존대로
```

**왜 C안인가**
- "옆이 열렸으면 추월하지 드래프트 안 한다" → 드래프트는 *진짜 갇혔을 때의 보상*이 되어, 한 줄로 뭉치는 팩을 따라붙는 주자에게 *추월 모멘텀*을 줌(전략성 = "막혔으면 잠깐 빨대 빨다가 틈 나면 위빙"). 의도와 정확히 일치.
- 막힘 vs 드래프트가 **gap 1개 임계(`draftMin`)로만** 갈림 → 노브 최소, 떨림은 `draftMin` 직근에서만 발생하고 boost 가 작아 무해.
- 새 루프 단계·새 탐색 함수 0. `nearestAhead` 재사용.

> **레인 정렬 조건**은 `Math.abs(self.lane - blocker.lane) <= OVERTAKE.laneNear` 로 충분(이미 nearestAhead 가 laneNear 밴드로 찾았으므로 사실상 항상 참 → **별도 체크 불필요**, 단순화). 즉 C안에서 "레인정렬" 항은 nearestAhead 가 보장하므로 코드상 생략 가능.

---

## 2. 장점 / 단점 / 리스크

**장점**
- 추월 직전의 "따라붙기" 단계에 의미 부여(현재는 단순 감속만). 멀티랩에서 팩 추격전이 살아남.
- catchup(전역, 평균 기준)과 달리 드래프트는 **국소·상호작용 기반**(특정 앞 주자에 의존) → 다른 종류의 역동성.

**단점 / 리스크**
1. **catchup 중복**: 뒤처진 주자는 이미 `behindGain`으로 가속됨. 거기에 드래프트까지 얹으면 과보정 → 선두권에서 떨어진 팩이 우르르 붙어버림. → **완화**: `draftBoost` 를 catchup 밴드보다 훨씬 작게(아래 4.2). 또한 드래프트는 *막힘 분기*에서만 발생하므로 catchup 으로 이미 따라잡아 클리어된 주자는 드래프트 안 받음(자연 배타에 가까움).
2. **팩이 한 줄로 뭉칠 위험**: 드래프트 → gap 유지하며 따라감 → 일렬 정체. → **완화**: (a) draftBoost 상한을 `blocker.speed * draftCap`(예 1.0)로 캡 → 앞 주자보다 빨라지지 않음 = 추월은 못 하고 *간격만 유지*. 위빙으로만 실제 추월. (b) 양옆 막힘이 풀리면 즉시 위빙 분기로 빠짐(드래프트는 "갇힌 동안만").
3. **1랩 vs 멀티랩 체감**: 1랩은 출발 직후 산개라 드래프트 기회 적음(영향 미미 → 1랩 공정성 거의 불변, 좋음). 멀티랩일수록 팩 형성 잦아 드래프트가 자주 발동 → **멀티랩 공정성 게이트(3/10랩)가 진짜 시험대**. 6절에서 집중 검증.
4. **떨림**: §1 B안 단점. C안 + draftCap 으로 "앞 주자보다 못 빨라짐" → gap 이 줄어 막힘존으로 들어가도 boost 가 약하고 캡되어 진동 폭이 작음. 필요시 `draftBoost` 를 gap 에 대해 선형 페이드(draftMin 에서 0, draftWindow 에서 최대)하면 경계 떨림 제거 — **1차 구현엔 고정값, 떨림 측정되면 그때 페이드 도입**(YAGNI).

---

## 3. 결정론 · 엔진 순수성 · 서브스트림 준수

- **rng 불필요**: 드래프트 boost 는 gap·속도의 **순수 결정함수**. 무작위 드로 0 → 드로 순서 의존 0, 안정 라벨 고민 자체가 없음. (기존 위빙의 `rng.bool(switchChance)` 분기는 그대로 두고, 드래프트는 그 분기에 *진입하지 않은* 막힘 경로에만 얹으므로 rng 호출 횟수·순서 불변 → **기존 결정론·다른 스킬과의 독립성 유지**.)
- DOM/Pixi/Math.random 없음(순수 산술). `src/engine/` 순수성 불변.
- `applyOvertake` 시그니처·호출부 불변(`advance`에서 그대로 호출). 새 인자 불필요.
- **주의(qa 플래그 대상)**: 이 변경은 같은 (config+seed)의 *프레임 수치를 바꾼다* → 결정론은 유지되지만 **골든 스크린샷·`engine-determinism` 기대값이 갱신**되어야 함(기존 회귀가 아니라 의도된 시뮬 변경). 도입 시 qa-verifier 와 골든 리베이스 조율 필요.

---

## 4. tuning.ts 추가 상수 (값은 작게 — speedGain/공정성 철학)

`OVERTAKE` 블록에 드래프팅 노브 추가(별도 `DRAFT` 객체로 빼도 되나, 추월 모델의 일부이므로 OVERTAKE 안이 응집도 높음 — 택1, 추천: OVERTAKE 내부):

```ts
export const OVERTAKE = {
  ... // 기존
  /** 드래프트가 시작되는 최소 앞-간격(이보다 더 바짝이면 '막힘'으로 처리). */
  draftMin: 1.5,        // (nearAhead 4.0 보다 작아야 함; [draftMin, nearAhead]이 드래프트 창)
  /** 갇힌 추종자가 받는 작은 가속(분수). catchup behindGain 대비 매우 작게. */
  draftBoost: 0.06,     // = +6%. (catchup maxBoost 1.2 = +20% 보다 작음)
  /** 드래프트 속도 상한: 앞 주자 속도의 배수. <=1.0이면 추월 불가(간격만 유지). */
  draftCap: 1.0,
} as const;
```

**값 근거(초기값, 측정 후 1회 조정 허용)**
- `draftBoost 0.06`: SPEED_JITTER(0.08)·speedGain(전체 밴드의 <10%)와 같은 "작은 양념" 스케일. catchup 보다 작아 전역 러버밴딩을 압도하지 않음.
- `draftCap 1.0`: **가장 중요한 안전장치.** 드래프트로 앞 주자보다 빨라지지 않음 → 드래프트만으로는 추월 불가, 실제 추월은 위빙으로만(레인 중립성·"추월=위빙" 불변 유지). 한 줄 정체 폭주 방지.
- `draftMin 1.5`: nearAhead(4.0) 안에서 "바짝(<1.5)=정체 / 한 박자 뒤(1.5~4.0)=빨대" 분할. 측정 후 조정 1순위 노브.

> 새 상수만 추가, 기존 값 불변 → **기존 시드 결과는 드래프트가 발동하는 프레임에서만 변함**(국소).

---

## 5. power 스탯 상호작용 — **1차 구현: 영향 안 줌(추천)**

- 현재 power 는 *받는 부정효과 약화* + *막힘 감속 완화*(`powerBlockDecel`)에 작용. 드래프트는 *능동적 이득*이라 의미축이 다름.
- **추천: draftBoost 에 power 미적용.** 이유:
  - 단순함(YAGNI). 노브·상호작용 분석 부담 감소.
  - power 는 이미 "막혔을 때 덜 느려짐"으로 추월 상황을 도움(고power = 막힘 감속 완화). 드래프트에까지 power 를 또 얹으면 *추월 관련 이득이 power 에 이중 집중* → 공정성 게이트 압박.
  - speed 스탯과의 관계: speed 높은 동물은 baseSpeed 가 높아 앞 주자(평균적으로 느린)에 더 자주 따라붙음 → **드래프트 발동 빈도 자체가 speed 에 약하게 양의 상관**. 굳이 power 까지 안 엮어도 스탯 차별화는 자연 발생.
- 만약 6절 측정에서 *고power 종이 추월을 너무 못 한다*가 나오면 그때 `powerEaseSlow` 류로 draftBoost 를 살짝 키우는 옵션을 검토(2차). 1차엔 미적용.

---

## 6. 공정성 보장 — 게이트 & 측정 계획

**필수 게이트(도입 PR에서 모두 GREEN 이어야 함)**
1. `npm run typecheck`
2. `npm run test` — 특히:
   - `engine-determinism.test.ts`: 결정론 유지(같은 시드 동일 재생). *기대 스냅샷이 값 기반이면 갱신*.
   - `engine-bias.test.ts`: **1/3/10랩 모두** charFloor~**charCeil(0.45)**, 슬롯 공정성. ← 드래프트의 핵심 리스크(멀티랩 독주/팩 쏠림)가 여기서 잡힘.
3. (렌더러/연출 영향 시) 골든 스크린샷 리베이스 — qa 조율.

**balance.ts before/after 매트릭스(필수 첨부)**
- 먼저 `ROSTER`(= `defaultCharacterIds`, 7종: dog cat monkey eagle bear penguin hedgehog)가 현 로스터인지 확인. (확인됨 — balance.ts 헤더 주석과 일치.)
- 절차:
  1. `npx vite-node scripts/balance.ts` (드래프트 도입 **전**, 현 main) → 개인/팀/릴레이 × {1,3,10}랩 승률·평균순위·역전 저장 = **BEFORE**.
  2. 드래프트 도입 후 동일 명령 = **AFTER**.
  3. 비교 체크리스트:
     - 어떤 캐릭터도 승률 0.45 초과 없음(독주 금지) — 특히 10랩.
     - 최저 승률 캐릭터가 floor 아래로 떨어지지 않음(드래프트가 강자만 더 돕지 않았는지).
     - 평균 finish rank 분포가 BEFORE 대비 *극단으로 벌어지지 않음*.
     - `--dist` 로 순위 히스토그램: 1등 독식·꼴찌 고정 패턴 없는지.
- **목표 미달 시**: `draftBoost` 또는 `draftMin` **1회만** 조정 후 재측정. 그래도 안 되면 수치와 함께 보고(과튜닝 금지).

---

## 7. 캐릭터별 예상 영향

| 캐릭터 | speed/power 경향 | 드래프트 예상 영향 |
|---|---|---|
| 🐶 dog (zoomies, 부스트/변칙) | speed 높음 | 부스트 직후 클리어 → 드래프트 거의 안 받음(straying/리드). 평상시 따라붙을 때 약간 이득. 영향 소. |
| 🐰 rabbit/cat 계열 (변칙·민첩) | — | 갇혔을 때 드래프트로 버티다 위빙 추월 — 컨셉과 잘 맞음(긍정). |
| 🐒 monkey (banana, 방해/저격) | — | 자기 가속 영향 소, 앞 주자 방해로 간접. 중립. |
| 🐘 elephant/곰 (brace/roar, 탱크·광역) | power 높음 | power 미적용이라 드래프트 자체 이득 없음. 단 power로 막힘 감속이 적어 *드래프트 창에 머무는 시간*이 달라질 수 있음 → 측정 관찰 포인트. |
| 🐧 penguin (icefield) | — | 빙판 가속과 무관(다른 축). 중립. |
| 🦔 hedgehog (bristle) | — | 중립. |
| 🦅 eagle (divebomb, 추월형) | speed 높음 | 다이브 직후 straying → 드래프트 미적용 구간. 평상 추격 시 약간 이득. |

**핵심 관찰점**: speed 높은 종은 앞 주자에 더 자주 붙어 *드래프트 발동 빈도*가 높음 → 강자 더 강해질 위험. **6절 게이트가 정확히 이를 잡도록 설계됨**(charCeil 0.45 / 멀티랩). draftCap 1.0(앞 주자 초과 불가)이 1차 방어선.

---

## 8. 구현 단계(승인 후, 검증 기준 포함)

1. `tuning.ts` OVERTAKE 에 `draftMin/draftBoost/draftCap` 추가 → 검증: `typecheck` 통과(값만 추가, 동작 불변).
2. `overtake.ts` 막힘 분기(`side===0`)를 §1-C 로 2분기(드래프트 vs 막힘). rng 호출 위치·횟수 불변 유지 → 검증: `engine-determinism` 통과(드로 순서 불변), 의도된 수치 변화는 스냅샷 갱신.
3. `engine-bias` 1/3/10랩 GREEN 확인 → 검증: 게이트 통과.
4. `balance.ts` BEFORE/AFTER 첨부 → 검증: 독주 없음·floor 유지.
5. (연출 영향 시) renderer-dev 에 신규 `phase==='drafting'` 여부 통지 — §4.3 참조.

---

## 4.3 신규 phase 여부 결정 (renderer 통지 대상)

두 옵션:
- **(a) 신규 `phase: 'drafting'` 추가**: 렌더러가 빨대 연출(앞 주자에 붙는 스피드라인 등) 가능. 단 `RacerState['phase']` union·resolveTimer·advance 의 phase 가드 전수 점검 필요(waiting/finished/stunned/straying/blocked/running 외 추가).
- **(b) phase 는 `'running'` 유지, 별도 플래그**(`self.skill.drafting=true` 같은 transient bool) 로 표시: 엔진 phase 머신 불변, 렌더러는 플래그로 연출. **추천(YAGNI)** — phase 가드 전수 점검 불필요, 결정론 표면적 최소.

→ 1차는 **(b)**. 연출이 phase 단위를 요구하면 그때 (a) 승격. **renderer-dev 통지**: "드래프트 표시는 `skill.drafting` bool 로 노출 예정(신규 SkillEvent.variant/phase 없음)" → 연출 반영 선택사항.

---

## 요약 (한 줄)
`applyOvertake` 의 **양옆 막힘 분기**를 gap 임계(`draftMin`)로 둘로 쪼개 — 바짝 붙으면 기존 감속, 한 박자 뒤면 `draftBoost`(앞 주자 속도 캡, rng·power 미사용)로 작게 가속. catchup·레인중립성·결정론 불변, 멀티랩 공정성 게이트가 핵심 시험대.
