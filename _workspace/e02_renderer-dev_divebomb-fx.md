# e02 · renderer-dev · 독수리 divebomb 성공/실패 시각 구분 강화

## 결론
divebomb 성공(명중)과 실패(자폭)를 **색·모션으로 즉시 구분**되게 연출 분기 강화 완료.
성공 = 금빛 통쾌(독수리에 골드 버스트 + "명중!"), 실패 = 회색 풀죽음(독수리에 먼지 슬럼프 + "꽝...").
typecheck 통과, e2e 시각검증 5 passed(회귀 없음). 육안 비교로 한눈에 구분 확인.

렌더러만 수정. 엔진/데이터 침범 없음(`src/engine/skills/divebomb.ts`·`src/data/characters/eagle.ts`·`tests/unit/skills.test.ts`의 변경은 같은 브랜치 engine-dev 작업, 내가 건드린 것 아님).

---

## 구현

### FxLayer.ts — 신규 FX 2개 (가볍게, blendMode add)
- **`goldBurst(x,y,now)`** = 성공 큐(독수리 위). 밝은 금빛 코어 플래시 + 굵은 골드 링 + 방사형 골드 스파크 8개(sunburst) + 위로 떠오르는 노란 **"명중!"** 굵은 태그. 따뜻/밝음 = WIN.
- **`dustSlump(x,y,now)`** = 실패 큐(독수리 위). 낮게 깔리는 **회색 먼지 퍼프**(warm `dust`보다 무겁고 칙칙) + 회색 틴트(0xb8b8c0)의 풀죽은 😵💫 소용돌이 + 흘러내리는 💧 + 아래로 처지는 회색 **"꽝..."** 태그. 차갑/무채색 = FLOP.

기존 `dust`/`dizzy`/`pop`는 그대로 둠(roar·shell·banana 공유라 회귀 위험 회피).

### RaceRenderer.ts — `divebomb:hit` 분기 교체
- **실패(`targetId === racerId`)**: 기존 `dust + pop + dizzy`(밝은 별) → **`dustSlump`** 단독(swoop 임팩트 라인은 유지). 밝은 요소 제거로 "처박힘" 강조.
- **성공(`targetId !== racerId`)**: 기존 표적 임팩트(swoop+feathers+stars+dizzy) 유지 + **독수리(actor) 위에 `goldBurst` 추가**. 누가 이겼는지(독수리)에 금빛, 맞은 쪽엔 별. diveBurst 전진 가속은 기존대로 유지.

대비 축:
- 색: 금빛(성공) vs 회색/먼지(실패)
- 모션: 전진 가속 + 사방 골드 레이(성공) vs 제자리 처박힘 + 아래로 깔리는 먼지(실패)
- dizzy는 둘 다 안 씀: 성공은 표적의 밝은 별, 실패는 회색 풀죽은 swirl로 맥락 분리

commentaryLines는 이미 성공/실패 라인이 또렷해 손대지 않음(YAGNI).

회전 단위 규칙 준수: 신규 FX는 파티클 `spin`(rad/s) + ray의 `rotation`(rad)만 사용, 캐릭터 파트 rot(도)와 무관.

## 변경 파일 (절대경로)
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/fx/FxLayer.ts
- /Users/a08368/vscodeProjects/woodada/woodada-v3/src/renderer/RaceRenderer.ts

## 시각검증 (5190 dev 재사용, 임시 인레포 config로 캡처 후 삭제 — playwright.config.ts 영구변경 없음)
스크린샷 절대경로 + 육안 소견:

- **성공** `.../tests/e2e/__screens__/race-divebomb-impact.png` 및 `.../race-divebomb-hit.png`
  독수리(actor)가 **밝은 골드 링 + 사방 골드 스파크 + "명중!"** 노란 태그에 감싸임. 표적(펭귄)엔 노란 임팩트 별. 전체 톤 따뜻/통쾌. 자막 "...직격! ...휘청 ㅋㅋ". → 한눈에 WIN.
- **실패** `.../tests/e2e/__screens__/race-divebomb-self.png`
  독수리가 **회색 먼지 구름에 처박힘 + 💧 + 풀죽은 swirl**, 밝은 별 없음. 톤 무채색/풀죽음. 자막 "...빗나가 자폭! 별이 빙글빙글~". → 한눈에 FLOP.
- 성공 vs 실패: **금빛 vs 회색**, **사방 폭발 vs 아래로 깔림**으로 즉시 구분됨 (요구 충족).

회귀 확인(육안):
- `.../race-roar-hit.png` — 곰 포효 광역 shockwave + 다수 피격 dizzy(밝은 별) 그대로. 공유 `dizzy` 미수정 → 회귀 없음.
- `.../race-divebomb-activate/rise/apex.png` — 다이브 hop/lunge 타이밍 유지, 깨짐 없음.

## 검증
- typecheck: 통과
- e2e(playwright desktop, 5190 임시 config): 5 passed (capture states / proof shots / lap banner / coast scatter / reduced-motion 회귀 없음)
- 임시 `playwright.tmp5190.config.ts` 삭제 완료.

## 비고
- 비결정적 스크린샷 churn은 main이 소스 중심 커밋으로 처리(지침대로 나는 검증만).
- 미세 겹침: 성공 샷에서 "명중!" 태그가 인접 말풍선과 살짝 겹칠 수 있으나 독수리 위 골드 버스트 자체가 명확해 가독성 OK.
