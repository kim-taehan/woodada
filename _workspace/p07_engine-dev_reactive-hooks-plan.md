# P07 — 반응형 스킬 훅 (onOvertaken) 구현 계획

엔진 TODO #7. 작성: engine-dev. **계획 전용 — 코드 변경 없음.**

## 0. 한 줄 요약 (권장안)

훅을 전면 프레임워크로 만들지 말고, **이벤트 기반 트리거 1종 `onOvertaken` 하나만** 추가한다.
기존 쿨다운 자발동(`tryActivateSkill`)은 그대로 두고, 그 위에 "추월 발생 → 추월당한 쪽 스킬에게 단발 알림"
경로를 별도로 얹는다. bristle만 이 훅으로 이관(또는 듀얼 트리거)하고 나머지 7스킬은 손대지 않는다.
YAGNI: `onHit`/`onItemHit`/`onPassed` 등은 **지금 실수요가 없으므로 추가하지 않는다**(아래 §2에서 근거).

---

## 1. 현재 메커니즘 정밀 정리 (구현이 의존하는 사실)

읽은 파일: `RaceEngine.ts`, `overtake.ts`, `skills/bristle.ts`, `skills/types.ts`, `skills/registry.ts`,
`skills/index.ts`, `tuning.ts`, `types.ts`, `tests/unit/{skills,schema,engine-determinism}.test.ts`.

- **스킬 발동은 100% 쿨다운 게이트 자발동.** `step()`에서 `tryActivateSkill(self)` 호출 순서는
  `order` = progress 내림차순 + `procKey` tie-break(시드 난수, 안정). 핸들러가 1개라도 emit하면 "발동"으로
  보고 full cooldown 부여, **아무것도 emit 안 하면 "보류"** → `RETRY_COOLDOWN_MS`(200ms) 후 재시도.
- **bristle는 "추월당함"을 매 체크 재구성**한다: `all` 중 "바로 뒤(0<gap≤range) + closing(r.speed>self.speed)
  + 비팀/비종료" 후보를 progress·id로 정렬해 최근접 1명을 반격. 진짜 추월 이벤트가 없어서 근사한 것.
- **추월의 "진짜 발생 지점"은 어디에도 명시적 이벤트가 없다.** `overtake.ts`의 `applyOvertake`는 레인/속도/
  phase만 조정하고, 실제 순위 역전(A가 B의 progress를 넘김)은 `advance()`에서 `self.progress += self.speed`
  결과로 **암묵적으로** 일어난다. 추월을 이벤트로 만들려면 **프레임 경계에서 progress 비교 스냅샷**이 필요하다.
- **결정론 게이트**: `engine-determinism.test.ts`는 `result.order`와 `hashFrames`(racers의 id/progress/lane만)
  를 비교. **이벤트 배열은 해시에 안 들어간다.** 단, 이벤트는 (a) progress를 바꾸는 부수효과(bristle shove/slow/
  recoil)를 통해 간접적으로 해시에 영향을 주고, (b) 골든 스크린샷·렌더러 연출이 소비한다. 따라서 **훅 발동
  순서가 부수효과를 바꾸면 해시가 깨진다** → 순서 결정론이 핵심.
- **SkillEvent.variant 유니온**(types.ts): 현재 `'activate'|'hit'|'dodge'|'wake'|'boost'|'slip'|'handoff'|
  'star'|'lightning'|'shell'|'shellhit'|'fart'`. 새 variant가 필요하면 여기에 추가(renderer-dev 통지 대상).
- **활성 스킬 집합**(skills.test.ts L18): `['banana','bristle','catwalk','divebomb','icefield','roar','zoomies']`.
  KNOWN_SKILL_TYPES(schema.test.ts L4)도 동일 7종. (nap/brace는 미등록 — index.ts에 없음. catalog에만 존재.)

---

## 2. 장점 / 단점 / 리스크

### 장점
- **표현력**: "추월당하면 반격"이 근사 스캔이 아니라 사실 그대로 표현됨. bristle 핸들러에서 후보 스캔/
  closing 추정 로직이 사라지고 "넘어간 자 = target" 으로 명확해짐 → 콤보/연쇄 스킬(§6)의 토대.
- **정합성**: "speed가 더 빠르면 closing" 같은 근사(같은 레인 아님·실제 추월 아닐 수 있음)를 실제 progress
  역전으로 대체 → false positive(아직 안 넘었는데 반격)·false negative(넘었는데 속도 같아 누락) 제거.

### 단점 / 비용
- **계약 확장 비용**: `SkillContext`/registry/엔진 루프에 새 경로. 한 번 열면 "onHit도, onItemHit도" 압력이
  생김(스코프 크리프). → §0대로 **onOvertaken 1종만** 열고 문서로 못박는다.
