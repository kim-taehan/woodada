# h13 renderer-dev — 실황 자막에 대상 이름 전달 (eventLine 호출부)

## 결과
content-designer가 `commentaryLines.ts`의 `eventLine`에 `targetName?` 인자(+ `{t}` 치환, fallback '상대')를 추가함. RaceRenderer 호출부에서 대상 이름을 전달하도록 1곳 수정. typecheck 통과, 시각검증으로 시전자+대상 두 이름이 자막에 제대로 들어감 확인(치환 깨짐 없음).

## 확정된 시그니처 (content-designer)
`eventLine(type, variant, name, seed, targetName?)` — `{n}`=시전자, `{t}`=대상. `{t}`는 targetName 없으면 '상대'로 폴백. `commentaryLines.ts` 라인 풀이 hit/dodge(banana/divebomb/bristle/roar) + item:shellhit에 `{n}…{t}` 사용, self/AoE/self-botch는 `{n}`만.

## 변경 파일
### src/renderer/RaceRenderer.ts (호출부 1곳, ~1056)
```ts
const targetName = !selfBotch && e.targetId ? namesById[e.targetId] : undefined;
const line = eventLine(e.type, variant, n, frame.frame + (e.targetId ? 7 : 0), targetName);
```
- 대상 있으면 `namesById[e.targetId]` 전달.
- **self-botch(divebomb, targetId===racerId)** 는 `undefined` 전달 — 자기 이름을 {t}로 넣지 않음(해당 라인은 `{n}`만 쓰는 'self' 풀). content-designer fallback과 합치.

## 시각검증 (Playwright, 임시 캡처 후 삭제)
※ 포트 5173을 **다른 앱("아웅다웅", PID 별개)** 이 점유 중 → Playwright `reuseExistingServer:true`가 그 서버를 재사용해 `window.__woodada` undefined로 race-visual 5건 실패. 내 프로세스 아님 → 죽이지 않고, woodada를 **5199 포트로 직접 띄워** 절대 URL로 타깃해 검증. 검증 후 5199만 종료(5173은 그대로 둠).

7개 두-이름 이벤트(seed 스캔)를 캡처해 하단 자막 육안:
- **bristle:hit** → "고슴도치7한테 붙던 독수리5, 따끔 한 방에 주춤 ㅋㅋ" ✅ (n=고슴도치7, t=독수리5)
- **banana:dodge** → "원숭이4의 바나나, 곰6가 폴짝 회피! 헛던짐 ㅋㅋ" ✅
- **divebomb:dodge** → "독수리5의 박치기, 고양이3가 슥 피해 허공만 들이받았다!" ✅
- **item:shellhit** → "강아지2의 거북 등껍질에 강아지2 처박혔다 ㅋㅋㅋ" ✅ (선두가 자기 셸 먹은 케이스 = n,t 동일, 정상)
- **divebomb:self** → "독수리5 박치기 빗나가 자폭! 별이 빙글빙글~" ✅ (self-botch, `{n}`만, `{t}` 없음 — 폴백 경로 정상)

→ **모든 템플릿에서 `{n}`·`{t}`가 실제 이름으로 치환됨. `{t}`/`{n}` 플레이스홀더 노출(깨진 치환) 없음.** 시전자+대상+결과 형태로 잘 읽힘.

(주의: 한 프레임에 여러 이벤트가 겹치면 자막은 마지막 것만 표시됨 — 기존 동작, 이번 변경과 무관. banana:hit 컷은 동프레임 item:lightning 자막이 슬롯을 가져가 별도 확인 못 했으나, 같은 `{n}…{t}` 치환 로직을 쓰는 banana:dodge로 검증 완료.)

## 인계 (qa-verifier)
- typecheck OK. 호출부 1줄 + content-designer 데이터 변경. 결정론/엔진 무관(display-only 자막).
- e2e 검증 시 5173 포트 점유 이슈는 환경 문제(다른 앱) — qa는 깨끗한 포트에서 race-visual 재생성 권장. 골든 스크린샷에 두-이름 자막 반영됨(의도된 변경).
