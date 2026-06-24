# c03 engine-dev — 패시브 4종: 외계인 AOE 면역 + 펭귄 막판 스퍼트 + 거미 벽타기 + 고양이 코너탈출

## 👽 외계인 — 광역(AOE) 스킬 면역 (트레이트 방식)
id 하드코딩 없이 `aoeImmune` 트레이트로 일반화. icefield는 기존 `airborne`가 이미 커버하므로 중복 처리 안 함.

- `src/data/schema.ts` — `CharacterData`에 `aoeImmune?: boolean` 추가(주석: airborne과 구분, 얼음 중복 금지).
- `src/engine/types.ts` — `RacerState`에 `aoeImmune?: boolean` 추가.
- `src/engine/RaceEngine.ts` racer init — `aoeImmune: stats?.aoeImmune` 복사.
- `src/data/characters/alien.ts` — `aoeImmune: true` (airborne 바로 아래, 주석).
- `src/engine/skills/roar.ts` — 스턴 루프에서 `if (r.aoeImmune) { ctx.emit({variant:'dodge', targetId:r.id}); continue; }` 추가. star/i-frame 체크와 같은 줄에 배치. 곰 roar `hit` 대신 `dodge` 이벤트 → 외계인 스턴 안 됨.
- 현재 proximity-AOE 디스럽트는 roar뿐(banana/abduct=단일타겟, decoy=단일충돌, icefield=지상해저드/airborne). 향후 AOE도 이 트레이트만 체크하면 됨.

## 🐧 펭귄 — 막판 스퍼트 (스테미너)
마지막 바퀴의 마지막 커브를 빠져나와 결승선으로 향하는 홈 스트레치(=바텀 직선 [0,0.28))에서만, 펭귄의 직선 가속력이 평소 cornering 2(="sprint 4")에서 sprintCornering 0(="sprint 6")으로 올라가 강아지(cornering 1="sprint 5")까지 앞지른다. 속도만, 레인 중립.

- `src/engine/tuning.ts` — `PENGUIN_SPURT = { sprintCornering: 0 }` 신규 상수(주석에 매핑 근거).
- `src/engine/RaceEngine.ts`
  - `import ... PENGUIN_SPURT` 추가.
  - `inFinalHomeStretch(self)` 헬퍼 추가: 비-릴레이는 `progress >= laps*trackLength`(최종 결승주행=바텀직선 진입), 릴레이는 앵커 레그만 `progress >= trackLength`. **데스매치(`config.elimination`)는 결승선이 없어 항상 false**(스퍼트가 매 바퀴 발동하는 버그 방지).
  - `advance()` 베이스속도 직후: `penguin && !onCurve && inFinalHomeStretch(self)`일 때 `bonus = sectionSpeedBias(0,false) - sectionSpeedBias(self.cornering,false)`를 `* jitter * condition`으로 가산. 같은 게인 상수(STATS.corneringGain)로 계산해 평소 직선 바이어스와의 *차이*만 더함.

### 수치(검산, corneringGain=0.35)
- 펭귄 평소 직선 바이어스: +0.0770
- 강아지(sprint5) 직선: +0.1540
- sprint6 직선: +0.2310 (스퍼트 중 펭귄 = 이 값, 강아지 추월)
- 가산 보너스: **+0.1540** (≈ 순항속도 1.4의 11%), 최종 바텀 직선(~0.21랩)에서만.

## 윈도우 정의 근거
- track.ts: 바텀 직선 [0,0.28), 좌커브 [0.78,1.0)→결승선 u=0. `FINISH_OFFSET_FRAC=0.21 < 0.28` → 최종 결승주행(u∈[0,0.21))은 전부 바텀 직선. 좌커브 통과 = `progress ≥ laps*trackLength` 이후 = 홈 스트레치. 깔끔·모호성 없음.

## 결정론/순수성
- 두 패시브 모두 RNG draw 없음(순수 트레이트/lap-phase/lapIdx 계산). 시드 시퀀스 무변경.
- 곰 패시브(applyBearShove)·강아지 패시브(DOG_STUN_RECOVER)는 건드리지 않음.