- **추월 검출 비용**: 매 프레임 직전/직후 progress 스냅을 비교해 역전쌍을 산출해야 함. O(n²) 페어 비교 또는
  정렬 델타. n이 작아(보통 ≤10) 무시 가능하지만 추가 패스 1회.

### 리스크 (차단책 포함)
- **R1. 발동 순서 결정론**: 한 프레임에 여러 추월이 동시 발생하면 onOvertaken 콜백 순서가 부수효과 순서를
  정함 → 해시 영향. **차단**: §3의 안정 정렬 규약 고정 + 테스트 가드.
- **R2. 무한/연쇄 발동**: 반격(shove/slow)이 또 다른 추월을 유발 → 또 onOvertaken → … 같은 프레임 내 연쇄.
  **차단**: 추월 검출은 **프레임 경계 1회 스냅샷 비교**로만(한 프레임 내 부수효과로 생긴 2차 역전은 다음
  프레임에 검출). 또한 onOvertaken도 **쿨다운 공유**(아래 §5) — 쿨다운 중이면 훅이 와도 발동 안 함.
- **R3. 쿨다운 이중 소비**: 자발동과 훅이 같은 `skillCooldownUntil`/같은 `skillRng` 서브스트림을 공유하므로
  **드로 순서·쿨다운 부여가 한 곳으로 수렴**해야 함. **차단**: 발동 진입점을 단일 함수로 통일(§5).
- **R4. 후방호환**: 훅을 쓰지 않는 7스킬은 onOvertaken 콜백을 등록하지 않으므로 **호출 자체가 안 일어남** →
  완전 무변경. 해시 동일해야 함(bristle 이관 방식에 따라 bristle만 변함, §4).

---

## 3. 추월 검출 + 발동 순서 결정론 (핵심 설계)

### 3a. 추월 "이벤트" 정의
프레임 t에서 `advance()` 전 progress를 `prev`, 후를 `cur`로 둔다. 레이서쌍 (A,B)에 대해
**A가 B를 추월** ≡ `prev[A] ≤ prev[B]` 이고 `cur[A] > cur[B]` (또는 동순위 tie-break 일관 정의).
이때 **B = 추월당한 자(overtaken)**, **A = 추월한 자(passer)**.

구현 위치: `step()`에서 `for advance` **직후, updateBoxes 전**에 "추월 검출 패스"를 추가.
`advance` 직전에 `prevProgress: Map<id, number>` 스냅을 떠둔다(또는 advance 진입 시 캐시).

> 주: 레인 충돌 여부는 따지지 않는다. 추월=progress 역전으로 단순 정의(레인 중립 규칙과 정합). bristle도
> 이미 레인을 안 본다(주석에 명시) — 동일 철학.

### 3b. 동시 다발 추월의 결정론 순서 (R1 차단)
한 프레임에 검출된 (overtaken, passer) 쌍들을 **다음 키로 안정 정렬** 후 그 순서대로 onOvertaken 호출:

1차: `overtaken`의 **현재 순위 기준 = cur progress 내림차순** (선두 가까운 쪽 먼저 — 기존 `order`와 동일 규약)
2차: 동률이면 `overtaken`의 **procKey** (이미 존재하는 시드 난수 tie-break, 안정·드로순서 무관)
3차: 한 overtaken을 동시에 여러 명이 추월한 경우 passer를 **procKey**로 정렬해 "대표 passer 1명"만 콜백에
   넘긴다(또는 가장 가까운 passer = cur gap 최소). **권장: cur progress가 overtaken에 가장 가까운 passer**
   = bristle의 "최근접 추격자" 의미와 일치. 동률 시 passer procKey.

→ 이 규약은 RNG 신규 draw가 없고(procKey는 init 시 고정), `all` 배열 순서에 의존하지 않음 → **드로 순서
독립 + 결정론**. 기존 `tryActivateSkill`의 `order` 정렬과 동일 철학이라 인지부하도 낮다.

### 3c. RNG 서브스트림
onOvertaken 핸들러도 자발동과 **동일한 `skillRng.get(self.id)`** 서브스트림을 쓴다(스킬당 1스트림 유지).
**중요**: 한 프레임에 자발동 시도와 훅 발동이 같은 레이서에서 겹치면 draw가 섞일 수 있다 → §5에서 "한
프레임에 한 스킬은 한 번만 발동" 가드로 해소.

---

## 4. 훅 contract 설계 (YAGNI 최소집합)

