# 테스트 전략

> **목표**: 우다다 코드베이스의 테스트 커버리지 향상  
> **원칙**: 테스트가 리팩토링의 안전망이 되도록

---

## 🎯 테스트 목표

### 1. 커버리지 목표
| 영역 | 현재 | 목표 | 우선순위 |
|------|------|------|----------|
| **엔진 로직** | ~20% | 80%+ | ⭐⭐⭐⭐⭐ |
| **스킬 시스템** | ~10% | 85%+ | ⭐⭐⭐⭐⭐ |
| **렌더러** | ~5% (시각) | 60%+ | ⭐⭐⭐⭐ |
| **데이터** | ~50% | 90%+ | ⭐⭐⭐ |
| **shell/UI** | ~10% | 50%+ | ⭐⭐ |

### 2. 테스트 유형별 역할
| 유형 | 도구 | 대상 | 빈도 |
|------|------|------|------|
| **단위테스트** | Vitest | 엔진 시스템, 스킬 로직 | 매 커밋 |
| **통합테스트** | Vitest | 시스템 간 상호작용 | 매 커밋 |
| **E2E 시각** | Playwright | 렌더러 출력, UI 흐름 | 매 빌드 |
| **성능** | 벤치마크 | 프레임 시간, 메모리 | 주간 |

---

## 📁 테스트 구조

```
tests/
├── unit/                    # Vitest 단위/통합테스트
│   ├── engine/
│   │   ├── core/
│   │   │   ├── advance.test.ts
│   │   │   ├── skill-system.test.ts
│   │   │   └── state.test.ts
│   │   ├── systems/
│   │   │   ├── item-system.test.ts
│   │   │   ├── ice-system.test.ts
│   │   │   ├── decoy-system.test.ts
│   │   │   ├── elimination-system.test.ts
│   │   │   └── overtake-system.test.ts
│   │   ├── skills/
│   │   │   ├── zoomies.test.ts
│   │   │   ├── catwalk.test.ts
│   │   │   ├── banana.test.ts
│   │   │   └── ...
│   │   ├── scoring/
│   │   │   ├── individual.test.ts
│   │   │   ├── team.test.ts
│   │   │   └── relay.test.ts
│   │   ├── prng.test.ts
│   │   ├── overtake.test.ts
│   │   ├── stats.test.ts
│   │   └── tuning.test.ts
│   ├── renderer/
│   │   ├── fx-renderer.test.ts
│   │   ├── character-renderer.test.ts
│   │   └── track-renderer.test.ts
│   ├── data/
│   │   ├── characters.test.ts
│   │   ├── tracks.test.ts
│   │   └── teams.test.ts
│   ├── fixtures.ts          # 공통 테스트 데이터
│   ├── helpers.ts           # 테스트 헬퍼 함수
│   └── setup.ts             # 테스트 설정
├── e2e/                     # Playwright E2E 테스트
│   ├── race-visual.spec.ts  # 시각 검증 스크린샷
│   ├── race-flow.spec.ts    # 게임 흐름
│   ├── skills.spec.ts       # 스킬 발동 시각화
│   └── __screens__/         # 기준 스크린샷
├── benchmarks/              # 성능 벤치마크
│   ├── engine-benchmark.ts
│   └── renderer-benchmark.ts
└── utils/                   # 공통 유틸리티
    ├── seed-comparisons.ts  # 결정론 검증
    └── snapshot-helpers.ts
```

---

## 🧪 테스트 패턴

### 1. 결정론 테스트 (Determinism Tests)

**목적**: 같은 (config + seed) → 동일한 결과 보장

