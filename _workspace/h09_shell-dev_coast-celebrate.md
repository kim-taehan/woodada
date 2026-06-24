# h09 shell-dev — coast 중 깝치기 지속 (골인 후 freeze 수정)

## 증상
골인 후 "시상식 보러가기" 버튼 대기 중 동물들이 멈춰 보임.

## 원인
`src/shell/RaceController.ts` `coast()`가 rAF마다 같은 프레임을 다시 그리되 `time`을
`last.time`으로 고정 → 렌더러가 `dt=(frame.time-lastTime)/1000`으로 clock을 누적하는데
dt=0 → clock 정지 → celebrate/dejected/스파클 애니가 얼어붙음.

## 수정 (외과수술 1줄)
`coast()`의 renderFrame 호출에서 `time`도 함께 전진:
```ts
this.renderer.renderFrame({ ...last, frame: last.frame + extra, time: last.time + extra * (1000 / 60), events: [] });
```
매 rAF마다 dt≈16.67ms → clock이 흘러 버튼 누를 때까지 애니/스파클 지속.
display-only 포스트피니시(coast는 engine 미접근) → 결정론/시뮬 무관. settle()은 손대지 않음.

## 검증
- `npm run typecheck` 통과 (EngineFrame.time 존재 확인, 0 에러).
- `npx vitest run` 43/43 통과.
- 시각 육안확인은 renderer-dev에 인계(버튼 대기 화면 캡처).

## 변경 파일
- src/shell/RaceController.ts (coast 내 renderFrame 1줄)
