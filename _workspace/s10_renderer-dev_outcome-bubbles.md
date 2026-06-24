# s10 renderer-dev — 스킬 결과별 말풍선/멘트 분기 (원숭이 실패 + 고양이 냥펀치/캣워크 + 외계인 mimic copy)

## 결론
요구 3건 모두 **렌더러 단독**으로 구현. `src/data/`·schema·엔진 **무수정**. typecheck 통과, 7개 프레임 육안검증 완료.

## 추가 3건째: 외계인 mimic 카피 머리 위 말풍선 "[기술명] copy!"
- `commentaryLines.ts`: `SKILL_SHORT`(거미 거미줄→'거미줄' 식 짧은 라벨 맵) + `mimicCopyBubble(copiedType)` 추가 → "바나나 copy!" / "포효 copy!" / "거미줄 copy!".
- `RaceRenderer.ts` `mimic:activate` 케이스: `e.targetId`(복사한 스킬 원소유자) → characterId → catalog.skill.type 로 copiedType 도출, 외계인 머리 위에 copy 버블 스폰.
  - ⚠️ 함정: 복사된 스킬의 activate 이벤트가 같은 프레임에 외계인(racerId) 머리 위로 **자기 e.line 버블**을 띄워 copy 버블을 덮음(이벤트 처리 순서: mimic이 먼저 → 복사스킬이 나중). 해결: copy 버블 스폰을 `scheduleFx(clock, …)`로 **이벤트 루프 직후 drainPendingFx 단계로 지연** → owner dedup에서 copy 버블이 최종 승리.
  - 하단 자막은 기존 `mimicLine`("🛸 외계인이 {owner}의 {스킬} 베꼈다") **유지**(요구대로).
- 검증 캡처(절대경로):
  - `…/__screens__/mimic-icefield.png` — 외계인 "빙판 copy!" + 하단 "외계인8 의태 발동 — 펭귄1의 펭귄 빙판 똑같이 베꼈다 ㄷㄷ" (가장 깔끔)
  - `…/__screens__/mimic-zoomies.png` — 외계인 "폭주 copy!"
  - `…/__screens__/mimic-abduct.png` — 외계인 "거미줄 copy!"(복사 abduct hit FX로 일부 가림)

## 무엇을 어디서 바꿨나

### 1) `src/renderer/fx/commentaryLines.ts` (텍스트 테이블 + 헬퍼 추가)
- 머리 위 말풍선 텍스트 풀 3종 + 하단 자막 풀 2종을 렌더러 측 상수로 추가:
  - `BANANA_FAIL` (원숭이 실패 버블), `CAT_PUNCH`/`CAT_WALK` (고양이 회피 버블)
  - `CAT_PUNCH_BAR`/`CAT_WALK_BAR` (하단 실황자막)
- export 헬퍼: `bananaFailBubble(seed)`, `catDodgeBubble(attackType, seed)`,
  `catDodgeLine(attackType, attacker, cat, seed)`.
- 갈래 규칙: `attackType === 'abduct' || 'banana'` → 냥펀치 톤, 그 외(roar/bristle…) → 캣워크 톤.

### 2) `src/renderer/RaceRenderer.ts`
- **머리 위 말풍선** (`playEvent`, 기존 `if (e.line) bubbles.spawn(...)` 직후):
  `e.variant === 'dodge'` 일 때
  - `e.type === 'banana'` → 시전자(`e.racerId`, 원숭이) 머리 위에 `bananaFailBubble` 스폰.
  - `e.targetId` 가 고양이(`charIdById.get === 'cat'`) → 고양이 머리 위에 `catDodgeBubble(e.type)` 스폰.
  `SpeechBubbleLayer.spawn` 이 owner별 dedup → 같은 프레임/직전 catwalk:activate 버블을 깔끔히 대체.
- **하단 실황자막** (commentary 계산부): dodge 이고 타겟이 고양이면 generic `eventLine` 대신
  `catDodgeLine` 으로 오버라이드(그 외 dodge·기존 banana:dodge 비-고양이 케이스는 그대로 유지 → 원숭이 실패 자막은 기존 `banana:dodge` 풀이 이미 '빗나감' 톤이라 재활용).

## 불변 규칙 준수
- 엔진/데이터/스키마 무수정 — 순수 렌더러 텍스트·선택 로직.
- 결정론·캡처 훅(simulate/showRaceAt) 불변. 회전 단위 무관(텍스트 only).
- 얼음/방구(환경효과)는 dodge 이벤트 자체가 없어 자연히 제외 — 메커닉 무수정.

## 검증 (Playwright 캡처 → Read 육안)
캡처는 `showRaceAt(F+1)` 로 잡았다. ⚠️ **함정 발견**: `RaceController.seek(N)` 은
`while(frameIndex < N)` 이라 엔진 프레임 `N-1` 까지만 렌더 → dodge 이벤트가 있는 프레임 F 를
화면에 띄우려면 `showRaceAt(F+1)` 로 호출해야 함(처음에 이걸 몰라 stale 캣워크 버블만 잡혀 헤맸음).

| 캡처 | 시드/프레임 | 머리 위 버블 | 하단 자막 | 판정 |
|---|---|---|---|---|
| `__screens__/dodge-cat-punch-banana.png` | s2 / 524 | 고양이 "그런 거 안 통해! 냥펀치!" | "고양이3 앞발 휙— 원숭이4 공격 튕겨냈다 ㅋㅋㅋ" | ✓ 바나나 회피→냥펀치 |
| `__screens__/dodge-cat-punch-abduct.png` | s3 / 842 | 고양이 "그런 거 안 통해! 냥펀치!" | "고양이3 앞발 휙— 거미7 공격 튕겨냈다 ㅋㅋㅋ" | ✓ 거미줄 회피→냥펀치 |
| `__screens__/dodge-cat-walk-bristle.png` | s11 / 968 | 고양이 "냐옹, 안 맞지롱" | "고양이3 우아하게 슉— 고슴도치6 공격 안 통한다!" | ✓ 가시 회피→캣워크 |
| `__screens__/dodge-cat-walk-roar.png` | s1 / 308 | 고양이 "냐옹, 안 맞지롱" | (동프레임 roar:hit 자막이 덮음) | ✓ 포효 회피→캣워크(버블 기준) |
| `__screens__/dodge-monkey-fail.png` | s9 / 903 | 원숭이 "으악 안 맞았어!" | "원숭이4의 바나나, 외계인8가 폴짝 회피! 헛던짐 ㅋㅋ" | ✓ 바나나 실패 버블 |

캡처 경로(절대): `/Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/__screens__/dodge-*.png`

## 정리
- 임시 probe 스크립트(`scripts/probe-dodge.ts`)·임시 spec(`tests/e2e/dodge-bubbles-tmp.spec.ts`) 삭제 완료.
- 디버그 console.log 잔존 없음. typecheck 통과.

## 참고
- roar 캡처(s1/308)는 동프레임 다중 이벤트로 FX가 고양이를 일부 가리고 하단 자막은 roar:hit(다른 피해자)이 덮음.
  → 더 깔끔한 캣워크 증거로 bristle 단독 프레임(s11/968)을 추가 캡처해 갈래 분기를 명확히 확인.