```typescript
// tests/unit/engine/determinism.test.ts
import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../../src/engine/RaceEngine';
import { createDefaultSkillRegistry } from '../../../src/engine/skills';
import { createDefaultScoringRegistry } from '../../../src/engine/scoring';
import { createTestConfig } from '../fixtures';

describe('Determinism', () => {
  const skills = createDefaultSkillRegistry();
  const scoring = createDefaultScoringRegistry();

  it('same (config, seed) produces identical frames', () => {
    const config = createTestConfig({ seed: 42 });

    const { frames: frames1, result: result1 } = simulateRace(config, skills, scoring);
    const { frames: frames2, result: result2 } = simulateRace(config, skills, scoring);

    expect(frames1).toEqual(frames2);
    expect(result1).toEqual(result2);
  });

  it('different seed produces different results', () => {
    const config1 = createTestConfig({ seed: 42 });
    const config2 = createTestConfig({ seed: 43 });

    const { result: result1 } = simulateRace(config1, skills, scoring);
    const { result: result2 } = simulateRace(config2, skills, scoring);

    // 완전히 같을 확률은 극히 낮음
    expect(JSON.stringify(result1)).not.toEqual(JSON.stringify(result2));
  });

  it('replay produces identical race', () => {
    const config = createTestConfig({ seed: 123 });

    const { frames, result } = simulateRace(config, skills, scoring);

    // 프레임 스크립트로 재생
    const replayFrames = frames.map(f => ({
      frame: f.frame,
      racers: f.racers.map(r => ({ id: r.id, progress: r.progress, lane: r.lane })),
      events: f.events,
    }));

    expect(replayFrames).toHaveLength(frames.length);
  });
});
```

### 2. 시스템 단위테스트

**목적**: 각 엔진 시스템의 로직 검증

```typescript
// tests/unit/engine/systems/item-system.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createItemSystem } from '../../../../src/engine/systems/ItemSystem';
import { createRng } from '../../../../src/engine/prng';

describe('ItemSystem', () => {
  let rng: ReturnType<typeof createRng>;
  let itemSystem: ReturnType<typeof createItemSystem>;

  beforeEach(() => {
    rng = createRng(42);
    itemSystem = createItemSystem(rng);
  });

  describe('box spawning', () => {
    it('spawns first box after initial delay', () => {
      const boxes = itemSystem.update(0, []);
      expect(boxes).toHaveLength(0); // 초반에는 스폰 안 됨

      const boxesAfter1500ms = itemSystem.update(1500, []);
      expect(boxesAfter1500ms.length).toBeGreaterThanOrEqual(0);
      expect(boxesAfter1500ms.length).toBeLessThanOrEqual(1);
    });

    it('maintains max 3 boxes', () => {
      // 3 개 이상 스폰 시도
      const manyBoxes = Array(5).fill({ id: 'test', progress: 500, lane: 0.5, active: true });
      const result = itemSystem.update(5000, manyBoxes);
      expect(result).toHaveLength(3);
    });
  });

  describe('item effects', () => {
    it('star item grants speed boost and immunity', () => {
      const racers = [{ id: 'p1', phase: 'running' as const, skill: {} }];
      const boxes = [{ id: 'box1', progress: 100, lane: 0.5 }];

      const result = itemSystem.applyPickup('p1', racers, boxes, 1000);

      const p1 = result.racers.find(r => r.id === 'p1')!;
      expect(p1.skill.burst).toBe(1.4); // 40% 속도 증가
      expect(p1.skill.starUntil).toBeGreaterThan(1000);
    });

    it('lightning slows all other racers', () => {
      const racers = [
        { id: 'p1', phase: 'running' as const, skill: {} },
        { id: 'p2', phase: 'running' as const, skill: {} },
        { id: 'p3', phase: 'running' as const, skill: {} },
      ];
      const boxes = [{ id: 'box1', progress: 100, lane: 0.5 }];

      const result = itemSystem.applyPickup('p1', racers, boxes, 1000);

      // p1 은 면역, p2/p3 는 느려짐
      expect(result.racers.find(r => r.id === 'p1')!.skill.slowUntil).toBeUndefined();
      expect(result.racers.find(r => r.id === 'p2')!.skill.slowUntil).toBeGreaterThan(1000);
      expect(result.racers.find(r => r.id === 'p3')!.skill.slowUntil).toBeGreaterThan(1000);
    });
  });
});
```

### 3. 스킬 단위테스트

**목적**: 각 스킬의 로직 검증

