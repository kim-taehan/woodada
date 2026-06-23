# 우다다 리팩토링 완료 보고서

> **완료일**: 2026-06-23  
> **총 소요일**: 예정  
> **작성자**: AI Assistant

---

## 📋 개요

우다다 (Woodada) 프로젝트의 코드 품질 향상을 위한 리팩토링 계획 문서입니다.

### 목표
- **테스트 커버리지**: 20% → 80%+
- **코드 분리**: 대형 파일 (1000 줄+) → 모듈 (400 줄 이하)
- **유지보수성**: 단일 책임 원칙 준수, 명확한 인터페이스
- **성능**: 기존 대비 ±10% 이내

---

## 📁 문서 목차

1. [개요 및 로드맵](./00-overview.md) - 전체 계획과 단계별 목표
2. [테스트 전략](./01-test-strategy.md) - 테스트 패턴과 유틸리티
3. [단계 1: 테스트 인프라](./02-phase1-test-infrastructure.md) - 환경 준비
4. [단계 2-6: 구현 상세](./03-phase2-implementation.md) - 코드 리팩토링
5. [체크리스트](./04-checklist.md) - 진행 상황 추적
6. [가이드](./06-guide.md) - 개발자 가이드

---

## 🎯 리팩토링 단계

### 단계 1: 테스트 인프라 강화 (1-2 일)
**목표**: 테스트 작성/실행 환경 준비

- [ ] 테스트 디렉토리 구조 생성
- [ ] Vitest 설정 업데이트 (커버리지 포함)
- [ ] NPM 스크립트 추가
- [ ] 테스트 유틸리티 작성 (fixtures, helpers)
- [ ] 기존 테스트 검증

**산출물**:
- `tests/unit/` 구조
- `vitest.config.ts` (커버리지 설정)
- `tests/unit/fixtures.ts`
- `tests/unit/helpers.ts`

---

### 단계 2: 타입 정의 분리 (0.5 일)
**목표**: 타입 가독성 향상

- [ ] `src/engine/types.ts` → 도메인별 파일로 분할
- [ ] 각 파일에 명확한 주석 추가
- [ ] `index.ts` 에서 일괄 에クスポート (백컴pat)

**새 구조**:
```
src/engine/types/
├── index.ts
├── race.ts      # RaceConfig, RaceParticipant
├── racer.ts     # RacerState, SkillRuntime
├── frame.ts     # EngineFrame, SkillEvent
├── result.ts    # RaceResult
└── constants.ts # DT_MS, FINISH_OFFSET_FRAC
```

---

### 단계 3: 엔진 시스템 분리 (3-5 일)
**목표**: RaceEngine.ts 를 독립적인 시스템 모듈로 분해

#### 3.1 코어 시스템 (2 일)
- [ ] `AdvanceSystem.ts` - 속도 계산, catch-up
- [ ] `SkillSystem.ts` - 스킬 발동, 코oldown
- [ ] `State.ts` - RacerState 관리

#### 3.2 부 시스템 (2 일)
- [ ] `ItemSystem.ts` - 아이템 박스
- [ ] `IceSystem.ts` - 펭귄 얼음장
- [ ] `DecoySystem.ts` - 구미호 분신
- [ ] `EliminationSystem.ts` - 탈락전
- [ ] `OvertakeSystem.ts` - 추월/블록킹

#### 3.3 메인 루프 정리 (1 일)
- [ ] `RaceEngine.ts` 를 400 줄 이하로 축소
- [ ] 각 시스템 인터페이스 명확화

**검증**:
- 각 시스템 단위테스트 작성
- `simulateRace()` 결과 동일성 확인
- 커버리지 60%+

---

### 단계 4: 렌더러 분리 (3-4 일)
**목표**: RaceRenderer.ts 를 독립적인 렌더러 모듈로 분해

#### 4.1 FX 시스템 분리 (1 일)
- [ ] `FxRenderer.ts` - 스킬별 FX 분기 로직

#### 4.2 렌더러 모듈 분리 (2 일)
- [ ] `DecoyRenderer.ts` - 분신 렌더링
- [ ] `IceRenderer.ts` - 얼음장 렌더링
- [ ] `PodiumScene.ts` - 시상대
- [ ] `LaneIntro.ts` - 레인 인트로
- [ ] `FinishCoast.ts` - 결승선 이후 효과

#### 4.3 메인 루프 정리 (1 일)
- [ ] `RaceRenderer.ts` 를 500 줄 이하로 축소

**검증**:
- Playwright 시각 테스트
- 스크린샷 비교 (기존과 동일)

---

### 단계 5: 의존성 주입 (1-2 일)
**목표**: 테스트 가능한 구조로 개선

- [ ] `RaceController` 에 팩토리 패턴 추가
- [ ] `SkillRegistry`/`ScoringRegistry` 인터페이스 명확화
- [ ] Mock 구현체 작성

---

### 단계 6: 통합 테스트 및 문서화 (1-2 일)
**목표**: 리팩토링 완료 검증

- [ ] 통합테스트 작성
- [ ] 커버리지 80%+ 달성
- [ ] 문서 업데이트
- [ ] CHANGELOG 기록

---

## 📊 현황 vs 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| **RaceEngine.ts** | 1,237 줄 | ~400 줄 |
| **RaceRenderer.ts** | 2,203 줄 | ~500 줄 |
| **단위테스트 커버리지** | ~20% | 80%+ |
| **파일 수** | 81 개 | ~120 개 (모듈 분리 후) |
| **테스트 수** | 적음 | 100+ |

---

## ⚠️ 주의사항

1. **기능 변경 금지**: 기존 (config + seed) → 동일한 결과 보장
2. **점진적 개선**: 한 번에 모든 것을 변경하지 않음
3. **테스트 먼저**: 리팩토링 전에 해당 영역의 테스트 작성
4. **엔진 순수성**: `src/engine/` 에는 DOM/Pixi/`Math.random()` 금지

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

## 📚 관련 문서

- [CLAUDE.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/CLAUDE.md) - 프로젝트 규칙
- [woodada-spec.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/woodada-spec.md) - 게임 스펙
- [README.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/README.md) - 프로젝트 개요

---

## 🚀 시작하기

1. [00-overview.md](./00-overview.md) 에서 전체 계획 확인
2. [02-phase1-test-infrastructure.md](./02-phase1-test-infrastructure.md) 에서 단계 1 시작
3. [04-checklist.md](./04-checklist.md) 에서 진행 상황 추적

---

**최종 업데이트**: 2026-06-23