## 검증
- `npm run typecheck`: 통과.
- `npm run test`: **9 files / 62 tests 전부 통과**.
  - engine-bias 7 게이트(laps 1/3/10): 통과 — 두 패시브 추가 후에도 아무도 >0.45 독주 안 함, 모든 캐릭터/슬롯 승리 가능, no-runaway 유지.
  - determinism: 통과(절대 스냅샷 핀 없음).
  - 신규 테스트 `tests/unit/skills.test.ts` — "roar never hits the AOE-immune alien": 곰 팩+외계인 60시드에서 roar `hit`이 외계인에게 절대 안 가고, 외계인 대상 roar `dodge`는 발생(면역 경로), 비-외계인은 roar에 맞음(라이브니스). 단일타겟 스턴(banana/shell아이템) 혼선 피하려 이벤트 소스에서 단언.

## 🕷️ 거미 — 벽타기 (곡선 바깥 레인 거리손해 감소, 트레이트 방식)
곡선에서 바깥 레인으로 돌 때 무는 거리 패널티(LANE.distLoss)를 일정 비율만큼 덜 본다. 단일 지점(`laneDistanceFactor`)에서만 처리. 속도 무변경(레인→거리 환산만 완화 → "레인은 속도에 영향 없음" 불변 유지).

- `src/data/schema.ts` — `CharacterData`에 `outerGrip?: number`(0~1) 추가.
- `src/engine/types.ts` — `RacerState`에 `outerGrip?: number` 추가.
- `src/engine/RaceEngine.ts` racer init — `outerGrip: stats?.outerGrip` 복사. advance의 호출부 `laneDistanceFactor(self.lane, onCurve, self.outerGrip)`.
- `src/engine/overtake.ts` — `laneDistanceFactor(lane, onCurve, outerGrip = 0)`로 시그니처 확장. 유효 distLoss = `LANE.distLoss * (1 - clamp(outerGrip,0,1))`. **기본값 0이라 기존 호출부/공개 re-export(`engine/index.ts`) 전부 하위호환**(타입에러 0).
- `src/data/characters/spider.ts` — `outerGrip: 0.3` (아래 밸런스 참조).
- 신규 테스트 `tests/unit/overtake.test.ts` "벽타기 (outerGrip)": 직선에선 grip 무관 항상 1, 곡선에선 grip이 패널티를 비례 완화(never 반전), grip 0.5 = 손해 절반, 기본인자=명시0(하위호환). 순수함수 단언.

### ⚠️ 밸런스: outerGrip 시작값 0.5 → 0.3 으로 낮춤 (게이트 위반 보고)
team-lead가 제시한 시작값 **0.5는 engine-bias 슬롯공정성 게이트(laps=10)를 깸**. 측정(동일 시나리오 N=200, laps=10):

| outerGrip | minSlot (floor 2.22) | maxSlot | 거미 승률 | 게이트 |
|---|---|---|---|---|
| 0.0 (패시브 없음) | 4 | 21 | 0.170 | PASS |
| 0.3 | 4 | 25 | 0.175 | **PASS** |
| 0.4 | 1 | 22 | 0.205 | FAIL |
| 0.5 (제시값) | 2 | 24 | 0.160 | FAIL |

- 실패는 **거미가 너무 많이 이겨서가 아님**(승률 0.16~0.20로 베이스라인과 거의 동일, ceil 0.45 무관). 거미의 거리 메트릭 변화가 10랩에 걸쳐 누적돼 **저분산 출발슬롯 하나를 floor(2.22) 아래로 굶김**(off-by-1 수준). 슬롯공정성 항목 위반.
- 0.3은 floor 대비 margin(minSlot=4=floor의 약 2배) + 거미 승률 불변 → "작게 시작" 취지에 부합하는 flavor 에지. 그래서 0.3 채택.
- **corneringGain 같은 공유 밸런스 노브는 안 건드림**(team-lead 규칙 준수). 조정한 건 내가 도입하는 거미 전용 신규 param의 시작값뿐. 최종 세기는 밸런스 패스에서 balance-tuner가 재검토 요망(0.4~0.5를 쓰려면 슬롯공정성 floor/샘플수 N 재검토 필요).