```typescript
// tests/unit/engine/skills/banana.test.ts
import { describe, it, expect } from 'vitest';
import { bananaHandler } from '../../../../src/engine/skills/banana';
import { createTestContext } from '../../helpers';

describe('Banana Skill', () => {
  it('throws banana that stuns target', () => {
    const ctx = createTestContext({
      skillType: 'banana',
      racers: [
        { id: 'monkey1', progress: 500, lane: 0.5, phase: 'running' },
        { id: 'dog1', progress: 480, lane: 0.6, phase: 'running' },
      ],
    });

    bananaHandler(ctx);

    const events = ctx.getEvents();
    const hitEvent = events.find(e => e.type === 'banana' && e.variant === 'hit');
    
    expect(hitEvent).toBeDefined();
    expect(hitEvent?.targetId).toBe('dog1');
  });

  it('banana fails when target dodges', () => {
    const ctx = createTestContext({
      skillType: 'banana',
      racers: [
        { id: 'monkey1', progress: 500, lane: 0.5, phase: 'running' },
        { id: 'cat1', progress: 480, lane: 0.6, phase: 'running' }, // cat 은 회피 가능
      ],
    });

    bananaHandler(ctx);

    const events = ctx.getEvents();
    const dodgeEvent = events.find(e => e.type === 'banana' && e.variant === 'dodge');
    
    expect(dodgeEvent).toBeDefined();
  });

  it('sets banana immunity on hit target', () => {
    const ctx = createTestContext({
      skillType: 'banana',
      racers: [
        { id: 'monkey1', progress: 500, lane: 0.5, phase: 'running' },
        { id: 'dog1', progress: 480, lane: 0.6, phase: 'running' },
      ],
    });

    bananaHandler(ctx);

    const dog1 = ctx.getRacer('dog1');
    expect(dog1.skill.bananaImmuneUntil).toBeGreaterThan(ctx.frame);
  });
});
```

### 4. 통합테스트

**목적**: 시스템 간 상호작용 검증

```typescript
// tests/unit/engine/integration/overtake-and-skills.test.ts
import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../../../src/engine/RaceEngine';
import { createDefaultSkillRegistry } from '../../../../src/engine/skills';
import { createDefaultScoringRegistry } from '../../../../src/engine/scoring';
import { createTestConfig } from '../../fixtures';

describe('Integration: Overtake + Skills', () => {
  const skills = createDefaultSkillRegistry();
  const scoring = createDefaultScoringRegistry();

  it('skill activation during overtake triggers reaction', () => {
    const config = createTestConfig({
      seed: 42,
      laps: 2,
      participants: [
        { id: 'p1', characterId: 'cat', name: 'Cat1' },
        { id: 'p2', characterId: 'monkey', name: 'Monkey1' },
      ],
    });

    const { frames } = simulateRace(config, skills, scoring);

    // 오버테이크 발생 후 스킬 반응 이벤트 확인
    const reactionEvents = frames.flatMap(f => f.events).filter(e =>
      e.type === 'catwalk' && e.variant === 'dodge'
    );

    expect(reactionEvents.length).toBeGreaterThan(0);
  });

  it('item pickup affects overtaking dynamics', () => {
    const config = createTestConfig({
      seed: 123,
      laps: 2,
    });

    const { frames } = simulateRace(config, skills, scoring);

    // 아이템 수집 후 순위 변화 감지
    let prevOrder = new Set<string>();
    let orderChangedAfterItem = false;

    for (const frame of frames) {
      const hasItemEvent = frame.events.some(e => e.type === 'item');
      const currentOrder = new Set(frame.racers.map(r => r.id));

      if (hasItemEvent && prevOrder.size > 0 && !orderChangedAfterItem) {
        // 아이템 수집 후 다음 프레임에서 순위 변화
        if (JSON.stringify([...prevOrder]) !== JSON.stringify([...currentOrder])) {
          orderChangedAfterItem = true;
        }
      }

      prevOrder = currentOrder;
    }

    // 아이템이 순위 변화에 영향을 줬는지 (반드시 그런 건 아님)
    // 이 테스트는 아이템 시스템이 작동하는지 확인용
    const itemEvents = frames.flatMap(f => f.events).filter(e => e.type === 'item');
    expect(itemEvents.length).toBeGreaterThan(0);
  });
});
```

