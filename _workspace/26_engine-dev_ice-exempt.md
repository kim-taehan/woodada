# 26 engine-dev — 빙판 종족 면제 + catwalk slipBoost 제거

## 변경 요약 (엔진 룰 2건)
1. **펭귄 빙판(icefield) 종족 면제 확장**: `applyIce`에서 `characterId === 'eagle'`(날아감) 또는 `'cat'`(점프)는 빙판 배율을 아예 적용하지 않음(1.0 통과, slow도 boost도 없음). 기존 분기는 펭귄=boost / 그 외=slow. 이제 **펭귄=boost, 독수리·고양이=무영향, 나머지=slow**.
2. **catwalk slipBoost 제거**: catwalk는 더 이상 속도 버스트를 주지 않음. 확률 회피 창(`dodgeUntil`/`dodgeChance`)만 제공. cat 데이터 params에서 `slipBoost` 키 제거.

## 변경 파일
- `src/engine/RaceEngine.ts` — `applyIce` 상단에 `if (self.characterId === 'eagle' || self.characterId === 'cat') return;` 추가. 주석에 면제 사유(독수리=fly, 고양이=jump) 명시. 펭귄 params(slowFactor/boostFactor) 무변경.
- `src/engine/skills/catwalk.ts` — `self.skill.burst = slipBoost` + `self.skill.effectUntil` 라인 제거. 회피 창(dodgeUntil/dodgeChance)만 설정. 주석 갱신("속도 보너스 없음").
- `src/data/characters/cat.ts` — params `{windowMs:1500, slipBoost:0.16, dodgeChance:0.6}` → `{windowMs:1500, dodgeChance:0.6}`. type(catwalk)·cooldownMs·lines 무변경.
- `tests/unit/skills.test.ts` — 신규 테스트 `icefield exempts the eagle (flies) and the cat (jumps) from the slow`. 기존 catwalk/divebomb/icefield 테스트는 slipBoost를 직접 참조하지 않아 무수정으로 통과.

### 면제 테스트 설계(결정론·교란 제거)
step 기반 비교는 **블로킹 연쇄**(앞 레이서가 느려지면 뒤도 `min(speed,blocker)*0.5`로 더 느려짐)에 오염돼 면제를 분리 못 함(첫 시도에서 면제 레이서 step이 0.077까지 내려가 실패). 그래서 **조합으로 교란 제거**:
- 로스터를 `[penguin, eagle, cat, eagle, cat]`(펭귄+면제종만)으로 구성하면 slowFactor가 건드릴 레이서가 0 → slowFactor를 0.85/0.4로 바꿔도 **전 프레임 trajectory가 byte-identical**해야 면제 정상.
- 대조군 `[penguin, eagle, cat, dog, cat]`(비면제 dog 포함)은 slowFactor 변화에 **divergence** 해야 slowFactor가 살아있음을 증명.
- 둘 다 통과. 빙판 zone 형성도 확인(equality 공허 방지).

## 검증 결과
- `npm run typecheck`: 통과(에러 0).
- `npm run test`: **41/42 통과, 1 실패** — `engine-bias > every character can win`에서 **cat 0.082 < 0.1 floor**. (skills 9개 전부 통과 포함 신규 면제 테스트, determinism/divebomb/icefield/catwalk dodge 전부 통과. slot 공정성 테스트 통과.)

## 밸런스 재측정 (`scripts/balance.ts`, 5종×2, N=3000)
| | dog | cat | monkey | eagle | bear | lead chg |
|---|---|---|---|---|---|---|
| before(25번) | 0.291 | 0.216 | 0.118 | 0.155 | 0.220 | 7.8 |
| after(slipBoost 제거) | 0.325 | **0.116** | 0.139 | 0.177 | 0.243 | 7.8 |

cat이 0.216 → 0.116으로 하락. dog가 0.325로 약간 상승(여전히 <0.45/<0.6, 독주 아님).

