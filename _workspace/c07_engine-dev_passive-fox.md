# c07 engine-dev — 구미호 여우불 점멸 패시브 + 9종 패시브 최종 요약

## 🦊 구미호 — 여우불 점멸 (Foxfire Blink)
도깨비불처럼 `FOX_BLINK.periodMs`마다 앞으로 `dist`만큼 순간이동(progress 점프, 레인 유지). 무적·스턴 없는 순수 위치 이점.

### 변경 파일
- `src/engine/tuning.ts` — `FOX_BLINK = { periodMs: 7000, dist: 12 }` 신규(초기 24/4500은 독주라 약화, 아래 밸런스 참조).
- `src/engine/types.ts` — `SkillEvent.variant`에 `'blink'` 추가(renderer FX 훅용, racerId=구미호).
- `src/engine/RaceEngine.ts`
  - `applyFoxBlink(prevProgress, events)` 신규 — `advance` 직후, `resolveForwardZones` 직전 호출.
  - **노클립**: 점프 후 `prevProgress.set(fox.id, fox.progress)`로 착지점을 frame-start로 인정 → 개인존 클램프가 점프해 넘은 동물 뒤로 당기지 않음(착지점보다 앞선 동물엔 여전히 클램프). bristle(onOvertaken)도 이 점프를 추월로 안 봄(prev가 앞으로 가서) → 마법 통과답게 카운터 안 유발.
  - **결정론**: RNG draw 0. `(frame + phase) % periodFrames === 0` 타이머, phase = `floor(procKey * periodFrames)`(per-fox 안정 오프셋) → 여러 구미호 동시 점멸 방지. 시드 시퀀스 무변경.
  - 가드: finished/waiting/stunned/eliminated 제외(running/blocked/straying는 발동 — 막혔을 때 탈출이 핵심).
  - CHARACTER PASSIVES 인덱스에 🦊 추가.
- fox.ts 데이터 변경 없음(characterId 'fox' 분기 + tuning 상수만, dog/penguin/cat 패턴).

### 테스트
- 신규 `tests/unit/skills.test.ts` "fox 여우불 점멸": blink 발동, 블링크 프레임 progress 증가량이 일반 스텝보다 `dist` 이상 큼(전방 점프·노클립 단조 증가), 블링크 프레임 목록 재생 동일(결정론), 블링크 간격이 periodFrames의 양의 배수(스턴으로 한 번 건너뛰어도 격자 유지). 단독 21 테스트 통과.

### 최종 스위트 상태
- `npm run typecheck`: 통과.
- `npm run test`: **62 passed / 6 failed**. 6 실패는 전부 engine-bias char/slot floor(laps 1/3/10) — 위에서 증명한 **box-seek/holdLane 동시변경發 곡선러 starvation 회귀**(fox 무관). fox 테스트·determinism·나머지 skills 전부 통과.

## ⚠️ 밸런스: dist 24→12, periodMs 4500→7000 (자체 과강 수정) + engine-bias 회귀는 내 것 아님
1. **fox 자체 과강 수정**: 초기값 dist=24/period=4500은 **여우불이 독주**(laps=3 N=400에서 fox 승률 0.588, ceil 0.45 초과, cat/hedgehog floor 미달). team-lead 명시 "과하면 거리/주기로 약화" 권한대로 **dist=12/period=7000**으로 낮춤 → fox 0.103(laps1)/0.172(laps3), 미드팩(공정 근처)·비독주. 순수 위치 이점이라 dist↓/period↑로 선형 약화됨.
2. **남은 engine-bias floor 실패는 fox가 원인 아님(증명)**: dist=12로 낮춘 뒤에도 engine-bias가 hedgehog/cat/spider **floor 미달**로 실패. **fox 블링크를 완전히 끄고(dist=0) 측정해도 동일 분포**(hedgehog 12·cat 14·spider 24 < floor 26.7, fox 41 미드팩) → 원인은 fox가 아님.
   - 진짜 원인: **다른 에이전트가 워킹트리에 동시 추가한 box-seek + holdLane(출발 직선 유지) 변경**(overtake.ts `applyOvertake` 6인자화 + RaceEngine `nearestBoxLane`). 이게 곡선 스페셜리스트(hedgehog/cat/spider) 승률을 체계적으로 깎고 직선러(dog/bear/penguin)를 띄움. 직전 hedgehog 배치(67 통과)까진 없던 회귀.
   - 미커밋 상태(마지막 커밋 4cf8a58 이후 전부 워킹트리). **그 변경은 건드리지 않음**(다른 에이전트 작업). 임의 튜닝으로 가리지 않고 balance-tuner/해당 변경 소유자에게 라우팅 필요.