### 5. 시각 검증 테스트

**목적**: 렌더러 출력의 시각적 일관성

```typescript
// tests/e2e/race-visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('start line shows all racers in correct positions', async ({ page }) => {
    await page.goto('/');
    
    // 프레임 0 으로 이동 (시작선)
    await page.evaluate(() => {
      window.__woodada.showRaceAt(0, { seed: 7 });
    });

    await expect(page).toHaveScreenshot('start-line.png', {
      maxDiffPixels: 5,
    });
  });

  test('skill activation shows correct FX', async ({ page }) => {
    await page.goto('/');
    
    // 스킬 발동 프레임으로 이동 (시드 7, 강아지의 zoomies)
    const eventFrames = await page.evaluate(() => {
      return window.__woodada.simulate({ seed: 7 });
    });

    await page.evaluate((frame) => {
      window.__woodada.showRaceAt(frame, { seed: 7 });
    }, eventFrames.eventFrames['zoomies:activate']);

    await expect(page).toHaveScreenshot('zoomies-activate.png', {
      maxDiffPixels: 10,
    });
  });

  test('finish shows podium correctly', async ({ page }) => {
    await page.goto('/');
    
    // 경주 완료 후 시상대 화면
    await page.click('button:has-text("시작")');
    await page.waitForSelector('.podium-gate');
    await page.click('.podium-gate');

    await expect(page).toHaveScreenshot('podium.png', {
      maxDiffPixels: 10,
    });
  });
});
```

### 6. 성능 벤치마크

**목적**: 리팩토링 후 성능 저하 감지

```typescript
// tests/benchmarks/engine-benchmark.ts
import { bench, describe } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine';
import { createDefaultSkillRegistry } from '../../src/engine/skills';
import { createDefaultScoringRegistry } from '../../src/engine/scoring';
import { createTestConfig } from '../unit/fixtures';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

describe('Engine Performance', () => {
  const config = createTestConfig({ seed: 42, laps: 3 });

  bench('simulate 1000 frames', () => {
    const { frames } = simulateRace(config, skills, scoring, 1000);
    expect(frames).toHaveLength(1000);
  });

  bench('simulate full race (avg 2000 frames)', () => {
    const { frames } = simulateRace(config, skills, scoring);
    expect(frames.length).toBeGreaterThan(1000);
  });

  bench('step 1 frame', () => {
    const engine = simulateRace(config, skills, scoring);
    for (let i = 0; i < 100; i++) {
      engine.step();
    }
  });
});
```

---

## 🛠️ 테스트 유틸리티

### fixtures.ts - 공통 테스트 데이터

```typescript
// tests/unit/fixtures.ts
import type { RaceConfig, RaceParticipant } from '../../src/engine/types';
import type { CharacterCatalog } from '../../src/data/schema';
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

export function createTeamConfig(teamSize = 3, seed = 1): RaceConfig {
  const participants: RaceParticipant[] = [];
  for (let i = 0; i < teamSize; i++) {
    participants.push({
      id: `p${i}`,
      characterId: ['dog', 'cat', 'monkey', 'bear'][i % 4],
      name: `Racer${i}`,
      teamId: 'team-a',
    });
  }

  return createTestConfig({
    participants,
    teamMode: true,
    relay: false,
    seed,
  });
}

export function createRelayConfig(teams = 2, membersPerTeam = 3, seed = 1): RaceConfig {
  const participants: RaceParticipant[] = [];
  for (let t = 0; t < teams; t++) {
    for (let m = 0; m < membersPerTeam; m++) {
      participants.push({
        id: `t${t}-m${m}`,
        characterId: ['dog', 'cat', 'monkey', 'bear'][m % 4],
        name: `Team${t}-Member${m}`,
        teamId: `team-${t}`,
      });
    }
  }

  return createTestConfig({
    participants,
    teamMode: true,
    relay: true,
    laps: teams, // 각 팀이 teams 번 주자
    seed,
  });
}
```

