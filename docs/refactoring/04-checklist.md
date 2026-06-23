# 리팩토링 체크리스트

> 각 단계별 진행 상황 추적  
> **사용법**: 작업 완료 시 체크박스 표시

---

## 📋 단계 1: 테스트 인프라 강화

### 1.1 테스트 구조
- [ ] `tests/unit/engine/core/` 디렉토리 생성
- [ ] `tests/unit/engine/systems/` 디렉토리 생성
- [ ] `tests/unit/engine/skills/` 디렉토리 생성
- [ ] `tests/unit/data/` 디렉토리 생성
- [ ] `tests/unit/fixtures.ts` 작성
- [ ] `tests/unit/helpers.ts` 작성
- [ ] `tests/unit/setup.ts` 작성

### 1.2 설정
- [ ] `vitest.config.ts` 에 커버리지 설정 추가
- [ ] `package.json` 에 테스트 스크립트 추가
  - [ ] `test:coverage`
  - [ ] `test:watch`
  - [ ] `test:unit`
  - [ ] `test:e2e`
- [ ] `.gitignore` 에 `coverage/` 추가

### 1.3 검증
- [ ] `npm run test` 실행하여 기존 테스트 통과 확인
- [ ] `npm run test:coverage` 실행 가능 확인
- [ ] `coverage/index.html` 리포트 확인
- [ ] `npm run e2e` 실행하여 시각 테스트 통과 확인

### 1.4 문서
- [ ] `README.md` 에 테스트 실행 방법 추가
- [ ] `CONTRIBUTING.md` 에 테스트 작성 가이드 추가

**완료일**: ______  
**비고**: ____________________

---

## 📋 단계 2: 타입 정의 분리

### 2.1 파일 생성
- [ ] `src/engine/types/race.ts` 생성
- [ ] `src/engine/types/racer.ts` 생성
- [ ] `src/engine/types/frame.ts` 생성
- [ ] `src/engine/types/result.ts` 생성
- [ ] `src/engine/types/special.ts` 생성
- [ ] `src/engine/types/constants.ts` 생성
- [ ] `src/engine/types/index.ts` 생성 (재에クス포트)

### 2.2 타입 이동
- [ ] `RaceConfig`, `RaceParticipant` → `race.ts`
- [ ] `RacerState`, `SkillRuntime`, `RacerPhase` → `racer.ts`
- [ ] `EngineFrame`, `SkillEvent`, `ItemBoxState` → `frame.ts`
- [ ] `RaceResult`, `ScoringResult` → `result.ts`
- [ ] `DecoyState`, `IceZoneState` → `special.ts`
- [ ] `DT_MS`, `FINISH_OFFSET_FRAC` → `constants.ts`

### 2.3 업데이트
- [ ] `src/engine/types.ts` 를 `index.ts` 로 변경 (재에クス포트만)
- [ ] `src/engine/*.ts` 파일들의 import 경로 업데이트
- [ ] `src/renderer/*.ts` 파일들의 import 경로 업데이트
- [ ] `src/shell/*.ts` 파일들의 import 경로 업데이트
- [ ] `tests/**/*.ts` 파일들의 import 경로 업데이트

### 2.4 검증
- [ ] `npm run typecheck` 통과
- [ ] `npm run test` 모든 테스트 통과
- [ ] `npm run build` 성공

**완료일**: ______  
**비고**: ____________________

---

## 📋 단계 3: 엔진 시스템 분리

### 3.1 코어 시스템
- [ ] `src/engine/core/` 디렉토리 생성
- [ ] `AdvanceSystem.ts` 생성 (150 줄 이하)
  - [ ] `getSpeed()` 함수 분리
  - [ ] `getCatchupFactor()` 함수 분리
  - [ ] `advance()` 함수 분리
  - [ ] 단위테스트 작성 (`tests/unit/engine/core/advance-system.test.ts`)
- [ ] `SkillSystem.ts` 생성 (200 줄 이하)
  - [ ] `fireSkill()` 함수 분리
  - [ ] `buildSkillContext()` 함수 분리
  - [ ] 단위테스트 작성 (`tests/unit/engine/core/skill-system.test.ts`)
- [ ] `State.ts` 생성 (100 줄 이하)
  - [ ] RacerState 관리 로직 분리
  - [ ] 단위테스트 작성