## bias 테스트 실패 — 구조적 원인 (과튜닝 금지 판단)
**cat 0.082 < 0.1 (bias 로스터, N=1200, 시드창 다름).** 원인은 튜닝 갭이 아니라 **구조적**:
1. catwalk가 이제 **순수 방어(회피)만** 한다. 회피는 방해를 피할 뿐 **자기 순위를 끌어올리는 메커니즘이 없다**. 균형 잡힌 필드에서 가끔 바나나/포효를 피하는 것만으로는 1등을 못 만든다. slipBoost가 cat의 유일한 "전진" 수단이었다.
2. 새 **빙판 점프 면제는 펭귄이 있을 때만** 의미가 있는데, **bias/balance 로스터에는 펭귄이 없다**(`allThree` = dog/cat/monkey/eagle/bear). 따라서 cat은 이 로스터에서 보상이 0이다. → 22번에서 eagle이 divebomb burst 추가 전에 구조적으로 약했던 것과 동일한 패턴.

### 1회 조정 시도 + 재측정 (실패 → 되돌림)
허용 레버(type·cooldownMs는 변경 금지라 `windowMs`/`dodgeChance`만)로 dodge 버프 시도: `windowMs 1500→2200, dodgeChance 0.6→0.85`.
- balance.ts: cat 0.116 → 0.149 (소폭 개선)
- bias 테스트: cat 0.076 (여전히 < 0.1, **여전히 실패**)
방어 버프는 펭귄 없는 로스터에서 cat을 게이트 위로 못 올린다(구조적 한계 재확인). **과튜닝 금지 원칙에 따라 params를 원복**(1500/0.6)하고 현황 보고. dodgeChance를 더 올리거나 새 속도 메커니즘을 넣는 것은 사용자 의도("고양이는 스피드 기술 필요 없음")에 정면으로 반함.

### 권고 (스코프 외 — 합의 필요)
다음 중 하나의 **설계 결정**이 필요(엔진 단독 과튜닝으로 풀 문제 아님):
- (A) bias 테스트 로스터에 penguin을 포함시켜 cat의 ice-jump 가치가 게이트에 반영되게 한다(가장 정합적). 단 이는 테스트 변경이라 qa-verifier/orchestrator 합의 필요.
- (B) cat에 divebomb-burst처럼 **회피 성공 시 소량 전진** 같은 "보상" 메커니즘을 catwalk에 추가(스피드 기술 아닌, 회피의 보상). content-designer/사용자 의도 재확인 필요.
- (C) cat의 floor 미달을 "현 로스터에선 의도된 약체"로 수용하고 bias 게이트 기준을 조정.

→ **나는 (A)~(C) 중 무엇도 임의 시행하지 않았다.** 엔진 룰 2건은 정확히 요청대로 반영했고, cat이 게이트 아래로 떨어진 것은 요청된 설계 변경의 직접 결과임을 수치와 함께 보고한다.

---

## renderer 인계 명세 (연출 변경점)
1. **catwalk는 더 이상 speed boost가 아니다.** 발동 시 "쌩 가속" 스피드라인 연출이 있었다면 제거/완화. catwalk activate = "회피 자세(점프 준비/유연)" 톤으로. `racer.skill.burst`는 catwalk에서 더 이상 세팅 안 됨(zoomies·아이템만). 회피 창 글로우는 `racer.skill.dodgeUntil` 기준 유지(변경 없음). dodge 성공 이벤트(`variant:'dodge', targetId=cat`)도 변경 없음.
2. **빙판 위 고양이 = 점프 연출.** 고양이가 `frame.iceZones` 구간 안에 있을 때(렌더러가 progress↔zone 매핑으로 판정) "얼음을 폴짝 뛰어넘는" 연출 가능. 엔진은 slow를 안 줄 뿐(속도 1.0 그대로 통과), 점프 비주얼은 렌더러 몫.
3. **빙판 위 독수리 = 면역(비행) 표현.** 독수리는 빙판 위를 날아 지나가므로 slow 없음. 그림자/날갯짓 등으로 "빙판 안 밟음" 표현 가능(선택).
4. `iceZones` 프레임 상태·penguin boost 연출은 22번 명세 그대로 유효(변경 없음).

## qa-verifier 플래그
- **결정론 영향 변경**: applyIce 분기 추가 + catwalk burst 제거. 신규 면제 테스트로 byte-identical/divergence 양면 커버. 기존 determinism 테스트 통과.
- **bias 게이트 1건 실패(cat 0.082)** — 위 (A)~(C) 설계 결정 대기 중. 이건 엔진 버그가 아니라 의도된 설계 변경의 결과이므로, 머지 전 orchestrator/content-designer와 cat 보상안 합의 필요.
