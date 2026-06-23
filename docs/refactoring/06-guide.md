# 우다다 리팩토링 가이드

> **문서 목적**: 리팩토링 작업을 진행하는 개발자를 위한 가이드  
> **대상**: 우다다 코드베이스에 익숙한 개발자

---

## 🚀 빠른 시작

1. **문서 읽기**
   - [00-overview.md](./00-overview.md) - 전체 계획
   - [01-test-strategy.md](./01-test-strategy.md) - 테스트 전략
   - [02-phase1-test-infrastructure.md](./02-phase1-test-infrastructure.md) - 단계 1 상세

2. **환경 준비**
   ```bash
   npm install
   npm run test           # 기존 테스트 통과 확인
   npm run typecheck      # 타입 체크
   npm run build          # 빌드 성공 확인
   ```

3. **단계 1 시작**
   ```bash
   # 테스트 인프라 작업
   mkdir -p tests/unit/engine/core
   mkdir -p tests/unit/engine/systems
   
   # vitest.config.ts 업데이트
   # package.json 스크립트 추가
   
   # 테스트 실행
   npm run test:coverage
   ```

4. **진행 상황 기록**
   - [04-checklist.md](./04-checklist.md) 에서 해당 항목 체크
   - 완료일 기록
   - 비고 사항 기록

---

## 📚 문서 구조

```
docs/refactoring/
├── 00-overview.md           # 전체 개요 및 로드맵
├── 01-test-strategy.md      # 테스트 전략 및 패턴
├── 02-phase1-test-infrastructure.md  # 단계 1 상세 가이드
├── 03-phase2-implementation.md       # 단계 2-6 구현 상세
├── 04-checklist.md          # 진행 상황 체크리스트
└── 05-troubleshooting.md    # 문제 해결 가이드 (작성 예정)
```

---

## 🎯 리팩토링 원칙

### 1. 테스트 먼저
```typescript
// ❌ 나쁜 예: 코드 먼저 변경
function advance(racer) {
  // 기존 로직 변경
}

// ✅ 좋은 예: 테스트 먼저 작성
test('catch-up applies to trailer', () => {
  const result = advance(trailerRacer);
  expect(result.speed).toBeGreaterThan(result.baseSpeed);
});

function advance(racer) {
  // 테스트 통과하는 로직 구현
}
```

### 2. 작은 단위로
```typescript
// ❌ 나쁜 예: 한 번에 모든 것 변경
function refactorEverything() {
  // 500 줄 변경
}

// ✅ 좋은 예: 작은 단위로
function extractSpeedLogic() { /* 20 줄 */ }
function extractCatchupLogic() { /* 30 줄 */ }
function testSpeedLogic() { /* 테스트 */ }
function testCatchupLogic() { /* 테스트 */ }
```

### 3. 각 단계마다 검증
```bash
# 각 작은 변경 후
npm run typecheck
npm run test
npm run build
```

### 4. 롤백 가능
- 각 커밋은独立完成
- 실패 시 쉽게 롤백
- feature branch 활용

---

## 🛠️ 작업 흐름

### 일반적인 작업 순서

1. **작업 시작 전**
   ```bash
   git checkout -b refactor/feature-name
   npm run test           # 기존 테스트 통과 확인
   ```

2. **테스트 작성**
   ```typescript
   // tests/unit/engine/core/new-feature.test.ts
   import { describe, it, expect } from 'vitest';
   import { newFeature } from '../../../../src/engine/core/NewFeature';

   describe('NewFeature', () => {
     it('does something', () => {
       // 테스트 코드
     });
   });
   ```

3. **코드 작성**
   ```bash
   # 새 파일 생성 또는 기존 파일 수정
   ```

4. **테스트 실행**
   ```bash
   npm run test -- new-feature.test.ts
   ```

5. **커밋**
   ```bash
   git add .
   git commit -m "refactor: extract new feature with tests"
   ```

6. **다음 작업으로 진행**

---

## 📝 커밋 메시지 가이드

### 형식
```
refactor(<area>): <description>

- Extracted <what> from <where>
- Added tests for <feature>
- No behavior changes
```

### 예시

```
refactor(engine): extract advance system

- Extracted speed calculation from RaceEngine.ts
- Extracted catch-up logic to separate module
- Added unit tests for AdvanceSystem
- No behavior changes (determinism test passes)

Closes #123
```

```
refactor(types): split types into domains

- Moved RaceConfig to types/race.ts
- Moved RacerState to types/racer.ts
- Moved EngineFrame to types/frame.ts
- Updated all imports

No behavior changes.
```

```
test(engine): add PRNG determinism tests

- Test same seed produces same sequence
- Test different seeds produce different sequences
- Test fork creates independent sub-streams

Covers src/engine/prng.ts
```

---

## 🧪 테스트 작성 가이드

### 1. 단위테스트 패턴

```typescript
// tests/unit/engine/skills/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { exampleHandler } from '../../../../src/engine/skills/example';
import { createTestContext } from '../../helpers';

describe('Example Skill', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    ctx = createTestContext({
      skillType: 'example',
      racers: [
        { id: 'p1', progress: 500, lane: 0.5, phase: 'running' },
        { id: 'p2', progress: 480, lane: 0.6, phase: 'running' },
      ],
    });
  });

  it('executes successfully', () => {
    exampleHandler(ctx);
    
    const events = ctx.getEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  it('produces expected effect', () => {
    exampleHandler(ctx);
    
    const p1 = ctx.getRacer('p1');
    expect(p1.skill.burst).toBeGreaterThan(0);
  });
});
```