### 3.2 부 시스템
- [ ] `src/engine/systems/` 디렉토리 생성
- [ ] `ItemSystem.ts` 생성 (200 줄 이하)
  - [ ] `createItemSystem()` 함수
  - [ ] `updateBoxes()` 함수
  - [ ] `applyItemPickup()` 함수
  - [ ] 단위테스트 작성
- [ ] `IceSystem.ts` 생성 (100 줄 이하)
  - [ ] `createIceSystem()` 함수
  - [ ] `updateIce()` 함수
  - [ ] `applyIce()` 함수
  - [ ] 단위테스트 작성
- [ ] `DecoySystem.ts` 생성 (150 줄 이하)
  - [ ] `createDecoySystem()` 함수
  - [ ] `updateDecoys()` 함수
  - [ ] `applyDecoyCollision()` 함수
  - [ ] 단위테스트 작성
- [ ] `EliminationSystem.ts` 생성 (100 줄 이하)
  - [ ] `createEliminationSystem()` 함수
  - [ ] `applyEliminations()` 함수
  - [ ] `assignEliminationRanks()` 함수
  - [ ] 단위테스트 작성
- [ ] `OvertakeSystem.ts` 생성 (150 줄 이하)
  - [ ] `applyOvertake()` 로직 분리 (기존 `overtake.ts` 에서)
  - [ ] 단위테스트 작성

### 3.3 메인 루프 정리
- [ ] `RaceEngine.ts` 를 400 줄 이하로 축소
  - [ ] 시스템 인스턴스 생성만 남김
  - [ ] `step()` 메서드 간소화 (호출만)
  - [ ] `snapshot()` 함수 유지
  - [ ] `buildResult()` 함수 유지
- [ ] `simulateRace()` 함수 유지 (백컴pat)

### 3.4 검증
- [ ] 각 시스템에 대한 단위테스트 작성 완료
- [ ] `npm run test` 모든 테스트 통과
- [ ] 커버리지 60%+ 달성
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 성공
- [ ] 벤치마크 실행 (성과 비교)

**완료일**: ______  
**비고**: ____________________

---

## 📋 단계 4: 렌더러 분리

### 4.1 FX 시스템
- [ ] `src/renderer/fx/FxRenderer.ts` 생성 (200 줄 이하)
  - [ ] `playDivebomb()` 함수
  - [ ] `playBanana()` 함수
  - [ ] `playRoar()` 함수
  - [ ] `playBristle()` 함수
  - [ ] `playAbduct()` 함수
  - [ ] `playMimic()` 함수
  - [ ] `playIllusionClone()` 함수
  - [ ] `playItem()` 함수
  - [ ] 단위테스트 (시각 검증)
- [ ] `RaceRenderer.ts` 에서 FX 로직 제거

### 4.2 렌더러 모듈
- [ ] `src/renderer/character/DecoyRenderer.ts` 생성 (100 줄 이하)
  - [ ] `drawDecoys()` 함수 분리
  - [ ] 단위테스트 (시각 검증)
- [ ] `src/renderer/track/IceRenderer.ts` 생성 (100 줄 이하)
  - [ ] `drawIce()` 함수 분리
  - [ ] 단위테스트 (시각 검증)
- [ ] `src/renderer/ui/PodiumScene.ts` 생성 (150 줄 이하)
  - [ ] `createPodium()` 함수
  - [ ] `updatePodium()` 함수
  - [ ] 단위테스트 (시각 검증)
- [ ] `src/renderer/effects/LaneIntro.ts` 생성 (100 줄 이하)
  - [ ] `playLaneIntro()` 함수
  - [ ] `skipLaneIntro()` 함수
  - [ ] 단위테스트 (시각 검증)
- [ ] `src/renderer/effects/FinishCoast.ts` 생성 (100 줄 이하)
  - [ ] `placeFinished()` 함수
  - [ ] `scatterRacers()` 함수
  - [ ] 단위테스트 (시각 검증)

### 4.3 메인 루프 정리
- [ ] `RaceRenderer.ts` 를 500 줄 이하로 축소
  - [ ] 시스템 인스턴스 생성만 남김
  - [ ] `renderFrame()` 메서드 간소화 (호출만)
  - [ ] `buildScene()` 메서드 간소화
  - [ ] `showResult()` 메서드 간소화

