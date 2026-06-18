# 우다다 (woodada)

귀여운 동물들이 원형 트랙을 달려 순위를 정하는 **동물 경주 추첨 게임**. 사다리 게임처럼
"이름 넣고 → 출발 → 결과 본다"가 3초 안에 끝난다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

## 검증

```bash
npm run typecheck  # tsc --noEmit
npm run test       # Vitest 엔진 단위테스트 (결정론·편향없음·추월·스킬·스코어링)
npm run e2e        # Playwright 시각 검증 (셸 레이아웃 + 경주 화면 스크린샷)
npm run build      # 프로덕션 번들
```

> `npm run e2e`는 시스템 Chrome(`channel: 'chrome'`)을 사용한다. 캡처 결과는
> `tests/e2e/__screens__/`에 저장된다.

## 구조 (계약 우선 — 스펙 §12)

```
src/
  engine/      순수 시뮬레이션. DOM/Pixi 의존 0. 입력=(설정+시드) → 출력=프레임/순위
    prng.ts        시드 PRNG (모든 무작위성은 여기서만, fork로 스킬별 격리)
    RaceEngine.ts  고정 dt 시뮬, 결정론 보장
    overtake.ts    L1 추월/블로킹 (물리엔진 없이 규칙+PRNG)
    skills/        type→handler 레지스트리 (zoomies·nap·banana)
    scoring/       순위→결과 전략 (individual·teamRankSum·teamAce)
  data/        데이터 주도 콘텐츠 (캐릭터·모드·파츠 지오메트리)
  renderer/    PixiJS. EngineFrame을 그리기만. 시뮬레이션에 피드백 없음
  transport/   RoomTransport 추상화 (v1: LocalTransport)
  shell/       DOM UI: setup → countdown → race → result
```

엔진은 `progress`(전후) + `lane`(0=인코스~1=아웃코스, 연속값)만 다루고, 렌더러가
이를 타원 트랙 좌표로 매핑한다. 트랙 모양은 시뮬레이션에 영향을 주지 않는다.

## 확장 (스펙 §11)

- **새 캐릭터**: `src/data/characters/`에 데이터 추가 (기존 스킬 재사용 시 데이터만,
  새 스킬이면 `src/engine/skills/`에 핸들러 1개 + 등록). 파츠 비주얼은
  `src/data/partmodels/`에 지오메트리 추가.
- **팀전**: `gameModes`에 정의됨, 스코어링 전략 구현됨 (UI는 확장 단계).
- **멀티플레이어**: `RoomTransport`를 `WebSocketTransport`로 교체.