### 2. 통합테스트 패턴

```typescript
// tests/unit/engine/integration/example.test.ts
import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../../../src/engine/RaceEngine';
import { createDefaultSkillRegistry } from '../../../../src/engine/skills';
import { createTestConfig } from '../../fixtures';

describe('Integration: Example', () => {
  const skills = createDefaultSkillRegistry();
  const scoring = createDefaultScoringRegistry();

  it('system A interacts with system B', () => {
    const config = createTestConfig({ seed: 42 });
    const { frames } = simulateRace(config, skills, scoring);

    // 시스템 A 의 이벤트 확인
    const eventA = findEvent(frames, 'systemA');
    expect(eventA).toBeDefined();

    // 시스템 B 의 반응 확인
    const eventB = findEvent(frames, 'systemB');
    expect(eventB).toBeDefined();
  });
});
```

### 3. 시각 검증 패턴

```typescript
// tests/e2e/visual/example.spec.ts
import { test, expect } from '@playwright/test';

test('renders correctly', async ({ page }) => {
  await page.goto('/');
  
  await page.evaluate(() => {
    window.__woodada.showRaceAt(100, { seed: 7 });
  });

  await expect(page).toHaveScreenshot('example.png', {
    maxDiffPixels: 10,
  });
});
```

---

## 🔍 문제 해결

###常见问题

#### 1. 테스트가 실패함
```bash
# 상세 에러 확인
npm run test -- --reporter=verbose

# 특정 테스트만 실행
npm run test -- filename.test.ts

# Watch 모드로 실시간 확인
npm run test:watch
```

#### 2. 타입 에러
```bash
# 상세 에러 확인
npm run typecheck -- --noEmit

# 에러 위치 확인
npx tsc --listFiles
```

#### 3. 결정론 깨짐
```typescript
// 시드 기반 비교 테스트
const { frames: frames1 } = simulateRace(config, skills, scoring);
const { frames: frames2 } = simulateRace(config, skills, scoring);

expect(frames1).toEqual(frames2); // 반드시 통과해야 함
```

#### 4. 성능 저하
```bash
# 벤치마크 실행
npm run benchmark

# 프로파일링
node --prof src/index.ts
node --prof-process isolate-*.log > profile.txt
```

---

## 📊 성공 지표

### 코드 품질
- [ ] 각 파일 400 줄 이하
- [ ] 함수 50 줄 이하 (권장)
- [ ] 모듈 간 의존성 명확
- [ ] 타입 정의 명확

### 테스트
- [ ] 단위테스트 커버리지 80%+
- [ ] 통합테스트 모든 시스템 포함
- [ ] 시각 테스트 주요 흐름 커버
- [ ] 결정론 테스트 통과

### 성능
- [ ] 빌드 시간 ±10% 이내
- [ ] 프레임 시간 ±5% 이내
- [ ] 메모리 사용량 증가 없음

### 문서
- [ ] README 업데이트
- [ ] API 문서 완성
- [ ] 아키텍처 다이어그램
- [ ] CHANGELOG 기록

---

## 🤝 협업 가이드

### 코드 리뷰 체크리스트

- [ ] 테스트가 포함되어 있는가?
- [ ] 기존 테스트가 모두 통과하는가?
- [ ] 타입 에러가 없는가?
- [ ] 파일 크기가 적절한가?
- [ ] 주석이 충분한가?
- [ ] 이름이 명확한가?
- [ ] 중복 로직이 없는가?
- [ ] 결정론이 유지되는가?

### 브랜치 전략

```bash
# 메인 브랜치
main
  │
  └── refactor/test-infrastructure
        │
        └── refactor/type-separation
              │
              └── refactor/engine-systems
                    │
                    └── ...
```

### PR 작성 가이드

```markdown
## 리팩토링: <제목>

### 변경 내용
- <무엇을 변경했는지>
- <왜 변경했는지>

### 테스트
- [ ] 단위테스트 추가/수정
- [ ] 통합테스트 통과 확인
- [ ] 시각테스트 통과 확인

### 영향
- [ ] 기존 기능 영향 없음
- [ ] 성능 영향 없음
- [ ] API 변경 없음

### 체크리스트
- [ ] `npm run typecheck` 통과
- [ ] `npm run test` 모든 테스트 통과
- [ ] `npm run build` 성공
- [ ] `npm run e2e` 시각 테스트 통과
```

---

## 📚 참고 자료

### 내부 문서
- [CLAUDE.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/CLAUDE.md) - 프로젝트 규칙
- [woodada-spec.md](/Users/a08368/vscodeProjects/woodada/woodada-v3/woodada-spec.md) - 게임 스펙

### 외부 자료
- [Vitest 문서](https://vitest.dev)
- [Playwright 문서](https://playwright.dev)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Clean Code](https://amzn.to/3xvCqDg)

---

## 🆘 도움 요청

문제에 직면했을 때:

1. **문서 확인**: 이 가이드 문서 검색
2. **에러 메시지**: 에러 메시지 검색
3. **코드 검색**: 유사한 패턴 찾기 (`grep`, `rg`)
4. **테스트 실행**: 테스트로 문제 재현
5. **질문**: 관련 문서에 이슈 또는 질문 생성

---

**최종 업데이트**: 2026-06-23
