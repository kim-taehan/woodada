# h31 renderer-dev — 기절 지속 dizzy 연출 (readability)

## 결과
기절(stunned) 레이서 머리 위에 dizzy 별이 **기절 지속 내내** 돌도록 추가. 기존엔 피격 순간 1회(fx.dizzy ttl 0.9s)만 터져 기절 중이 안 읽혔음. typecheck 통과, 단위 44/44, Playwright(5191) 육안 확인.

## 변경
### src/renderer/fx/FxLayer.ts — `dizzyGlint(x,y,now)` 신설
starGlint 패턴을 본뜬 **경량** 헬퍼: 💫/⭐ 1개가 머리 위를 tight 궤도로 돌며 spin(ttl 0.5s, 살짝 떠오름). 매 프레임 호출(caller throttle) 전제. 기존 `dizzy`(6개 풀버스트)는 피격 순간 임팩트용으로 그대로 유지.

### src/renderer/RaceRenderer.ts — renderFrame 레이서 루프 (별 샤이머 블록 옆)
```
if (r.phase === 'stunned' && !reducedMotion && Math.sin(clock * 14) > 0.3) {
  fx.dizzyGlint(tp.x, tp.y - lift, clock);
}
```
- ⭐ star shimmer throttle 패턴 재사용(Math.sin 게이트 → 결정적-ish, sparse).
- **`!reducedMotion` 게이트**: reduced-motion은 입자 없이 포즈만.
- 위치: 레이서 화면좌표 tp.x, tp.y-lift(머리 오프셋은 dizzyGlint 내부 -34).
- 피격 순간 playEvent의 fx.dizzy는 그대로 — 지속 글린트와 겹쳐도 자연스러움.
- fall 포즈+0.7 기울임 기존 유지(추가 wobble은 과해서 안 넣음).

display-only(엔진 무관), 타 연출/캐릭터 무영향, rot 미사용(단위 함정 없음).

## 시각검증 (Playwright 5191, banana:hit seed1 @226, 임시 캡처 후 삭제)
- **t12/t24/t36** (피격 후 mid~late 스턴 윈도우): 기절 레이서 머리 위 💫/⭐가 계속 돎 — 기절 중 내내 읽힘. ✅
- **reduced-motion(t20)**: dizzy 입자 0 — 게이트 정상. ✅
- 너무 빽빽하지 않게 sparse, 깨짐 없음. divebomb/banana/roar 모든 stun에 적용(phase 기반).

## 인계 (qa-verifier)
- typecheck OK / vitest 44/44 OK.
- 골든: 기절 프레임에 지속 dizzy 추가됨 → 갱신 필요(의도된 회귀). race-visual 골든 재생성은 여전히 포트 5173 타프로젝트 점유 환경이슈로 블록(내 변경 무관) — 깨끗한 포트 필요.
