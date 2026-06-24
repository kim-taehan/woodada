# h12 content-designer — 실황 자막 정보화 (대상 이름 추가)

사용자: "장난기는 유지하되 누가/누구에게/뭘 했고/결과를 알려줬으면." (예: "원숭이4가 곰6에게 바나나를 던졌지만 빗나갔다! ㅋㅋ")

## 수정 파일
- `src/renderer/fx/commentaryLines.ts` (content-designer 소유) — 시그니처 + 자막 풀 재작성.

## 새 `eventLine` 시그니처 (renderer-dev 호출부 인계)
```ts
eventLine(type: string, variant: string, name: string, seed: number, targetName?: string): string | null
```
- `{n}` → name (행위자, `event.racerId`)
- `{t}` → targetName (대상, `event.targetId`)
- **targetName 없으면 `{t}`는 '상대'로 대체** (라인 안 깨짐).
- `leadLine`/`lastLapLine` 시그니처 불변.

### renderer-dev 호출부 수정 필요 (RaceRenderer.ts:1056)
현재: `eventLine(e.type, variant, n, frame.frame + (e.targetId ? 7 : 0))`
→ 5번째 인자로 대상 이름 추가:
`eventLine(e.type, variant, n, frame.frame + (e.targetId ? 7 : 0), e.targetId ? namesById[e.targetId] : undefined)`
- selfBotch(divebomb:self, targetId===racerId)일 때는 대상 이름 안 넘겨도 됨(self 풀은 {t} 없음). 넘겨도 무해(풀에 {t} 미사용).
- namesById는 이미 RaceRenderer 스코프에 있음(1049 라인에서 n 뽑을 때 사용 중).

## 어떤 variant에 {t}를 넣었나 (engine emit targetId 기준 — `src/engine/skills/*.ts` + RaceEngine.ts 대조)
**targetId 있음 → {n}+{t} 사용:**
- banana:hit, banana:dodge
- divebomb:hit, divebomb:dodge
- bristle:hit, bristle:dodge
- roar:hit, roar:dodge  ← **신규 추가**(기존엔 roar:activate만 있었음. roar는 대상별로 hit/dodge emit하므로 {t} 라인 추가)
- item:shellhit (RaceEngine.ts:498, targetId=leader.id)

**targetId 없음 → {n}만:**
- 모든 :activate (zoomies/catwalk/divebomb/banana/roar/bristle). icefield는 원래 풀 없음(유지).
- divebomb:self (synthetic variant, 자폭 — 행위자 자신)
- catwalk:dodge (기존 dead pool — catwalk은 activate만 emit하므로 이 키로는 도달 안 함. 기존 코드라 **건드리지 않고 유지**. {t} 없음)
- item:star / lightning / fart / shell
- relay:handoff

### 주체(subject) 확인
dodge 이벤트는 **공격자**가 emit → `e.racerId`=공격자, `e.targetId`=회피한 쪽. 호출부 `n = namesById[e.racerId]`. 따라서 banana:dodge에서 {n}=던진 쪽, {t}=피한 쪽 → 사용자 예시("원숭이가 곰에게 던졌지만 빗나갔다")와 일치. hit도 동일(공격자 {n} → 피해자 {t}).

## 풀 작성 원칙
- 병맛 ㅋㅋ 톤 + 이모지 감각 유지, 자막 한 줄 길이 유지.
- 각 풀 2~3 변형(seed로 고름, 기존 pick 로직 그대로).
- {t} 다회 등장 라인 있어 `.replace(/\{n\}/g,...)`/`/\{t\}/g`로 전역 치환(기존은 첫 1회만 치환이라 변경).

## 검증
- 시각/타입체크는 renderer-dev 호출부 수정 후 일괄(시그니처 인자 1개 추가라 호출부 미수정 시 targetName=undefined로 동작은 하나 {t}→'상대'로 떨어짐). renderer-dev 통지함.