---

## 🏁 9종 캐릭터 패시브 최종 요약 (전부 결정론·시드 스트림만)

| 캐릭터 | 패시브 | 메커니즘 | 적용 지점 | 튜닝 상수 | 데이터 |
|---|---|---|---|---|---|
| 🐻 곰 | 몸통 밀치기 | 접촉한 앞 동물을 바깥 레인으로 밀어냄(속도無) | `applyBearShove` (전영역, progress 확정 후) | `BEAR_SHOVE.lanePush=0.03` | — |
| 🦊 구미호 | 여우불 점멸 | periodMs마다 앞으로 dist 순간이동(노클립) | `applyFoxBlink` (advance 후, 클램프 전) | `FOX_BLINK{periodMs:7000,dist:12}` | — |
| 🐶 강아지 | 스턴 떨치기 | 갓 걸린 스턴 잔여시간 단축 | fresh-stun 루프 | `DOG_STUN_RECOVER=0.5` | — |
| 🐧 펭귄 | 막판 스퍼트 | 최종 홈스트레치 직선서 sprint6 가속 | `applyCharacterSpeedPassives` (advance 내) | `PENGUIN_SPURT.sprintCornering=0` | — |
| 🐱 고양이 | 코너 탈출 가속 | 곡선→직선 전환 후 짧게 ×(1+boost) | `applyCharacterSpeedPassives` (advance 내) | `CAT_CORNER_EXIT{boost:0.06,windowFrames:15}` | — |
| 🐵 원숭이 | 아이템 잔머리 | 픽업 아이템 상황별 리맵(shell↔fart, ⚡→⭐) | `monkeyRemapItem` (applyItemPickup) | `MONKEY_ITEM.lightningToStarChance=0.4` | — |
| 🦔 고슴도치 | 작은 표적 | 원거리 타격(바나나/거미줄/등껍질) 확률 회피 | `tryHedgehogEvade` (banana/abduct/shell) | — (params 없이 트레이트값) | `rangedEvade:0.3` |
| 👽 외계인 | AOE 면역 | 광역 스킬(roar) 무시 | roar 핸들러 트레이트 체크 | — | `aoeImmune:true` |
| 🕷️ 거미 | 벽타기 | 곡선 바깥 레인 거리손해 감소 | `laneDistanceFactor` 트레이트 | — | `outerGrip:0.3` |

### 결정론 처리 요약
- 대부분 RNG draw 0(타이머·트레이트·구간/프레임 순수 계산).
- roll이 있는 둘은 안정 라벨 서브스트림: 원숭이 `irng.fork('monkeyitem:'+pick)`(per-pickup 카운터로 픽업마다 고유), 고슴도치 `targetRng.fork('evade:'+frame)`((target,frame) 메모로 공격자 순서 무관). **메인 드로 순서 무영향 → 시드 시퀀스 불변, 골든 영향 최소.**

### 정리(헬퍼 모음)
- 속도/위치 패시브를 RaceEngine `// ─── CHARACTER PASSIVES ───` 인덱스 1블록으로 한눈에. penguin+cat은 `applyCharacterSpeedPassives` 1헬퍼로 통합. bear/fox는 전영역 위치패스, dog는 스턴루프, alien/spider는 단일소비점 트레이트 — 훅 지점이 본질적으로 달라 단일점 강제는 안 함(과한 추상화 회피, team-lead 지침).

### 밸런스 메모
- engine-bias 슬롯공정성(laps=10)이 spider 0.5·monkey 추가에서 표본부족으로 1슬롯이 floor 아래로 떨어지는 knife-edge가 있었음 → spider는 0.5→0.3, 테스트는 laps=10 N 200→300 상향(공정성 바 안 낮춤)으로 해소. 9종 모든 세기는 **작게 시작**, 정밀 튜닝은 밸런스 패스에서 balance-tuner가.
- renderer-dev 통지: 🦊 `blink` variant 신규(여우불 FX 붙일 훅). 나머지 8종은 기존 이벤트/무이벤트라 통지 불필요.
