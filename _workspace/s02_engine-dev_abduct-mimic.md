# s02 engine-dev — abduct (🕷️ 거미) + mimic (🛸 외계인) 핸들러

브랜치 `feat/spider-alien`. 엔진(`src/engine/`)만 담당. 데이터/아트/등록은 content-designer 병렬.

## 변경 파일
- `src/engine/skills/abduct.ts` (신규) — 거미줄 납치 핸들러
- `src/engine/skills/mimic.ts` (신규) — 의태 스캔 핸들러
- `src/engine/skills/types.ts` — `SkillContext`에 `skillParamsOf(id)` + `invokeSkill(copiedType, paramsOverride)` 추가
- `src/engine/skills/index.ts` — abduct/mimic 등록(자발동 tick)
- `src/engine/RaceEngine.ts` — `fireSkill`의 ctx 빌드를 `shared` + per-skill로 분리, `skillParamsOf`/`invokeSkill` 구현
- `tests/unit/schema.test.ts` — `KNOWN_SKILL_TYPES`에 'abduct','mimic' 추가(내 영역). catalog 목록(line 34)은 content-designer가 갱신.
- `tests/unit/skills.test.ts` — "all self-activating skills" 테스트 갱신 + abduct hit/team-exclusion + mimic copy/determinism 테스트 추가
- `scripts/balance.ts` — `maxFrames` 40s→60s/lap (아래 "non-finish" 항목 참조)

## abduct (거미줄 납치) — 결정론적 단일표적 위치강등
- divebomb 타게팅 재사용: 앞선(progress>self) 적 중 `minRange..range` 가장 가까운 1명. 팀원/finished/waiting 제외, **id tiebreak(rng 없음)**.
- ⭐star → 'dodge', 🐱catwalk(`ctx.tryDodge`) → 'dodge'. 그 외 'activate'→효과→'hit'(targetId=표적).
- 효과: `target.progress = clamp(min(target.progress, self.progress - pullGap*powerEffectScale))` (0 미만 클램프, 항상 뒤로만). 직후 거미줄 엉킴 `slowUntil`/`slowMul=tangleMul` (slow 자체 magnitude는 엔진 speed-적용부 `powerEaseSlow`로 power 저항 일관).
- **anti-stack**: banana식 `abductImmuneUntil = frame + tangleFrames + immuneMs` — 릴레이 연속잡기 차단. (`SkillRuntime` 인덱스시그너처로 커버, 스키마 변경 불필요.)
- **도박/신규 rng draw 0** — 서브스트림 완전 무손. 표적 없으면 emit 안 함 → RETRY_COOLDOWN.
- params(절대 progress 단위, content-designer 최종): `range:130, minRange:16, pullGap:90, tangleMul:0.55, tangleMs:900, immuneMs:1000`.

## mimic (의태 스캔) — 변수형 카피, A안 invokeSkill
- **가장 가까운 주자 1명**(|progress-self|, self/finished/waiting 제외, **팀 무관**, `scanRange` 캡). id tiebreak, **rng 없음**.
- 그 주자의 type+params를 `ctx.skillTypeOf`/`ctx.skillParamsOf`로 얻어 `ctx.invokeSkill(type, params)` 호출.
- **단일표적·fallback 없음**(divebomb 패턴, coordinator 확정): 그 1명이 복사불가/hold면 mimic도 hold→RETRY. (순회 없음 = 더 단순·결정론 명확.)
- **재귀/반응형 차단은 엔진 invokeSkill 내부**(레지스트리 보유):
  - `copiedType==='mimic'` → 거부(무한재귀 차단)
  - `skills.get(copiedType)` 없음(반응형 'bristle'은 onOvertaken만, tick 없음 / 미등록) → 거부
  - 복사 핸들러 실행 후 emit 0이면 false(hold) 반환
  - 복사 컨텍스트의 `invokeSkill`는 `()=>false`로 박아 **중첩 카피도 2중 차단**(방어적).
- **결정론·스트림 격리**: 복사 핸들러는 ctx{self:alien, all, frame, emit, lines, tryDodge, addIceZone} + `params=복사params` + `rng = skillRng(alien).fork('mimic:'+copiedType)`로 호출. 외계인 전용 안정 서브스트림 → 복사 대상 주자의 스트림 오염 0, 드로 순서 안정.
- **연출**: 복사 emit은 `type: copiedType`로 스탬프(racerId=외계인). 즉 "외계인이 [복사한 스킬]을 썼다"로 읽힘 → renderer 기존 variant 그대로 재사용, 신규 variant/phase 없음.
- params: `scanRange:350`.

