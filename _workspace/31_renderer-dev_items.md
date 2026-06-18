# 31 · renderer-dev · 새 아이템 4종 연출 (번개·방귀·등껍질·별)

기존 `item:boost`/`item:slip` 제거, 엔진의 새 아이템 이벤트 5종 + 별-디플렉트 dodge 분기 추가.
모두 순수 시각·결정론 보존. 비대상 렌더(트랙·조끼·릴레이·TOP3·기존 스킬) 회귀 없음.

## 변경 파일
- `src/renderer/fx/FxLayer.ts` — FX 추가: `lightning`, `fart`, `shellThrow`, `starBurst`, `starGlint`, `starShield`.
- `src/renderer/fx/commentaryLines.ts` — `item:boost`/`item:slip` 제거, `item:star`/`item:lightning`/`item:fart`/`item:shell`/`item:shellhit` 병맛 라인 추가.
- `src/renderer/RaceRenderer.ts`:
  - `playEvent`: `item:boost`/`item:slip` 케이스 제거 → 5개 케이스 추가.
  - dodge 분기: `targetStarred`(targetId의 `skill.starUntil > frame`)면 `starShield`, 아니면 기존 고양이 캣워크 whiff/sparkle.
  - `renderFrame`: 매 프레임 `starUntilById` 갱신 + `curFrameIdx` 설정(playEvent의 디플렉트 판정용). 별 무적 윈도우가 살아있는 레이서는 글로우 강제 ON + `starGlint` 셔머(throttle, 결정론적).

## 5개 이벤트 + dodge 연출 방식
- **item:star** — `fx.starBurst`(무지개 링 5겹 add 블렌드 + ⭐/✨ 샤워). 지속 무적은 글로우 강제 ON(스케일 1.18배) + 매 프레임 `starGlint` 궤도 반짝. "지금 무적"이 계속 보임.
- **item:lightning** — `fx.lightning`(캔버스 전체 흰 플래시 add + 먹은 사람 위로 지그재그 노란 볼트 + ⚡ 스파크). 감속은 엔진이 처리, 시각적으로 뒤처짐.
- **item:fart** — `fx.fart`(진행 반대방향으로 퍼지는 연두 구름 6개 + 💨 글리프 4개, grow로 팽창). 먹은 사람 뒤 가스.
- **item:shell** — `fx.shellThrow`(🐢 앞쪽 호 발사).
- **item:shellhit** — `fx.shellThrow`(eater→target 호) + `fx.stars` + `fx.dizzy`(곰 포효/이글 피격과 동일한 스턴 read). targetId가 1등; 1등이 자기 등껍질 까면 targetId===racerId라 자기 위치에 적중(엔진 보장).
- **별-디플렉트 dodge** — `banana:dodge`/`divebomb:dodge`/`roar:dodge`(switch 무케이스→tail)에서 `targetStarred`면 `fx.starShield`(노란 링 + ⭐ 플래시) + 글로우 1.0s 연장. 아니면 기존 고양이 캣워크(whiff/sparkle). 별은 아무 캐릭터나 가능 — `charIdById`에 의존하지 않고 `starUntil`로만 판정.

## 시각 검증 (Read로 육안 확인 — seed 1, laps 3)
스크린샷 `tests/e2e/__screens__/`:
- `item-item-star.png` / `item-star-burst.png` — 강아지에 무지개 링 + ⭐샤워 + 앰버 글로우, "무적! ⭐" 말풍선, "지금은 못 막아! 반짝반짝 무적이다!" 자막. **무적 순간이 크게 읽힘.**
- `item-item-lightning.png` — 트랙 전체가 흰 플래시로 밝아지고 강아지 위로 노란 지그재그 볼트 + ⚡, "⚡ 번개!" 말풍선, "전원 처진다!" 자막. **화면 번쩍 확실.**
- `item-item-fart.png` — 강아지 뒤(진행 반대편)로 연두 💨 가스 구름, "뿌웅~ 💨" 말풍선, "방귀 한 방에 추격조 멈췄다!" 자막. **뒤 구름 명확.**
- `item-item-shell.png` / `item-item-shellhit.png` — 강아지가 1등이라 자기 등껍질에 봉크(엣지케이스), 🐢 호 + 골든 별버스트 + dizzy, "거북 등껍질로 선두 스턴! 별이 빙글빙글~" 자막. **1등 봉크 read OK.**
- `item-star-deflect.png` (frame 1649) — 강아지가 별 무적 셔머 글로우 유지 중, 던져진 🍌가 빗나가 인필드로 날아감(no-sell). 강아지에 whiff/dizzy 없음 → **별 디플렉트 분기 정상 동작 확인.**

별-디플렉트 좌표는 엔진 직접 프로브(vite-node)로 (seed1, frame1648 banana→p1 starUntil>frame) 찾아 캡처. 위장 없음.

## 게이트
- `npm run typecheck` ✅
- `npm run test` ✅ 42 passed
- `npx playwright test race-visual.spec.ts --project=desktop` ✅ 4 passed (회귀 없음)
- 임시 캡처 스펙(item-capture/star-deflect) 삭제 완료. 기존 골든 스크린샷 영향 없음.
