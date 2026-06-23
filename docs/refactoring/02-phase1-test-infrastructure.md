# 단계 1: 테스트 인프라 강화

> **목표**: 테스트 작성/실행 환경을 준비하고, 기존 테스트를 검증한다  
> **기간**: 1-2 일  
> **성공 기준**: `npm run test -- --coverage` 실행 가능, 커버리지 리포트 확인

---

## ✅ 완료 체크리스트

### 1.1 테스트 구조 정리
- [ ] `tests/unit/` 디렉토리 구조 생성
- [ ] `tests/e2e/` 디렉토리 구조 확인
- [ ] 테스트 파일 네이밍 규칙 정의 (`*.test.ts`, `*.spec.ts`)

### 1.2 테스트 유틸리티 추가
- [ ] `tests/unit/fixtures.ts` - 공통 테스트 데이터 생성 함수
- [ ] `tests/unit/helpers.ts` - 테스트 헬퍼 함수
- [ ] `tests/unit/setup.ts` - 테스트 설정 (전역 setup)

### 1.3 Vitest 설정 강화
- [ ] `vitest.config.ts` 에 커버리지 설정 추가
- [ ] 테스트 커버리지 임계값 정의
- [ ] HTML 리포트 출력 설정

### 1.4 NPM 스크립트 추가
- [ ] `npm run test:coverage` - 커버리지 리포트 생성
- [ ] `npm run test:watch` -Watcher 모드
- [ ] `npm run test:unit` - 단위테스트만 실행
- [ ] `npm run test:e2e` - E2E 테스트만 실행

### 1.5 기존 테스트 검증
- [ ] `npm run test` 실행하여 기존 테스트 통과 확인
- [ ] `npm run e2e` 실행하여 시각 테스트 통과 확인
- [ ] 실패하는 테스트 문서화 (리팩토링 대상)

---

## 📝 작업 상세

### 1.1 테스트 디렉토리 구조

```
tests/
├── unit/
│   ├── engine/
│   │   ├── core/              # 리팩토링 후 생성
│   │   ├── systems/           # 리팩토링 후 생성
│   │   ├── skills/            # 리팩토링 후 생성
│   │   ├── scoring/
│   │   ├── prng.test.ts
│   │   ├── overtake.test.ts
│   │   ├── stats.test.ts
│   │   └── tuning.test.ts
│   ├── renderer/              # 리팩토링 후 생성
│   ├── data/
│   │   ├── characters.test.ts
│   │   ├── tracks.test.ts
│   │   └── teams.test.ts
│   ├── fixtures.ts
│   ├── helpers.ts
│   └── setup.ts
├── e2e/
│   ├── race-visual.spec.ts
│   ├── race-flow.spec.ts
│   └── __screens__/
└── utils/
    └── seed-comparisons.ts
```

