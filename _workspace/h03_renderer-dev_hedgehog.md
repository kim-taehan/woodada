# h03 renderer-dev — 고슴도치(hedgehog) 가시 밀치기(bristle) 스킬 연출 + 시각검증

## 결과 요약
bristle 스킬 FX(가시 곤두 / 추격자 뒤로 톡 / 헛가시) + 실황 자막 추가. typecheck 통과, 단위테스트 43/43, race-visual 5/5 통과, 가시 연출 육안 확인 완료. (앞서 h03_renderer-dev_hedgehog-render.md에서 보류로 남겼던 FX 파트를 이번에 완성.)

## 이벤트 계약 (h02 engine-dev 확정 — 준수)
- type `bristle`, variant 3종: `activate`(고슴도치가 가시 곤두), `hit`(targetId=뒤에서 밀쳐진 추격자, 뒤로 밀림+감속), `dodge`(targetId=catwalk/⭐로 회피한 추격자). **self-botch 없음**.
- activate와 hit는 **같은 프레임에 함께 emit**됨(밀치기가 즉발). 추격자는 항상 고슴도치 **뒤**에 있음 → 밀침 방향은 추격자 진행반대(-dir).

## 변경 파일 (모두 src/renderer/)

### 1. fx/FxLayer.ts — 신규 FX 2개 (+ 상단 docstring 1줄)
- **`bristle(x, y, tint, now)`** — bristle:activate용. 흰 add-blend 플래시 + 삼각 quill 12개가 사방으로 튀어나감(tip이 바깥 향하게 회전). `tint`=가시색(palette `base`, 갈색).
- **`spikeShove(x, y, tint, dir, now)`** — bristle:hit용. 접촉점 임팩트 링 + quill 파편 5개(추격자 진행반대로 분사) + 뒤로 미끄러지는 먼지 퍼프. `dir`=추격자 진행부호 → -dir로 튕김.
- 기존 `whiff`(dodge), `starShield`(⭐ deflect)는 재사용.

### 2. RaceRenderer.ts — playEvent 스위치에 bristle 3케이스 + 헬퍼
- `spikeTintOf(id)` 지역 헬퍼: 가시 quill은 `v.tint`(=palette.point, 연한 베이지 얼굴색)가 아니라 **palette.base**(갈색 가시)를 써야 읽힘 → `characterCatalog[charId].palette.base` 조회(없으면 point/기본값 폴백).
- `bristle:activate` → `fx.bristle(self, spikeTint)`. (actor 글로우+pop+sparkle은 playEvent 상단에서 이미 자동.)
- `bristle:hit` → `fx.spikeShove(at, spikeTint, at.heading>=0?1:-1)`. (감속은 엔진이 처리, 시각상 처짐.)
- `bristle:dodge` → star deflect가 아니면 `fx.whiff(at)`. (⭐ shield/cat shimmer는 기존 공용 dodge 핸들러(617행)가 처리 — bristle도 그 경로 자동 적용.)

### 3. fx/commentaryLines.ts — 하단 실황 자막 3키 (까칠 개그 톤)
- `bristle:activate`: '가시 쫙! 붙지 말라잖아 ㅋㅋ' 등 3개.
- `bristle:hit`: '가시에 찔린 추격자 뒤로 톡! ㅋㅋ' 등 3개.
- `bristle:dodge`: '헛가시! 가시 사이로 쏙 빠졌다 ㅋㅋ' 등 2개.

## 시각 검증 (Playwright, 임시 캡처 후 삭제)
6인 로스터(hedgehog 포함, seed 1)로 bristle 발화 확인 후 육안:
- **activate/hit** (frame 500+3): 고슴도치 주위로 갈색·노란 삼각 quill이 사방 분사(가시 곤두), "따끔! 붙지 마!" 말풍선, 하단 자막 "고슴도치1 가시에 찔린 추격자 뒤로 톡! ㅋㅋ". 가시 곤두 포즈(spikes scale up)도 읽힘.
- **dodge** (frame 739): quill 분사 + 자막 "고슴도치1 헛가시! 가시 사이로 쏙 빠졌다 ㅋㅋ".
- 고슴도치가 **땅에서 biped로 자연스럽게 달리고**, 가시 치비 실루엣 깨짐/사라짐 없음(회전단위·파트이름 오류 징후 없음). 7인 골든(`race-mid.png` 등)에서도 정상 합류.

판정: **세 variant 모두 distinct하게 읽힘. 가시 정체성(곤두선 quill) 명확. 깨짐 없음.**

## QA 인계 (qa-verifier)
- typecheck OK, vitest 43/43 OK(2회 안정), race-visual 5/5 OK.
- 골든 스크린샷(`__screens__/`) 다수가 hedgehog 합류 + bristle FX로 갱신됨 — 의도된 변경(회귀 아님).
- 엔진 이벤트 계약 무변(렌더러 FX/코멘트만 추가). schema/skills 테스트는 이미 갱신되어 green.
- 참고: bristle FX는 `bristle:activate`와 `bristle:hit`가 동일 프레임 발화라 두 FX가 겹쳐 보일 수 있음(의도된 동작 — 즉발 카운터). 별도 IMPACT_DELAY 스케줄 안 씀.
