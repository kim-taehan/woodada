# 03 renderer-dev — 독수리(eagle) 공중→지상(점프 박치기) 렌더링 전환

## 결과 요약
독수리 `fly` 전용 렌더 코드 제거 + divebomb 모션을 '공중 급강하'에서 '폴짝 점프 박치기'로 교체. typecheck 통과, 단위테스트 43/43 통과, Playwright 시각검증 육안 확인 완료.

## 변경 파일

### 1. src/renderer/character/PartsCharacter.ts (fly 사망 코드 제거 — 외과수술)
- **호버 lift 분기 제거**: `if (style === 'fly' && ...) { lift = 26 + bob }` 블록 삭제. 독수리는 이제 biped lift(0/bob)로 흐름 → 땅에 선다.
- **wing flap 절차 애니 블록 제거**: `else if (style === 'fly') { ...wingL/wingR flap... }` 전체 삭제.
- **dejected 슬럼프의 `wingL`/`wingR` 분기 2줄 제거**: 어떤 partmodel도 더 이상 wingL/wingR 파트를 안 씀(eagle은 armL/armR). 죽은 가지.
- **skilling lean 가드 변경**: `else if (skilling && style !== 'fly')` → `else if (skilling)`. 독수리도 박치기 시 forward thrust lean을 받도록.
- **fly float-bank root.rotation 줄 제거**: `else if (style === 'fly') ...` 삭제.
- 관련 stale 주석 1곳 정정("the flyer always face the viewer" → 비행 어휘 제거).
- 확인: 파일 내 `fly`/`wingL`/`wingR`/`hover` 잔존 0 (남은 'airborne'은 cat ice-hop·rabbit hop 주석으로 무관).

### 2. src/renderer/RaceRenderer.ts (screen-space 모션: 급강하 → 점프 박치기)
- 진짜 '급강하' 모션은 여기 있었음(화면 위로 150px 솟구쳐 호버 후 급강하). 이를 **저공 점프 박치기**로 retune:
  - `DIVE_RISE 0.34→0.22`, `DIVE_HANG 0.12→0.05`, `DIVE_LIFT 150→46`(높이 솟구침→낮은 폴짝), `DIVE_POP 0.42→0.16`.
  - `diveOffset()` 로직 구조 동일(rise→hang→plunge+glide), 주석만 'soar/plunge'→'spring/drop+lunge(머리로 들이받음)'.
  - `diveTilt` 강도 `0.5→0.32`(저공 hop이라 과한 회전 줄임). root.rotation 라디안.
  - 이벤트 키(`divebomb:activate/hit/dodge`), self-botch 판별(`type==='divebomb' && variant==='hit' && targetId===racerId`), glide-onto-target 메커닉, IMPACT_DELAY 스케줄 모두 **그대로 유지**(엔진 계약 무변).
  - `fx.swoop()` 호출 좌표를 '위에서 아래(`a.y-70 → a.y`)'에서 '앞에서 표적으로(수평 lunge 방향)'로 변경.

### 3. src/renderer/fx/FxLayer.ts (FX 톤: 하강 풍압 → 박치기 충격)
- `swoop()` 재작성: 기존 '위에서 내리꽂는 💨 대각선 streak'(급강하 풍압) → **💥 임팩트 버스트 + 짧은 충격선(lunge 방향으로 flare)**. 시그니처 동일.
- `feathers()` 주석 'divebomb' → 'headbutt'.
- (stars/dizzy/dust/pop은 그대로 — 박치기 충격에도 잘 맞음.)

### 4. src/renderer/fx/commentaryLines.ts (비행 어휘 → 박치기 톤)
- `divebomb:activate`: '급강하 돌입/하늘에서 내리꽂는다/다이브' → '폴짝 점프/머리로 들이받는다/박치기 돌격'.
- `divebomb:hit`: '급강하 적중' → '박치기 적중'(나머지 유지).
- `divebomb:self`: '땅에 꽂혔다/급강하하다 자폭' → '꼴아박았다/헛박치기로 자폭'.
- `divebomb:dodge`: '헛챔/발톱 허공' → '헛박았다/머리로 허공만 들이받았다'.

### main.ts
- `fly`/eagle 특수 처리 **없음**(DEFAULT_IDS에 eagle 포함 = 캡처 등장 OK, divebombSelfFrame 훅은 type-string 기반). 수정 불필요.

## 시각 검증 (Playwright, 육안 확인)
`npx playwright test race-visual.spec.ts --project=desktop` → 5 passed. 확인한 스크린샷:
- `tests/e2e/__screens__/race-start.png` — 출발 클러스터(독수리 포함).
- `tests/e2e/__screens__/race-divebomb-rise.png` / `-apex.png` / `-impact.png` — 박치기 발동: 독수리가 저공으로 폴짝 뛰어 표적(앞주자) 위로 lunge, 💥 임팩트+별+스피드라인. 더 이상 화면 위로 높이 솟구치지 않음.
- `tests/e2e/__screens__/race-divebomb-self.png` — 자폭: dust 버스트+dizzy, 자막 "독수리5 헛박치기로 자폭! 별이 빙글빙글~".
- (추가로 임시 격리 캡처 eagle+cat 2인 로스터로 육안 확인 후 삭제) — **독수리가 땅에 선 정면 치비 biped(둥근 머리+갈색 깃털 캡+큰 눈+노란 후크 부리+크림 가슴+접은 날개+talon)로 고양이와 동일 baseline에 서서 달림. 공중에 안 떠 있음. 박치기 시 머리/몸 앞으로 들이받는 lunge 포즈가 읽힘. 깨짐/사라짐 없음(회전단위·파트이름 오류 징후 없음).**

## QA 인계 (qa-verifier)
- typecheck OK, vitest 43/43 OK.
- 골든 스크린샷(`__screens__/`)은 이번 변경으로 divebomb 관련 4컷(rise/apex/hit/impact/self)이 점프-박치기 버전으로 갱신됨 — 의도된 회귀(regression이 아니라 요구된 변경).
- 엔진 이벤트 계약/결정론 무변(렌더러+코멘트 카피만 변경). schema/skills 테스트 갱신 불필요.