### 4a. 도입할 훅: `onOvertaken` **하나만**
시그니처(개념):
```
onOvertaken(ctx: SkillReactCtx)
  ctx = SkillContext와 동일한 변이/emit 능력
      + passer: RacerState   // 나를 막 추월한 자(대표 1명)
      // self = 추월당한 자(=스킬 소유자), frame/rng/params/emit/tryDodge/lines 동일
```
- 핸들러는 일반 SkillHandler와 **같은 형태**(같은 ctx 능력)지만, `ctx.passer`가 추가로 채워진다.
- 등록은 **type별 옵셔널 두 번째 핸들러**가 아니라, registry에 **reaction map**을 별도로 둔다:
  `registry.registerReaction('onOvertaken', type, handler)` 또는 `SkillHandler`를 객체로 확장
  `{ tick?: SkillHandler; onOvertaken?: ReactionHandler }`. **권장: 후자(객체형 핸들러)** — type 하나에 자발동
  +반응을 묶어 응집도↑, index.ts 등록 1줄 유지.

  현재: `r.register('bristle', bristleHandler)` (함수)
  변경안: 함수 또는 `{ tick?, onOvertaken? }` 둘 다 허용(후방호환) → 기존 7개는 함수 그대로 둠.

### 4b. 추가하지 않는 훅 (근거)
- `onHit`(방해 맞음): 현재 banana/roar/shell 피격 시 반응할 스킬 수요 없음. catwalk dodge는 이미
  `tryDodge` 메모이즈로 해결됨 → **불필요**.
- `onItemHit`/`onPassed`(내가 추월함)/`onLapComplete`: 실수요 0. **추가 금지** — 필요할 때 같은 패턴으로 확장.

### 4c. SkillEvent
onOvertaken 발동도 기존처럼 `activate`/`hit`/`dodge` variant를 emit하면 됨 → **새 variant 불필요**.
(원하면 연출 구분용 `variant:'counter'`를 추가할 수 있으나 YAGNI — bristle는 이미 activate/hit/dodge로 충분.)
→ renderer-dev/qa 통지: "onOvertaken 도입했으나 SkillEvent variant 유니온은 불변. 연출 영향 없음."
  (단 bristle 발동 타이밍이 '쿨다운 자발동'→'추월 순간'으로 바뀌므로 FX가 더 정확해짐만 통지.)

---

## 5. 쿨다운·재시도와의 관계 + 단일 발동 진입점 (R2/R3 차단)

핵심: **자발동과 훅 발동을 하나의 내부 함수로 수렴**시킨다.

제안: 기존 `tryActivateSkill(self, events)`를 `fireSkill(self, events, reaction?)` 형태로 일반화.
- `reaction` 없으면 = 기존 자발동 경로(tick 핸들러 호출), 있으면 = onOvertaken 핸들러 호출(ctx에 passer 주입).
- 두 경로 모두 **동일 게이트**: `frame < skillCooldownUntil` 이면 즉시 return(훅이 와도 쿨다운 중이면 무발동).
  `phase` finished/waiting/stunned 가드 동일. emit 여부로 cooldown/RETRY 부여도 동일 로직 재사용.

프레임 내 호출 순서(step):
```
1. resolveTimer (기존)
2. tryActivateSkill 루프 (기존 자발동 — tick 핸들러)   ← bristle를 훅으로 완전 이관하면 bristle은 여기서 빠짐
3. meanProgress, advance 루프 (기존; prevProgress 스냅은 advance 직전)
4. [신규] 추월 검출 → §3b 순서로 onOvertaken 발동 루프
5. updateBoxes (기존)
```
- **단일 발동 가드**: 한 프레임에 step2에서 이미 발동한 레이서는 `skillCooldownUntil`이 미래로 설정되므로
  step4에서 자동으로 무발동(쿨다운 게이트). → 같은 프레임 자발동+훅 이중발동·RNG 더블드로 방지(R3).
- **연쇄 차단(R2)**: step4의 부수효과(shove)로 생긴 2차 역전은 step4 안에서 재검출하지 않는다(스냅샷은 step3
  경계 1회). 다음 프레임에 자연히 검출되며 그때도 쿨다운 게이트가 막는다 → 무한루프 불가.

### bristle 이관 범위 (마이그레이션)
두 옵션:
- **옵션 A(권장): 완전 이관.** bristle을 `{ onOvertaken }` 만 갖는 핸들러로 바꾼다. 후보 스캔/closing 추정
  로직 삭제, ctx.passer를 target으로 사용. 별/catwalk dodge·shove·slow·recoil 로직은 그대로 재사용.
  - 효과: 발동 타이밍이 "쿨다운마다 뒤를 스캔"→"실제로 추월당한 그 프레임"으로 정확해짐.
  - **결정론 영향: bristle 경기 결과(progress)가 바뀐다** → 골든 스크린샷·bias/balance 재확인 필요.
    determinism 테스트는 "같은 seed 재현"만 보므로 통과하지만, 절대값이 달라지므로 **balance 하니스 before/
    after 측정 + engine-bias 재확인 필수**. 이건 의도된 동작 변경이라 수용 가능.
