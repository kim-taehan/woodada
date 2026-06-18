# 16 · renderer-dev · 신규 캐스트 (고양이·독수리) 렌더/연출

content-designer(14) 데이터·파츠 위에 'fly' runStyle + 신 스킬 FX/실황자막을 얹고, nap/brace 렌더 고아를 정리했다. typecheck PASS. 골든 스크린샷 3장 육안 검증 완료.

## 변경 파일
- `src/renderer/character/PartsCharacter.ts` — **'fly' runStyle 추가** (호버+bob+날개짓). 기존 biped/gallop/scamper/hop 분기는 그대로, fly 분기만 신설.
- `src/renderer/RaceRenderer.ts` — catwalk/snatch 이벤트 case + 고양이 면역 dodge 반짝, glow 지속(brace→catwalk), `charIdById` 맵 추가. nap/brace case 제거.
- `src/renderer/fx/FxLayer.ts` — `feathers`(깃털 흩날림)·`swoop`(급강하 스트릭) 추가. `zzz` 제거(내 변경이 만든 고아).
- `src/renderer/fx/commentaryLines.ts` — catwalk:activate/dodge·snatch:activate/hit/dodge 라인 추가, nap/brace 라인 제거.

## 1. 'fly' runStyle 구현 방식
독수리는 땅을 딛지 않는 호버형이라 다리 스텝 사이클을 쓰지 않는다.
- **호버 오프셋 + bob**: `style==='fly'`일 때 `inner.y` 리프트를 `26 + sin(clock*3.4)*6`로 상시 적용(idle/blocked 포함, moving 게이트 없음) → 라인보다 살짝 떠서 위아래로 부드럽게 까딱. bob은 cycle clock `t`가 아니라 **실시간 `o.clock`** 기반이라 속도와 무관하게 일정.
- **날개짓**: `wingL`/`wingR`(어깨 피벗)에 `rot += ∓sin(t*0.5)*30*(0.6+amp*0.4)` — **rot은 도(degree)** 라 ±~22~30° 스윙(다리 스윙처럼 수십 도). 음수=왼쪽 들림/양수=오른쪽 들림(파츠모델 규약 일치). 날개에 `dy -= |flap|*3`로 깃 끝이 살짝 위로.
- 다리(`legL/legR`)는 접힌 채 `±4°`만 흔들(스텝 없음). `body`는 `t*0.5`로 미세 호흡 스케일, `head`는 호버에 동기화한 작은 끄덕.
- **root.rotation(라디안)**: fly는 `dir*0.04 + sin(clock*3.4)*0.03` — 거의 수평, bob에 맞춰 미세 뱅크. (회전 단위 함정 주의: 파트 rot=degree, root.rotation=radian — 분리 처리함.)
- 곡선/직선 무관: 호버·날개짓은 트랙 좌표와 독립(heading만 좌우 facing에 사용). 곡선에서도 자연스럽게 떠다님(스크린샷 confirm).
- reducedMotion: style이 'biped'로 폴백되며 fly-리프트가 0 → 라인에 정지(파티클 없는 정적 표현). 회귀 없음.

## 2. 신 스킬 FX + 실황자막 (이벤트는 `${type}:${variant}` 디스패치)
engine-dev catwalk.ts/snatch.ts 확인: catwalk→`activate`, snatch→`activate`/`hit`/`dodge` 그대로 매칭.
- **catwalk:activate** — `fx.sparkle`(머리 위 ✨ 반짝) + `fx.speedLines`(매끄러운 슬립 잔상) + 사용자 글로우 1.6s(면역창 길이). 자막 "도도하게 미끄러진다 ㅋㅋ" 류.
- **catwalk dodge(면역 무시)** — 엔진은 별도 `catwalk:dodge`를 내지 않고 `<attacker>:dodge`(targetId=고양이, line 없음)로 surface함. 그래서 렌더러에서 **targetId의 캐릭터가 'cat'이면** 그 고양이에 `sparkle`+짧은 glow(0.8s)를 띄움(engine-pure·결정론). "냐옹" 반짝 확인됨.
- **snatch:activate** — `fx.swoop`(독수리 위 60px에서 표적 방향 급강하 스트릭) + speedLines + skill 포즈(날개 위로 젖힘).
- **snatch:hit** — 표적(targetId)에 `fx.feathers`(🪶 흩날림) + `fx.stars`(★ 별 튐). 표적이 뒤로 끌려가는 느낌은 엔진의 progress drop으로 위치가 실제로 뒤로 가며 표현(렌더러는 매 프레임 progress만 읽음). 자막 "공중납치 성공! 깃털 흩날린다!".
- **snatch:dodge** — 표적 위 `fx.whiff`(휙~) 헛챔 개그.

