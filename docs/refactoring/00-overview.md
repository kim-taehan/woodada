# 우다다 리팩토링 계획

> **목표**: 코드 가독성, 유지보수성, 테스트 커버리지 향상  
> **원칙**: 기능 변경 없이, 기존 동작 유지, 점진적 개선

---

## 📋 현황 분석

### 코드 크기
| 파일 | 라인 수 | 문제점 |
|------|---------|--------|
| `src/engine/RaceEngine.ts` | 1,237 줄 | 단일 파일에 모든 경주 로직 밀집 |
| `src/renderer/RaceRenderer.ts` | 2,203 줄 | 모든 시각 로직이 단일 파일 |
| `src/engine/types.ts` | 303 줄 | 모든 타입 정의가 한 파일 |
| `src/shell/RaceController.ts` | 145 줄 | 적절한 크기 |

### 테스트 커버리지 (현재)
```bash
npm run test
```
- **Vitest 단위테스트**: `tests/unit/`
- **Playwright E2E**: `tests/e2e/` (시각 검증 중심)

**현황**: 엔진 로직에 대한 상세 단위테스트 부족, 대부분 E2E 시각 검증에 의존

---

## 🎯 리팩토링 목표

### 1. 테스트 커버리지 향상
- **목표**: 핵심 엔진 로직 80%+ 단위테스트 커버리지
- **방식**: 시스템별 분리 후 각 시스템에 대한 단위테스트 작성
- **수단**: Vitest 활용, 시드 기반 결정론적 테스트

### 2. 코드 분해 및 모듈화
- **RaceEngine.ts** → 메인 루프 + 독립적인 시스템 모듈
- **RaceRenderer.ts** → 메인 루프 + 독립적인 렌더러 모듈
- **타입 정의** → 도메인별 분리

### 3. 유지보수성 개선
- **단일 책임 원칙**: 각 모듈이 한 가지 일만 수행
- **의존성 주입**: 테스트 가능한 구조
- **명확한 인터페이스**: 모듈 간 계약 명확화

---

## 📐 리팩토링 원칙

### 1. **기능 변경 금지**
- 기존 (config + seed) → 동일한 결과 보장
- 모든 리팩토링 후 기존 테스트 통과 확인
- 새로운 테스트는 기존 동작을 문서화하는 형태로 작성

### 2. **점진적 개선**
- 한 번에 모든 것을 리팩토링하지 않음
- 각 단계마다 테스트 후 검증
- 롤백 가능한 작은 변경 단위

### 3. **테스트 먼저**
- 리팩토링 전에 해당 영역의 테스트 작성/보강
- 리팩토링 후 테스트 통과 확인
- 리팩토링 중 새 기능 추가 금지

### 4. **엔진 순수성 유지**
- `src/engine/` 에는 DOM/Pixi/`Math.random()` 금지
- 모든 무작위성은 `engine/prng.ts` 의 시드 Rng 만 사용
- 결정론적 동작 보장

---

## 🗺️ 리팩토링 로드맵

### 단계 1: 테스트 인프라 강화 (1-2 일)
**목표**: 테스트 작성/실행 환경 준비

- [ ] `tests/unit/` 구조 정리
- [ ] 테스트 유틸리티 함수 추가 (시드 설정, 프레임 단위로 진행 등)
- [ ] CI/CD 파이프라인에 테스트 단계 확인
- [ ] 커버리지 리포트 설정 (`npx vitest run --coverage`)

**산출물**:
- `tests/unit/helpers.ts` - 테스트 헬퍼
- `tests/unit/fixtures.ts` - 공통 테스트 데이터
- `vitest.config.ts` - 커버리지 설정

---

### 단계 2: 타입 정의 분리 (0.5 일)
**목표**: 타입 가독성 향상

**작업**:
1. `src/engine/types.ts` 를 도메인별 파일로 분할
2. 각 파일에 명확한 주석 추가
3. `index.ts` 에서 일괄 에クスポート

**새 구조**:
```
src/engine/types/
├── index.ts           # 모든 타입 에クスポート
├── race.ts            # RaceConfig, RaceParticipant
├── racer.ts           # RacerState, RacerPhase, SkillRuntime
├── frame.ts           # EngineFrame, SkillEvent
├── result.ts          # RaceResult, ScoringResult
└── decoy.ts           # DecoyState (분신)
```

**검증**:
- `npm run typecheck` 통과
- 기존 테스트 통과

---

### 단계 3: 엔진 시스템 분리 (3-5 일)
**목표**: RaceEngine.ts 를 독립적인 시스템 모듈로 분해

