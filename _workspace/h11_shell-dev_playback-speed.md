# h11 shell-dev — 스킬 슬로우모션 제거 + 일정 감속 재생

## 요청
필살기마다 걸리던 슬로우모션 제거(캐릭 많아 자주 터져 뚝뚝 느려짐). 대신 전체 재생을 일정하게 살짝 느리게.

## 수정 (src/shell/RaceController.ts run() 페이싱만)
1. 상수 교체: `SLOWMO_MS`/`SLOWMO_SCALE` 삭제 → `const PLAYBACK_SPEED = 0.8;`(상단). 80% 실시간 속도, "느낌" 값이라 dev서버로 사용자 조절.
2. `slowUntil` 변수 + activate|hit|wake 이벤트 슬로우모션 트리거 삭제.
3. `const scale = ts < slowUntil ? SLOWMO_SCALE : 1; acc += realDt * scale;` → `acc += realDt * PLAYBACK_SPEED;`.
4. run() doc 주석 갱신("steady, slightly slower pace — no per-skill slow-motion").

## 제약 준수
- display-only: 엔진/결정론/밸런스 무관(재생 속도만). coast()/seek()/settle() 손대지 않음.
- 고아 정리: SLOWMO 상수·slowUntil 모두 제거, typecheck 0 에러로 확인.

## 검증
- `npm run typecheck` 통과.
- `npx vitest run` 43/43 통과(결정론 비영향).
- 시각 체감/0.8 값 조절은 사용자가 dev서버로.

## 변경 파일
- src/shell/RaceController.ts