- **옵션 B: 듀얼 트리거 유지.** 자발동 scan은 두되 onOvertaken도 받는다. → 이중 로직·이중 발동 위험으로
  **비권장**(R3). 굳이 점진 이관할 이유 없음(스킬 1개).

→ **권장: 옵션 A.** 단, "엔진 결과 절대값 변경"이므로 qa-verifier에 결정론-영향 플래그.

---

## 6. 수혜 스킬 (현재/미래)

- **bristle(현재 유일한 실수요)**: §5 옵션A로 핸들러가 절반으로 줄고 의미가 명확해짐. false pos/neg 제거.
- **신규 반응형 아이디어 (구현은 별건, 여기선 가능성만)**:
  1. **거북/방어 "맞받아치기"**: 추월당하면 추월자에게 짧은 stun 대신 자신에게 일시 무적/감속면역
     (onOvertaken → self buff). bristle과 역할 겹치니 신중.
  2. **"추격 점화"**: 추월당하면 분노 버스트(self.burst 짧게) — "졌잘싸" 역전 연출. catch-up와 중복 주의.
  → 둘 다 **지금 추가 안 함**. 훅이 이런 걸 *가능케 한다*는 점만 기록.

---

## 7. 검증 계획 (성공 기준)

1. **후방호환(무변경 7스킬)**: bristle 외 스킬만 있는 경기의 `hashFrames`가 변경 전후 **동일**.
   → 검증: 도입 후 `npm run test`의 determinism 통과 + (수동) bristle 미포함 시드 몇 개 해시 대조.
2. **결정론(훅 순서 가드)**: bristle 포함 경기를 **같은 seed로 2회** 시뮬 → `result.order`/`hashFrames` 일치.
   기존 `engine-determinism.test.ts`가 이미 커버. **추가 권장 테스트**: 한 프레임에 다중 추월이 일어나는
   시드를 찾아, 검출쌍 정렬 규약(§3b)이 안정적인지 직접 단언(이벤트 순서 스냅샷 비교). qa-verifier와 조율.
3. **skills.test.ts**: 활성 집합 7종 불변(bristle는 여전히 'activate' emit해야 L18 통과). 이관해도 'activate'를
   emit하므로 통과. **단** "all skills activate" 루프가 자발동만 가정하지 않는지 확인 — 이벤트 수집은
   variant==='activate'만 보므로 onOvertaken에서도 activate emit하면 OK. **변경 불필요 예상.**
4. **schema.test.ts**: KNOWN_SKILL_TYPES 불변(새 type 없음) → **변경 불필요.**
5. **engine-bias.test.ts**: 누구도 독주(>0.45) 안 함 / 모두 승리 가능 — bristle 타이밍 변경이 공정성 깨면 안 됨.
   → 도입 후 통과 확인 필수.
6. **balance 하니스**: 옵션A 채택 시 `npx vite-node scripts/balance.ts` before/after 첨부. bristle 승률이
   floor(>0) 유지·ceiling(<0.45) 유지 확인. 어긋나면 bristle params(recoilBurst/pushBack 등) 1회 조정 후 재측정.
7. **typecheck**: SkillContext/registry 시그니처 확장 후 `npm run typecheck` 통과.

---

## 8. 변경 파일 예상 (구현 시)

- `src/engine/skills/types.ts` — `ReactionHandler`/객체형 `SkillHandler`(`{tick?,onOvertaken?}`), `ctx.passer`.
- `src/engine/skills/registry.ts` — 객체/함수 핸들러 모두 수용, reaction 조회.
- `src/engine/RaceEngine.ts` — `step()`에 추월 검출 패스 + onOvertaken 발동 루프, `fireSkill` 일반화,
  advance 직전 prevProgress 스냅.
- `src/engine/skills/bristle.ts` — (옵션A) 스캔 제거, onOvertaken로 재작성.
- `src/engine/skills/index.ts` — bristle 등록 형태(객체) 변경.
- 테스트: (권장) determinism에 다중추월 순서 가드 1케이스 추가. schema/skills는 변경 불필요 예상.

---

## 9. 팀 통신
- **content-designer**: onOvertaken은 **새 params를 요구하지 않음**(bristle 기존 params 그대로). 신규 반응형
  스킬을 추가할 때만 params 협의. 통지 끝.
- **renderer-dev**: SkillEvent variant 유니온 **불변**(activate/hit/dodge 재사용). 새 phase 없음.
  단 bristle FX **발동 타이밍이 추월 순간으로 정확해짐** → 슬로우모션·말풍선 트리거 검토 권고.
- **qa-verifier**: **결정론 영향 플래그** — 옵션A는 bristle 포함 경기의 절대 progress가 바뀐다(같은 seed
  재현성은 유지). 골든 스크린샷 재생성 + bias/balance 재확인 필요.