### 4.4 검증
- [ ] 각 모듈에 대한 시각 테스트 작성
- [ ] `npm run e2e` 모든 테스트 통과
- [ ] 스크린샷 비교 (기존과 동일)
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 성공

**완료일**: ______  
**비고**: ____________________

---

## 📋 단계 5: 의존성 주입

### 5.1 RaceController
- [ ] 생성자에 팩토리 패턴 추가
  ```typescript
  constructor(
    renderer: RaceRenderer,
    config: RaceConfig,
    arenaId?: string,
    engineFactory?: (config, skills, scoring) => RaceEngine
  )
  ```
- [ ] 테스트용 mock engine 지원
- [ ] 단위테스트 작성

### 5.2 SkillRegistry
- [ ] 인터페이스 명확화
  ```typescript
  interface SkillRegistry {
    register(type: string, handler: SkillHandler): void;
    get(type: string): (ctx: SkillContext) => void;
    getReaction(type: string): (ctx: SkillContext & { passer: RacerState }) => void;
  }
  ```
- [ ] Mock 구현체 작성 (`tests/utils/mock-skill-registry.ts`)

### 5.3 ScoringRegistry
- [ ] 인터페이스 명확화
- [ ] Mock 구현체 작성

### 5.4 테스트 유틸리티
- [ ] `tests/utils/mock-engine.ts` 작성
- [ ] `tests/utils/mock-renderer.ts` 작성
- [ ] `tests/utils/create-test-context.ts` 작성

### 5.5 검증
- [ ] 의존성 주입을 이용한 단위테스트 작성 가능
- [ ] `npm run test` 모든 테스트 통과
- [ ] 기존 동작 영향 없음 확인

**완료일**: ______  
**비고**: ____________________

---

## 📋 단계 6: 통합 테스트 및 문서화

### 6.1 통합 테스트
- [ ] `tests/unit/engine/integration/` 디렉토리 생성
- [ ] `overtake-and-skills.test.ts` 작성
- [ ] `item-and-ice.test.ts` 작성
- [ ] `relay-scoring.test.ts` 작성
- [ ] `elimination-determinism.test.ts` 작성

### 6.2 커버리지 향상
- [ ] 커버리지 리포트 분석
- [ ] 커버리지 낮은 영역 식별
- [ ] 추가 테스트 작성
- [ ] 목표 80%+ 달성

### 6.3 성능 벤치마크
- [ ] `tests/benchmarks/engine-benchmark.ts` 작성
- [ ] `tests/benchmarks/renderer-benchmark.ts` 작성
- [ ]基准 데이터 수집
- [ ] 리팩토링 후 성능 비교

### 6.4 문서
- [ ] `README.md` 업데이트
  - [ ] 프로젝트 구조 설명
  - [ ] 테스트 실행 방법
  - [ ] 리팩토링 완료 안내
- [ ] `docs/architecture.md` 작성
  - [ ] 모듈 간 관계도
  - [ ] 데이터 흐름
  - [ ] 인터페이스 정의
- [ ] API 문서 정리
- [ ] CHANGELOG.md 에 리팩토링 내용 기록

### 6.5 최종 검증
- [ ] `npm run test` 모든 테스트 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 성공
- [ ] `npm run e2e` 모든 시각 테스트 통과
- [ ] 커버리지 80%+ 달성
- [ ] 성능 저하 없음 확인 (±10% 이내)
- [ ] 기존 기능 모두 정상 작동

**완료일**: ______  
**비고**: ____________________

---

## 📊 전체 진행 상황

| 단계 | 상태 | 시작일 | 완료일 | 소요일 |
|------|------|--------|--------|--------|
| 1. 테스트 인프라 | 대기 | - | - | - |
| 2. 타입 분리 | 대기 | - | - | - |
| 3. 엔진 시스템 분리 | 대기 | - | - | - |
| 4. 렌더러 분리 | 대기 | - | - | - |
| 5. 의존성 주입 | 대기 | - | - | - |
| 6. 통합 테스트 | 대기 | - | - | - |

**총 소요일**: ______ 일  
**예상 완료일**: ______

---

## 📝 변경 이력

| 날짜 | 변경 내용 | 작성자 | 비고 |
|------|----------|--------|------|
| 2026-06-23 | 초기 작성 | - | |

---

**최종 업데이트**: 2026-06-23