### 1.2 vitest.config.ts 업데이트

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      outputDir: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'node_modules/',
        'dist/',
      ],
      thresholds: {
        lines: 0,       // 초기에는 0%, 점진적으로 높임
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
```

### 1.3 package.json 스크립트 추가

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:update": "vitest run -u && playwright test --update-snapshots"
  }
}
```

---

## 🧪 첫 테스트 작성

### fixtures.ts (예시)

```typescript
// tests/unit/fixtures.ts
import type { RaceConfig, RaceParticipant } from '../../src/engine/types';
import { characterCatalog } from '../../src/data/characters';

export function createTestConfig(overrides?: Partial<RaceConfig>): RaceConfig {
  const base: RaceConfig = {
    participants: [
      { id: 'p1', characterId: 'dog', name: 'Dog1', teamId: 'team-a' },
      { id: 'p2', characterId: 'cat', name: 'Cat1', teamId: 'team-a' },
      { id: 'p3', characterId: 'monkey', name: 'Monkey1', teamId: 'team-b' },
      { id: 'p4', characterId: 'bear', name: 'Bear1', teamId: 'team-b' },
    ],
    characters: characterCatalog,
    seed: 42,
    laps: 2,
    trackLength: 1000,
    modeId: 'individual',
    scoringId: 'individual',
    teamMode: false,
    relay: false,
    ...overrides,
  };

  return base;
}

export function createSingleRacerConfig(characterId: string, seed = 1): RaceConfig {
  return createTestConfig({
    participants: [{ id: 'p1', characterId, name: 'Test', teamId: 'team-a' }],
    seed,
  });
}
```

### helpers.ts (예시)

```typescript
// tests/unit/helpers.ts
import type { SkillEvent, RacerState } from '../../src/engine/types';

export function findEvent(frames: any[], eventType: string, variant?: string): SkillEvent | undefined {
  for (const frame of frames) {
    const event = frame.events.find((e: SkillEvent) =>
      e.type === eventType && (!variant || e.variant === variant)
    );
    if (event) return event;
  }
  return undefined;
}

export function getLeader(frames: any[], frameIndex?: number): RacerState | undefined {
  const frame = frameIndex !== undefined ? frames[frameIndex] : frames[frames.length - 1];
  return frame.racers.reduce((leader: RacerState | undefined, racer: RacerState) => {
    if (!leader || racer.progress > leader.progress) return racer;
    return leader;
  }, undefined);
}
```

### 첫 단위테스트 예시

```typescript
// tests/unit/engine/prng.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '../../../src/engine/prng';

describe('PRNG', () => {
  it('generates deterministic sequence', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(43);

    expect(rng1.next()).not.toBe(rng2.next());
  });

  it('fork creates independent sub-stream', () => {
    const rng = createRng(42);
    const sub1 = rng.fork('test:1');
    const sub2 = rng.fork('test:2');

    // 같은 시드에서 fork 해도 다른 시퀀스
    expect(sub1.next()).not.toBe(sub2.next());
  });
});
```

---

## 📊 커버리지 리포트 확인

### 실행

```bash
npm run test:coverage
```

### 리포트 위치

- **HTML**: `coverage/index.html` (브라우저에서 확인)
- **JSON**: `coverage/coverage-final.json` (CI 통합용)
- **텍스트**: 콘솔 출력

### 예시 리포트

```
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|-----------|----------|---------|---------|-------------------
All files                     |    15.23 |     8.45 |   12.34 |   15.67 |
 src/engine                   |    18.45 |     9.12 |   14.56 |   18.89 |
  RaceEngine.ts               |     5.23 |      2.1 |    4.56 |    5.34 | 1-1237
  prng.ts                     |    85.43 |     78.9 |   90.12 |   86.21 | 45-52, 78-82
  overtake.ts                 |    45.67 |     34.5 |   50.12 |   46.78 | 23-45, 67-89
 src/engine/skills            |     8.23 |      4.5 |    6.78 |    8.45 |
  zoomies.ts                  |    23.45 |     12.3 |   25.67 |   24.12 | 15-78
  catwalk.ts                  |    19.23 |      8.9 |   20.45 |   19.89 | 12-95
```

---

## 🎯 단계별 목표

### Phase 1 (Day 1)
- [ ] 테스트 디렉토리 구조 생성
- [ ] Vitest 설정 업데이트
- [ ] NPM 스크립트 추가
- [ ] fixtures.ts, helpers.ts 작성
- [ ] `npm run test:coverage` 실행 가능 확인

### Phase 2 (Day 2)
- [ ] 기존 테스트 실행 및 통과 확인
- [ ] PRNG 테스트 작성 (예시)
- [ ] 오버테이크 테스트 작성
- [ ] 커버리지 리포트 분석
- [ ] 리팩토링 우선순위 결정 (커버리지 낮은 영역)

---

## ⚠️ 주의사항

1. **기존 테스트 변경 금지**: 기존 테스트는 그대로 두고, 새 테스트만 추가
2. **커버리지 임계값 0% 로 시작**: 점진적으로 높여나갈 것
3. **결정론 테스트 우선**: PRNG, 시드 기반 로직부터 테스트
4. **리팩토링 전 테스트**: 코드 변경 전에 해당 영역의 테스트 작성

---

## 📚 참고

- [Vitest 문서](https://vitest.dev)
- [Coverage 문서](https://vitest.dev/guide/testing.html#code-coverage)
- 기존 테스트: `tests/unit/`, `tests/e2e/`

---

**다음 단계**: [단계 2 - 타입 정의 분리](./02-type-separation.md)

**최종 업데이트**: 2026-06-23