> 비고: 헤드리스 Chrome에서 🪶 이모지 글리프가 약하게 보일 수 있음(별 ★은 또렷). hit 가독성은 stars+자막+랭크 스왑으로 충분히 확보됨.

## 3. 고아 정리
- playEvent: `nap:activate`(zzz)·`nap:wake`(zoomies와 공유)·`brace:activate` case 제거. zoomies:activate 단독 유지.
- glow 지속 분기 `e.type==='brace'` → `e.type==='catwalk'`.
- commentaryLines: nap:activate/nap:wake/brace:activate 라인 제거, 신 스킬 라인 추가.
- `FxLayer.zzz` 제거(나의 nap case 제거로 유일 호출자가 사라진 고아). doc 코멘트 갱신.

## 시각 검증 (Playwright desktop, window.__woodada 훅으로 캡처 → Read 육안)
골든 3장: `tests/e2e/__screens__/newcast/`
- **golden-eagle-fly.png** (독수리+강아지, 격리): 독수리가 라인 위로 떠 날개 펼친 호버 — 크림 머리·갈색 캡·큰 눈·후크 부리, 베이비 스키마 OK. 별도 mid/late 캡처(검증 후 삭제)에서 날개 **3가지 위치**(펼침/하향 스트로크/스킬 상향 젖힘) 확인 → 날개짓 작동.
- **golden-cat-catwalk.png** (고양이+곰): 고양이 치비(둥근 회색 타비, 삼각귀+핑크 내부, 수염, 도도한 반쯤 감은 눈) — 매우 귀여움. catwalk 발동 시 **글로우 헤일로 + ✨★ 잔상 트레일** + 자막. 요청한 "사뿐 회피(잔상/반짝)" 충족.
- **golden-snatch-hit.png** (독수리+강아지+원숭이): 독수리가 "쫙! 낚아챈다!" + 표적(원숭이)에 ★ 별 버스트, 랭크 스트립이 스왑(독수리↑), 자막 "공중납치 성공! 깃털 흩날린다!".
- (검증용 throwaway 스펙 newcast-*.spec.ts 및 잉여 PNG는 정리 완료. roar:dodge 캡처에서 두 고양이가 동시에 캣워크 반짝하며 곰 포효 무효화하는 면역 dodge도 확인.)

## 회귀
- 인원수 auto-scale/조끼/릴레이: fly는 분기만 추가, 공유 좌표·scale·waiting 큐 경로 그대로. 6인 seed 7 풀필드 캡처에서 정상.
- typecheck PASS.

## 인계
- **engine-dev**: catwalk dodge 연출은 (B) 렌더러측 cat 감지로 가동 중. 만약 (A) 전용 `catwalk:dodge` 이벤트를 emit하면 commentaryLines에 `catwalk:dodge` 풀이 이미 있으니 자막이 고양이 시점으로 깔끔히 붙음(현재는 공격자 dodge 라인이 자막을 가져감). 선택사항.
- **qa-verifier**: 골든 경로 위 3장. e2e race-visual.spec.ts:26/40 의 nap/brace 이벤트 키 → catwalk/snatch 갱신은 (인계대로) qa 영역.
- **언급(삭제 안 함, 무관 고아)**: `hop` runStyle(PartsCharacter)·`napping` phase 코드는 토끼 제거로 현재 미사용이나, 사전 존재 코드+엔진 영역이라 손대지 않음.