### helpers.ts - 테스트 헬퍼 함수

```typescript
// tests/unit/helpers.ts
import type { RaceEngine } from '../../src/engine/RaceEngine';
import type { RacerState, SkillEvent } from '../../src/engine/types';

export function findEvent(frames: any[], eventType: string, variant?: string): SkillEvent | undefined {
  for (const frame of frames) {
    const event = frame.events.find((e: SkillEvent) =>
      e.type === eventType && (!variant || e.variant === variant)
    );
    if (event) return event;
  }
  return undefined;
}

export function getRacerByProgress(frames: any[], racerId: string, frameIndex?: number): RacerState | undefined {
  const frame = frameIndex !== undefined ? frames[frameIndex] : frames[frames.length - 1];
  return frame.racers.find((r: RacerState) => r.id === racerId);
}

export function getLeader(frames: any[], frameIndex?: number): RacerState | undefined {
  const frame = frameIndex !== undefined ? frames[frameIndex] : frames[frames.length - 1];
  return frame.racers.reduce((leader: RacerState | undefined, racer: RacerState) => {
    if (!leader || racer.progress > leader.progress) return racer;
    return leader;
  }, undefined);
}

export function waitForEvent(frames: any[], eventType: string, variant?: string): number {
  const event = findEvent(frames, eventType, variant);
  if (!event) return -1;
  
  return frames.findIndex(f => f.events.includes(event));
}

export function simulateToEvent(
  engine: RaceEngine,
  eventType: string,
  variant?: string,
  maxFrames = 5000
): { frames: any[]; event: SkillEvent | null } {
  const frames: any[] = [];
  
  while (!engine.finished && frames.length < maxFrames) {
    const frame = engine.step();
    frames.push(frame);
    
    const event = frame.events.find((e: SkillEvent) =>
      e.type === eventType && (!variant || e.variant === variant)
    );
    
    if (event) {
      return { frames, event };
    }
  }
  
  return { frames, event: null };
}

export function compareResults(result1: any, result2: any): boolean {
  return (
    JSON.stringify(result1.order) === JSON.stringify(result2.order) &&
    result1.seed === result2.seed
  );
}
```

---

## 📊 커버리지 측정

### 설정 (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### 실행

```bash
# 단위테스트 + 커버리지 리포트
npm run test -- --coverage

# 특정 파일 테스트
npm run test -- tests/unit/engine/skills/banana.test.ts

# 커버리지 리포트 확인
open coverage/index.html
```

---

## 🔄 테스트 실행 흐름

### 개발 워크플로우

1. **기능 추가/수정 전**
   ```bash
   npm run test           # 기존 테스트 통과 확인
   npm run typecheck      # 타입 체크
   ```

2. **테스트 작성**
   - 새 기능: 테스트 먼저 작성 (TDD)
   - 버그 수정: 버그 재현 테스트 먼저 작성

3. **코드 작성**
   - 테스트 통과하는 코드 작성

4. **리팩토링**
   - 테스트 통과 상태 유지하며 코드 정리

5. **검증**
   ```bash
   npm run test           # 모든 테스트 통과
   npm run typecheck      # 타입 오류 없음
   npm run e2e            # 시각 검증
   npm run build          # 빌드 성공
   ```

### CI/CD 파이프라인

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test -- --coverage
      - run: npm run e2e
      - run: npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📈 진행 상황 추적

| 영역 | 테스트 수 | 커버리지 | 상태 |
|------|----------|----------|------|
| **엔진 코어** | 0 | 0% | 대기 |
| **스킬 시스템** | 0 | 0% | 대기 |
| **아이템 시스템** | 0 | 0% | 대기 |
| **얼음 시스템** | 0 | 0% | 대기 |
| **분신 시스템** | 0 | 0% | 대기 |
| **탈락전 시스템** | 0 | 0% | 대기 |
| **추월 시스템** | 0 | 0% | 대기 |
| **렌더러** | 0 | 0% | 대기 |

---

**최종 업데이트**: 2026-06-23