## 🐱 고양이 — 코너 탈출 가속
곡선→직선 전환(직전 onCurve=true → 이번 onCurve=false) 순간부터 짧은 윈도우 동안 speed에 `× (1+boost)` 가속. 잽싼 고양이가 코너를 빠져나오며 튀어나가는 연출.

- `src/engine/tuning.ts` — `CAT_CORNER_EXIT = { boost: 0.06, windowFrames: 15 }` 신규(작게 시작, ~0.25s).
- `src/engine/RaceEngine.ts`
  - 전환 감지를 위해 `self.skill.prevOnCurve`(직전 구간) + `self.skill.cornerExitUntil`(윈도우 끝 프레임) 스킬백에 래치. 전환 시 `cornerExitUntil = frame + windowFrames`, 그 동안 `speed *= 1+boost`.
  - characterId 분기(트레이트 안 만듦 — 1캐릭터 전용 on/off라 PENGUIN 패턴과 일관).
- 결정론: 순수 구간/프레임 래치, RNG 없음·추가 draw 없음. 속도만(레인 중립).
- 신규 테스트 `tests/unit/skills.test.ts` "cat 코너 탈출 가속": 멀티랩에서 윈도우가 실제 래치되고(라이브니스), **새로 무장되는 프레임엔 항상 직선**(곡선→직선 전환 조건 성립, 곡선 중 무장 안 됨)임을 메커니즘 수준에서 단언.

## 패시브 정리 (team-lead 요청: 분기 흩어짐 방지)
RaceEngine에 `// ─── CHARACTER PASSIVES ───` 인덱스 주석 블록 1개로 6종을 한눈에 찾게 정리. 훅 지점이 본질적으로 달라(전영역 후처리 vs 스턴루프 vs per-racer advance) 단일 호출점 강제는 안 함(과한 추상화 회피):
- 🐻 bear `applyBearShove()` — 전영역, progress 확정 후(레인 push)
- 🐶 dog — fresh-stun 루프(DOG_STUN_RECOVER)
- 🐧 penguin / 🐱 cat — **`applyCharacterSpeedPassives()` 신규 헬퍼로 통합**(per-racer 속도, advance 내부 1곳에서 호출). 기존 펭귄 인라인 블록을 이 헬퍼로 이동.
- 👽 alien(aoeImmune) / 🕷️ spider(outerGrip) — 데이터 트레이트, 각자 단일 소비점(roar 핸들러 / laneDistanceFactor)
각 분산 지점(dog 주석 등)엔 `(see CHARACTER PASSIVES)` 포인터 추가.

## 보류/메모
- 펭귄 스퍼트는 **새 SkillEvent/variant/phase가 없는 순수 속도 변경**이라 스크린샷에 구분되는 연출 산출물이 없음 → Playwright 육안검증은 의미 없어 생략. 막판 스퍼트 FX/날갯짓 연출을 추가하려면 renderer-dev에게 별도 요청 필요(그때 variant 추가). 거미 벽타기·고양이 코너탈출도 순수 거리/속도 변경이라 전용 연출 없음(연출 원하면 별도 요청).
- 세기(`PENGUIN_SPURT.sprintCornering=0`, `aoeImmune` 면역폭, `spider.outerGrip=0.3`, `CAT_CORNER_EXIT.boost=0.06`)는 작게 시작. 스킬+밸런스 통합 패스에서 balance-tuner가 조정.
- renderer-dev 통지 사항 없음(이벤트/phase 무변경). content-designer 통지: alien `aoeImmune:true`, spider `outerGrip:0.3` 데이터 추가됨(고양이는 데이터 변경 없음 — characterId 분기 + tuning 상수만).