### mimic "따라하기" 마커 (후속, coordinator 요청 — SkillEvent 스키마 무변경)
- 복사가능 타깃에서 **마커를 첫 이벤트로 추가 emit**: `{ type:'mimic', variant:'activate', racerId:외계인, targetId:복사대상(원래 주인) }`. **line 없음, 신규 필드 없음**. copiedType은 renderer가 targetId→characterId→catalog로 유도.
- 순서: 마커 먼저 → 그다음 복사 스킬 기존 이벤트(외계인 actor). 복사가능 여부는 emit 전 `ctx.canCopySkill(type)`(신규, 순수 레지스트리 체크: 'mimic'/반응형 거부, 무 dispatch·무 rng)로 게이트.
- **마커는 순수 emit(rng draw 0)** → 결정론/서브스트림 영향 0.
- 신규 엔진 표면: `SkillContext.canCopySkill(type)`. 복사 ctx에선 `canCopySkill:()=>false`(중첩 차단).
- skills.test mimic 케이스 갱신: 마커 존재+owner targetId / 마커가 같은 프레임 첫 외계인 이벤트 / mimic-typed는 activate 마커뿐 / 그 외는 copyable type / replay-identical.

## 검증
- `npm run typecheck`: **통과**.
- `npm run test`: 신규 4테스트(self-activating set / abduct hit+tangle / abduct team-exclusion / mimic copy+determinism) 포함 **49 pass**. 
  - 단, `engine-bias.test.ts` 3건 **RED** — 원인은 **bear**(기존 캐릭) floor 미달: laps=1 6.4%(<0.07), laps=10 individual 5%·slot 1건. abduct/mimic 로직 문제 아님(9캐릭 분산 희석 + 신규 방해자가 리더 견제 → 느린 탱크 bear가 더 자주 꼴찌). coordinator 지시: **floor 낮추지 말고 balance-tuner가 bear 버프로 green**. (게이트 은폐 금지.)

## 결정론에 영향 주는 변경 (qa-verifier 플래그)
- `SkillContext`에 `skillParamsOf`/`invokeSkill` 추가. invokeSkill rng는 **외계인 전용 fork('mimic:'+type)** — 기존 7스킬·onOvertaken·서브스트림 라벨 **무변경**. 기존 골든/결정론 테스트 영향 없음(같은 config+seed=동일 재생 확인: mimic 테스트가 replay-identical 검증).

## balance 수치 (`npx vite-node scripts/balance.ts`, 9캐릭, fair=11%)
| 모드/lap | spider win% (fair×) | alien win% (fair×) | bear (게이트 offender) |
|---|---|---|---|
| INDIV l=1 | 15% (1.36×) | 9% (0.83×) | 7% (0.66×) |
| INDIV l=3 | 20% (1.76×) | 8% (0.74×) | 6% (0.58×) |
| INDIV l=10 | 17% (1.55×) | 8% (0.70×) | 5% (0.43×) ← floor fail |
| TEAM l=10 | 18% (1.62×) | 8% (0.72×) | 7% (0.59×) |
| RELAY l=10 | 16% (1.42×) | 6% (0.52×) | 5% (0.43×) |

- **spider/abduct**: 멀티랩에서 강함(20%@l3) — yank-back이 랩마다 누적. floor 걱정 없음, 오히려 *상한* 주시(balance-tuner trim 후보).
- **alien/mimic**: fair~약간 낮음. 변수형이라 평균회귀, 릴레이 l=10 6%로 가장 약함. laps=1 floor는 통과. 고랩 릴레이 약세는 balance-tuner 판단(엔진 로직 정상).
- **bear**: 실제 게이트 실패 주범 → balance-tuner 배정됨.

### non-finish 수정 (`scripts/balance.ts` maxFrames)
- TEAM homogeneous(거미×2 팀 포함 18주자) seed 2075가 frame 2805에 자연 종료하나 harness 기존 cap=2400(40s/lap)에서 throw. 엔진은 정상 종료(livelock/결정론깨짐 아님) — 거미 yank+tangle+스턴 중첩이 1랩을 ~2800프레임까지 늘림. cap을 60s/lap(3600)로 상향(여전히 runaway guard). engine `autoMaxFrames`(~4538)는 무변경.
