# h37 — engine-dev: spider/alien 마무리 (mimic 계약 + 테스트 + 멀티랩 게이트)

브랜치: `feat/spider-alien`. content-designer가 넘긴 red 항목 처리 + h34 멀티랩 게이트 9캐릭 대응.

## 처리한 항목

1. **mimic 엔진 계약**: 이미 구현돼 있었음(SkillContext에 `skillParamsOf` + `invokeSkill` 추가, `shared` 컨텍스트 객체로 리팩토링되어 본 컨텍스트·copiedCtx 둘 다 제공). content-designer가 본 `(267) missing skillParamsOf,invokeSkill` 에러는 그 리팩토링 *전* 스냅샷이라 이미 해소 상태였음.
   - `invokeSkill(copiedType, paramsOverride)`: 'mimic' 거부(재귀 가드) + tick 없는 reaction-only(bristle) 거부 → false. 복사 핸들러를 alien을 self로, 스캔된 params로, **alien 전용 서브스트림 `mimic:<copiedType>`** + **copiedType으로 스탬프된 emit**으로 실행. ≥1 emit이면 true(발동), 아니면 false(hold). 결정론·서브스트림 규칙 준수(스캔 대상 스트림 미오염).
2. **mimic.ts tsc 에러**: `(31,22) unused 'frame'` — 미사용 `frame` 디스트럭처 제거. (그 후 content-designer가 단일타깃/no-fallback로 단순화한 버전도 정합.)
3. **schema.test KNOWN_SKILL_TYPES**: 'abduct','mimic' 이미 포함됨(확인).
4. **skills.test 활성집합**: 'all self-activating skills activate'가 `toContain`으로 7+abduct 직접발동 타입 검사(올바름). **mimic은 자기 'activate'를 안 emit**(복사 타입으로 스탬프)하므로 활성집합에서 제외가 정상 — 주석에 명시됨. abduct는 정상 emit 확인(probe).

## h34 멀티랩 게이트 — 9캐릭 대응 (engine-bias.test.ts)

문제: 로스터 7→9(spider/alien)로 공정몫 1/7→1/9로 떨어졌는데 char floor가 **절대값**(0.07/0.05/0.04)이라 부정확.
수정: char floor를 **공정몫 상대값**으로 — `fairShare = 1/allThree.length`, floorMul 0.4/0.35/0.3(laps 1/3/10). 로스터 크기 변해도 정확. slot 검사는 이미 `expected*mul` 상대값이라 그대로(slotCeilMul 등 유지).

결과: laps 1·3 통과(이건 순수 임계 스케일 문제였음). **laps=10은 2건 여전히 실패 — 진짜 밸런스 문제(은폐 안 함):**

## ⚠️ 측정값 — 진짜 약체 (balance-tuner 필요)

9캐릭 분포(N: 1lap 600, 10lap 200, 공정몫 0.111):
```
laps=1 : dog .078 cat .177 monkey .070 eagle .130 bear .053 penguin .213 hedgehog .120 spider .095 alien .063
laps=10: dog .105 cat .195 monkey .080 eagle .100 bear .030 penguin .175 hedgehog .095 spider .165 alien .055
```
- **bear 10바퀴 0.030** < floor 0.033 → 실패. 10바퀴에서 거의 못 이김(슬롯 1건은 200판 중 1승 = 사실상 죽은 슬롯, bear로 추정).
- 보조 약체: alien 0.055, monkey 0.080(10lap). 강자: penguin 0.175~0.213, cat 0.177~0.195, spider 0.165(10lap).

→ **게이트 임계를 bear 값 밑으로 낮추지 않음**(그러면 죽은 캐릭 은폐 = 게이트 무의미). bear 멀티랩 약세는 data(bear 스탯/roar params) 문제라 **balance-tuner 영역**. 엔진 로직 정상.

## 상태

- typecheck 통과. mimic/abduct/계약/테스트픽스처 전부 정합.
- vitest 50/52 — **남은 2건은 bear@10lap 공정성(진짜 밸런스)**. balance-tuner가 bear 멀티랩 버프하면 green. 또는 팀리드가 10lap floor를 0.25×(0.028)로 낮출지 결정(권장 안 함 — N=200에서 죽은캐릭 노이즈 안).