#### 3.1 코어 시스템 (2 일)
**작업**:
1. `src/engine/core/Advance.ts` - 속도 계산, catch-up, 오버테이크
2. `src/engine/core/SkillSystem.ts` - 스킬 발동, 코oldown, i-frames
3. `src/engine/core/State.ts` - RacerState 관리

**검증**:
- 각 시스템에 대한 단위테스트 작성
- `simulateRace()` 결과 동일성 확인

#### 3.2 부 시스템 (2 일)
**작업**:
1. `src/engine/systems/ItemSystem.ts` - 아이템 박스
2. `src/engine/systems/IceSystem.ts` - 펭귄 얼음장
3. `src/engine/systems/DecoySystem.ts` - 구미호 분신
4. `src/engine/systems/EliminationSystem.ts` - 탈락전
5. `src/engine/systems/OvertakeSystem.ts` - 추월/블록킹

**검증**:
- 각 시스템에 대한 단위테스트 작성
- 통합 테스트 (전체 경주 시뮬레이션)

#### 3.3 메인 루프 정리 (1 일)
**작업**:
- `RaceEngine.ts` 를 간소화 (메인 루프만 남김)
- 각 시스템의 인터페이스 명확화

**새 RaceEngine.ts 구조**:
```typescript
export function createRaceEngine(config, skills, scoring) {
  // 시스템 인스턴스 생성
  const advance = createAdvanceSystem();
  const skills = createSkillSystem();
  const items = createItemSystem();
  // ...

  return {
    step() {
      // 1. 타이머 해결
      // 2. 스킬 발동
      // 3. 진행도 업데이트 (advance)
      // 4. 추월 감지 및 후킹
      // 5. 탈락 적용
      // 6. 분신 업데이트
      // 7. 아이템 업데이트
      // 8. 프레임 스냅샷
    },
    // ...
  };
}
```

**검증**:
- 기존 테스트 100% 통과
- 성능 저하 없음 (프레임 시간 비교)

---

### 단계 4: 렌더러 분리 (3-4 일)
**목표**: RaceRenderer.ts 를 독립적인 렌더러 모듈로 분해

#### 4.1 FX 시스템 분리 (1 일)
**작업**:
1. `src/renderer/fx/FxRenderer.ts` - 스킬별 FX 분기 로직
2. 각 FX 타입별 함수 분리 (`playDivebomb()`, `playBanana()`, 등)

**검증**:
- FX 렌더링 결과 동일성 (시각 테스트)

#### 4.2 렌더러 모듈 분리 (2 일)
**작업**:
1. `src/renderer/character/DecoyRenderer.ts` - 분신 렌더링
2. `src/renderer/track/IceRenderer.ts` - 얼음장 렌더링
3. `src/renderer/ui/PodiumScene.ts` - 시상대 로직
4. `src/renderer/effects/LaneIntro.ts` - 레인 인트로
5. `src/renderer/effects/FinishCoast.ts` - 결승선 이후 효과

**검증**:
- 각 모듈에 대한 시각 테스트 (Playwright 스크린샷)
- 전체 렌더링 결과 동일성

#### 4.3 메인 루프 정리 (1 일)
**작업**:
- `RaceRenderer.ts` 를 간소화 (메인 루프만 남김)
- 각 렌더러의 인터페이스 명확화

**검증**:
- 기존 E2E 테스트 100% 통과
- 스크린샷 차이 없음 (비교 도구 활용)

---

### 단계 5: 의존성 주입 및 테스트 용이성 (1-2 일)
**목표**: 테스트 가능한 구조로 개선

**작업**:
1. `RaceController` 에 의존성 주입 추가 (테스트용 팩토리)
2. `SkillRegistry`/`ScoringRegistry` 인터페이스 명확화
3. 테스트 더블 (mock/stub) 생성 유틸리티 추가

**예시**:
```typescript
// RaceController.ts
constructor(
  renderer: RaceRenderer,
  config: RaceConfig,
  arenaId?: string,
  engineFactory?: (config, skills, scoring) => RaceEngine // 테스트용 오버로드
)
```

**검증**:
- mocks 를 이용한 단위테스트 작성 가능
- 기존 동작 영향 없음

---

### 단계 6: 통합 테스트 및 문서화 (1-2 일)
**목표**: 리팩토링 완료 검증 및 문서화

**작업**:
1. 전체 테스트 스위트 실행 (단위 + E2E)
2. 커버리지 리포트 분석 (목표: 80%+)
3. 리팩토링 가이드 문서 업데이트
4. API 문서 정리

**검증**:
- `npm run test` 모든 테스트 통과
- `npm run typecheck` 통과
- `npm run build` 성공
- 커버리지 리포트 목표 달성

---

## 🧪 테스트 전략

### 1. 단위테스트 (Vitest)
**대상**: 엔진 시스템 로직

**예시**:
```typescript
// tests/unit/advance.test.ts
import { describe, it, expect } from 'vitest';
import { createAdvanceSystem } from '../../../src/engine/core/Advance';

describe('AdvanceSystem', () => {
  it('catch-up factor applies to trailer racers', () => {
    const system = createAdvanceSystem();
    const racer = { progress: 100, baseSpeed: 1.4 };
    const meanProgress = 200;
    const trackLength = 1000;
    
    const factor = system.getCatchupFactor(racer, meanProgress, trackLength);
    
    expect(factor).toBeGreaterThan(1); // 트레일러는 보너스
  });
});
```

### 2. 통합테스트 (Vitest)
**대상**: 시스템 간 상호작용

**예시**:
```typescript
// tests/unit/race-integration.test.ts
it('item pickup triggers slow effect on other racers', () => {
  const config = createTestConfig({ seed: 42 });
  const { frames } = simulateRace(config);
  
  const lightningFrame = frames.find(f =>
    f.events.some(e => e.type === 'item' && e.variant === 'lightning')
  );
  
  expect(lightningFrame).toBeDefined();
  // 다른 레이서들이 slow 상태인지 확인
});
```

### 3. 시각 검증 (Playwright)
**대상**: 렌더러 출력

**예시**:
```typescript
// tests/e2e/race-visual.spec.ts
test('skill activation shows glow and bubble', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.__woodada.showRaceAt(150, { seed: 7 });
  });
  await expect(page).toHaveScreenshot('skill-activation.png');
});
```

### 4. 결정론 테스트
**대상**: 시드 기반 재생성

**예시**:
```typescript
it('same (config, seed) produces identical frames', () => {
  const config = createTestConfig({ seed: 42 });
  
  const { frames: frames1 } = simulateRace(config);
  const { frames: frames2 } = simulateRace(config);
  
  expect(frames1).toEqual(frames2);
});
```

---

## 📊 성공 기준

| 항목 | 목표 | 측정 방법 |
|------|------|----------|
| **단위테스트 커버리지** | 80%+ | `npx vitest run --coverage` |
| **E2E 테스트** | 기존 + 리팩토링 후 동일 | Playwright 스크린샷 비교 |
| **빌드 시간** | ±10% 이내 | `time npm run build` |
| **프레임 시간** | ±5% 이내 | 벤치마크 스크립트 |
| **코드 복잡도** | 감소 | `cyclo` 또는 유사 도구 |
| **파일 크기** | 개별 파일 400 줄 이하 | `wc -l` |

---

## ⚠️ 위험 요소 및 대응

### 1. **성능 저하**
- **위험**: 모듈 분해로 인한 오버헤드
- **대응**: 벤치마크 후 최적화, 중요한 경로 인라이닝

### 2. **테스트 실패**
- **위험**: 리팩토링 중 기존 테스트 깨짐
- **대응**: 작은 단위로 변경, 각 단계마다 검증

### 3. **결정론 깨짐**
- **위험**: RNG 순서 변경으로 결과 다름
- **대응**: RNG 호출 순서 기록, 시드 기반 비교 테스트

### 4. **역할 중복**
- **위험**: 모듈 간 책임 모호
- **대응**: 명확한 인터페이스 정의, 문서화

---

## 📚 참고 자료

- [CLAUDE.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/CLAUDE.md) - 프로젝트 전반의 규칙
- [woodada-spec.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/woodada-spec.md) - 게임 스펙
- [vitest.dev](https://vitest.dev) - Vitest 문서
- [playwright.dev](https://playwright.dev) - Playwright 문서

---

## 🔄 진행 상황

| 단계 | 상태 | 시작일 | 완료일 | 비고 |
|------|------|--------|--------|------|
| 1. 테스트 인프라 | 대기 | - | - | |
| 2. 타입 분리 | 대기 | - | - | |
| 3. 엔진 시스템 분리 | 대기 | - | - | |
| 4. 렌더러 분리 | 대기 | - | - | |
| 5. 의존성 주입 | 대기 | - | - | |
| 6. 통합 테스트 | 대기 | - | - | |

---

**최종 업데이트**: 2026-06-23
