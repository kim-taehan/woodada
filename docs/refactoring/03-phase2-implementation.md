# 단계 2-6: 구현 상세

> 각 단계별 상세 작업 가이드  
> **원칙**: 테스트 먼저 작성 → 코드 변경 → 테스트 통과 확인

---

## 단계 2: 타입 정의 분리

### 목표
- `src/engine/types.ts`(303 줄) 를 도메인별 파일로 분할
- 각 파일에 명확한 주석 추가
- 기존 import 경로 유지 (백컴pat)

### 작업 상세

#### 2.1 새 디렉토리 구조 생성

```
src/engine/types/
├── index.ts           # 모든 타입 에クスポート (백컴pat)
├── race.ts            # RaceConfig, RaceParticipant
├── racer.ts           # RacerState, RacerPhase, SkillRuntime
├── frame.ts           # EngineFrame, SkillEvent, ItemBoxState
├── result.ts          # RaceResult, ScoringResult
├── special.ts         # DecoyState, IceZoneState
└── constants.ts       # DT_MS, FINISH_OFFSET_FRAC
```

#### 2.2 파일별 내용

**race.ts**
```typescript
/**
 * 경주 설정 및 참가자 정의 (spec §4, §5, §7)
 */
import type { CharacterData } from '../../data/schema';

export type RacerId = string;

export interface RaceParticipant {
  id: RacerId;
  name: string;
  characterId: string;
  teamId?: string;
}

export interface RaceConfig {
  participants: RaceParticipant[];
  characters: Record<string, CharacterData>;
  seed: number;
  laps: number;
  trackLength: number;
  modeId: string;
  scoringId: string;
  teamMode: boolean;
  relay: boolean;
  elimination?: 'first' | 'last';
}
```

**racer.ts**
```typescript
/**
 * 레이서 상태 및 런타임 스킬 데이터
 */
import type { RacerId } from './race';

export type RacerPhase =
  | 'running'
  | 'blocked'
  | 'stunned'
  | 'napping'  // legacy
  | 'straying'
  | 'finished'
  | 'waiting'
  | 'eliminated';

export interface SkillRuntime {
  effectUntil?: number;
  burst?: number;
  dodgeFrame?: number;
  dodgeRoll?: boolean;
  skillInvulnUntil?: number;
  starUntil?: number;
  slowUntil?: number;
  slowMul?: number;
  bananaImmuneUntil?: number;
  iceJumping?: boolean;
  iceZoneId?: string;
  [k: string]: number | string | boolean | undefined;
}

export interface RacerState {
  id: RacerId;
  characterId: string;
  teamId?: string;
  progress: number;
  lane: number;
  homeLane: number;
  speed: number;
  baseSpeed: number;
  power?: number;
  leg?: number;
  phase: RacerPhase;
  facing: number;
  weaveSide?: -1 | 0 | 1;
  finishedAt?: number;
  eliminatedAt?: number;
  eliminationOrder?: number;
  rank?: number;
  skillCooldownUntil: number;
  skill: SkillRuntime;
}
```

**frame.ts**
```typescript
/**
 * 시뮬레이션 프레임 및 이벤트
 */
import type { RacerId, RaceConfig } from './race';
import type { RacerState } from './racer';

export interface SkillEvent {
  frame: number;
  racerId: RacerId;
  type: string;
  variant:
    | 'activate' | 'hit' | 'dodge' | 'wake' | 'boost' | 'slip' | 'handoff'
    | 'star' | 'lightning' | 'shell' | 'shellhit' | 'fart'
    | 'out'
    | 'clone' | 'clonehit' | 'clonepop' | 'teleport';
  targetId?: RacerId;
  line?: string;
}

export interface ItemBoxState {
  id: string;
  progress: number;
  lane: number;
  active: boolean;
}

export interface IceZoneState {
  id: string;
  startProgress: number;
  length: number;
  activeUntil: number;
  ownerId: RacerId;
}

export interface DecoyState {
  id: string;
  ownerId: RacerId;
  offset: number;
  laneOffset: number;
  progress: number;
  lane: number;
  spawnedAt: number;
  expireFrame: number;
  lead: boolean;
  alive: boolean;
}

export interface EngineFrame {
  frame: number;
  time: number;
  racers: RacerState[];
  events: SkillEvent[];
  boxes: ItemBoxState[];
  iceZones: IceZoneState[];
  decoys: DecoyState[];
  finished: boolean;
}
```

**result.ts**
```typescript
/**
 * 경주 결과 및 점수 계산
 */
import type { RacerId } from './race';

export interface ScoringResult {
  type: 'individual' | 'team';
  order: string[];
  detail: Record<string, number>;
}

export interface RaceResult {
  order: RacerId[];
  finishFrame: Record<RacerId, number>;
  scoring: ScoringResult;
  seed: number;
}
```

**constants.ts**
```typescript
/**
 * 시뮬레이션 상수
 */
export const DT_MS = 1000 / 60;

export const FINISH_OFFSET_FRAC = 0.21;
```

**index.ts** (백컴pat)
```typescript
/**
 * 모든 엔진 타입을 한 곳에서 에クスポート
 * @deprecated 직접 하위 파일을 import 하는 것을 권장
 */
export * from './race';
export * from './racer';
export * from './frame';
export * from './result';
export * from './special';
export * from './constants';
```

#### 2.3 업데이트 순서

1. `src/engine/types/` 디렉토리 생성
2. 각 파일에 타입 이동 (주석 추가)
3. `src/engine/types.ts` 를 `index.ts` 로 변경 (재에クス포트만)
4. `src/engine/*.ts` 파일들의 import 경로 업데이트
5. `npm run typecheck` 실행
6. `npm run test` 실행

---

## 단계 3: 엔진 시스템 분리

### 3.1 코어 시스템

#### AdvanceSystem.ts
```typescript
// src/engine/core/AdvanceSystem.ts
import type { RacerState } from '../types';
import { applyOvertake, laneDistanceFactor } from '../overtake';
import { powerEaseSlow } from '../stats';
import { SPEED_JITTER, CATCHUP, LANE } from '../tuning';
import type { Rng } from '../prng';

export interface AdvanceContext {
  racerRng: Map<string, Rng>;
  frame: number;
  meanProgress: number;
  trackLength: number;
  spreadBehind: number;
}

export function createAdvanceSystem() {
  function getSpeed(self: RacerState, rng: Rng): number {
    const jitter = 1 + rng.range(-SPEED_JITTER, SPEED_JITTER);
    return self.baseSpeed * jitter + (self.skill.burst ?? 0);
  }

  function getCatchupFactor(self: RacerState, ctx: AdvanceContext): number {
    const gapLaps = (ctx.meanProgress - self.progress) / ctx.trackLength;
    
    if (gapLaps > CATCHUP.deadZone) {
      return Math.min(
        CATCHUP.maxBoost,
        1 + (gapLaps - CATCHUP.deadZone) * CATCHUP.behindGain * ctx.spreadBehind,
      );
    }
    if (gapLaps < -CATCHUP.deadZone) {
      return Math.max(CATCHUP.minBoost, 1 + (gapLaps + CATCHUP.deadZone) * CATCHUP.aheadDrag);
    }
    return 1;
  }

  function advance(self: RacerState, all: RacerState[], ctx: AdvanceContext): void {
    if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'eliminated') return;
    if (self.phase === 'stunned') {
      self.speed = 0;
      return;
    }

    const rng = ctx.racerRng.get(self.id)!;
    self.speed = getSpeed(self, rng);
    self.speed *= getCatchupFactor(self, ctx);

    applyOvertake(self, all, rng, ctx.frame);

    // Ice effects (다른 시스템으로 분리 예정)
    // applyIce(self);

    // Slow effects
    if ((self.skill.slowUntil ?? 0) > ctx.frame) {
      self.speed *= powerEaseSlow(Number(self.skill.slowMul ?? 1), self.power);
    }

    // Progress update with lane distance factor
    self.progress += self.speed * laneDistanceFactor(self.lane);
  }

  return { advance };
}
```

#### SkillSystem.ts
```typescript
// src/engine/core/SkillSystem.ts
import type { RacerState, SkillEvent } from '../types';
import type { Rng } from '../prng';
import type { SkillRegistry } from '../skills/types';
import { RETRY_COOLDOWN_MS, SKILL_INVULN_FRAMES } from '../tuning';

export interface SkillContext {
  frame: number;
  skillRng: Map<string, Rng>;
  skills: SkillRegistry;
  config: any; // RaceConfig
  participantsById: Record<string, any>;
}

export function createSkillSystem() {
  function fireSkill(
    self: RacerState,
    events: SkillEvent[],
    ctx: SkillContext,
    passer?: RacerState,
  ): void {
    if (ctx.frame < self.skillCooldownUntil) return;
    if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'stunned' || self.phase === 'eliminated') return;

    const character = ctx.config.characters[self.characterId];
    const reaction = passer ? ctx.skills.getReaction(character.skill.type) : undefined;
    const tick = passer ? undefined : ctx.skills.get(character.skill.type);
    
    if (!reaction && !tick) return;

    const before = events.length;
    
    // Build skill context
    const skillCtx = buildSkillContext(self, ctx, passer);
    
    // Execute
    if (reaction && passer) reaction(skillCtx);
    else if (tick) tick(skillCtx);

    const activated = events.length > before;
    
    if (activated) {
      // Grant i-frames
      self.skill.skillInvulnUntil = ctx.frame + SKILL_INVULN_FRAMES;
      
      // Set full cooldown
      const [min, max] = character.skill.cooldownMs;
      const factor = fieldCooldownFactor(activeRunnerCount(ctx));
      const rng = ctx.skillRng.get(self.id)!;
      self.skillCooldownUntil = ctx.frame + Math.round((rng.range(min, max) * factor) / 16.67);
    } else {
      // Retry cooldown
      self.skillCooldownUntil = ctx.frame + Math.round(RETRY_COOLDOWN_MS / 16.67);
    }
  }

  return { fireSkill };
}
```

### 3.2 부 시스템

#### ItemSystem.ts
```typescript
// src/engine/systems/ItemSystem.ts
import type { RacerState, SkillEvent, ItemBoxState } from '../types';
import type { Rng } from '../prng';

const ITEM = {
  collectDist: 7,
  collectLane: 0.6,
  maxBoxes: 3,
  firstSpawnMs: [1500, 3000] as [number, number],
  spawnGapMs: [1800, 4000] as [number, number],
  lifeMs: [5000, 8000] as [number, number],
  lightningSlowMs: 850, lightningMul: 0.5,
  fartRange: 90, fartSlowMs: 1000, fartMul: 0.55,
  shellStunMs: 750,
  starBoost: 1.4, starMs: 2400,
};

export interface ItemSystem {
  boxes: ItemBoxState[];
  nextBoxFrame: number;
  boxCounter: number;
  boxRng: Rng;
}

export function createItemSystem(boxRng: Rng): ItemSystem {
  return {
    boxes: [],
    nextBoxFrame: 0,
    boxCounter: 0,
    boxRng,
  };
}

export function updateBoxes(
  system: ItemSystem,
  racers: RacerState[],
  frame: number,
  trackLength: number,
  events: SkillEvent[],
): void {
  // Expire old boxes
  system.boxes = system.boxes.filter(b => frame <= b.expire);

  // Collect boxes
  const collected = new Set<string>();
  for (const self of racers) {
    if (self.phase === 'finished' || self.phase === 'waiting' || self.phase === 'stunned' || self.phase === 'eliminated') continue;
    
    const lapProgress = self.progress % trackLength;
    for (const box of system.boxes) {
      if (collected.has(box.id)) continue;
      if (Math.abs(lapProgress - box.progress) > ITEM.collectDist) continue;
      if (Math.abs(self.lane - box.lane) > ITEM.collectLane) continue;

      collected.add(box.id);
      applyItemPickup(self, racers, box, frame, events, system);
    }
  }
  if (collected.size) system.boxes = system.boxes.filter(b => !collected.has(b.id));

  // Spawn new box
  if (frame >= system.nextBoxFrame && system.boxes.length < ITEM.maxBoxes) {
    system.boxes.push({
      id: `box${system.boxCounter++}`,
      progress: system.boxRng.range(0.12, 0.95) * trackLength,
      lane: system.boxRng.range(0.12, 0.88),
      expire: frame + Math.round(system.boxRng.range(...ITEM.lifeMs) / 16.67),
    });
    system.nextBoxFrame = frame + Math.round(system.boxRng.range(...ITEM.spawnGapMs) / 16.67);
  }
}

function applyItemPickup(
  self: RacerState,
  racers: RacerState[],
  box: ItemBoxState,
  frame: number,
  events: SkillEvent[],
  system: ItemSystem,
): void {
  const irng = system.boxRng.fork(`pickup:${self.id}:${box.id}`);
  const x = irng.range(0, 8);

  if (x < 1) {
    // Star
    const until = frame + Math.round(ITEM.starMs / 16.67);
    self.skill.burst = ITEM.starBoost;
    self.skill.effectUntil = until;
    self.skill.starUntil = until;
    self.phase = 'straying';
    events.push({ frame, racerId: self.id, type: 'item', variant: 'star', line: '무적! ⭐' });
  }
  // ... other items
}
```

### 3.3 메인 루프 정리

**RaceEngine.ts (리팩토링 후)**
```typescript
// src/engine/RaceEngine.ts
import { createRng } from './prng';
import { createAdvanceSystem } from './core/AdvanceSystem';
import { createSkillSystem } from './core/SkillSystem';
import { createItemSystem, updateBoxes } from './systems/ItemSystem';
import { createIceSystem, updateIce } from './systems/IceSystem';
import { createDecoySystem, updateDecoys } from './systems/DecoySystem';
import { createEliminationSystem, applyEliminations } from './systems/EliminationSystem';
import type { RaceConfig, RaceEngine as RaceEngineInterface, EngineFrame, RaceResult } from './types';
import type { SkillRegistry } from './skills/types';
import type { ScoringRegistry } from './scoring/types';

export function createRaceEngine(
  config: RaceConfig,
  skills: SkillRegistry,
  scoring: ScoringRegistry,
): RaceEngineInterface {
  const rng = createRng(config.seed);
  
  // Initialize systems
  const advanceSystem = createAdvanceSystem();
  const skillSystem = createSkillSystem();
  const itemSystem = createItemSystem(rng.fork('boxes'));
  const iceSystem = createIceSystem(rng);
  const decoySystem = createDecoySystem(rng);
  const eliminationSystem = createEliminationSystem(config);

  let frame = 0;
  let raceResult: RaceResult | null = null;

  return {
    config,
    get frameIndex() { return frame; },
    get finished() { return isRaceFinished(); },
    
    step(): EngineFrame {
      if (this.finished) return snapshot([]);
      
      const events: SkillEvent[] = [];
      const order = getSortedRacers();
      
      // 1. Resolve timers
      for (const racer of order) resolveTimer(racer);
      
      // 2. Fire skills
      for (const racer of order) fireSkill(racer, events);
      
      // 3. Update mean progress
      const meanProgress = calculateMeanProgress();
      const spreadBehind = calculateSpreadBehind();
      
      // 4. Advance racers
      for (const racer of order) {
        advanceSystem.advance(racer, this.racers, {
          racerRng: this.racerRng,
          frame,
          meanProgress,
          trackLength: config.trackLength,
          spreadBehind,
        });
      }
      
      // 5. Fire overtake hooks
      fireOvertakeHooks(events);
      
      // 6. Apply eliminations
      applyEliminations(events);
      
      // 7. Update decoys
      updateDecoys(this.decoys, events);
      
      // 8. Update ice
      updateIce(this.iceZones, events);
      
      // 9. Update boxes
      updateBoxes(itemSystem, this.racers, frame, config.trackLength, events);
      
      // 10. Snapshot
      const f = snapshot(events);
      frame++;
      
      if (this.finished && !raceResult) raceResult = buildResult();
      return f;
    },
    
    current(): EngineFrame { return snapshot([]); },
    result(): RaceResult | null { return raceResult; },
  };
}
```

---

## 단계 4-6: 상세 가이드

각 단계는 위와 유사한 패턴으로 진행:
1. **테스트 먼저 작성**
2. **작은 단위로 코드 분리**
3. **각 단계마다 테스트 통과 확인**
4. **인터페이스 명확화**

---

## 🎯 성공 기준

- [ ] 모든 모듈이 독립적인 단위테스트 보유
- [ ] 각 파일 400 줄 이하
- [ ] 커버리지 80%+
- [ ] 기존 테스트 100% 통과
- [ ] 빌드 시간 ±10% 이내
- [ ] 프레임 시간 ±5% 이내

---

**다음**: 단계별 구현 시작 (테스트 먼저!)

**최종 업데이트**: 2026-06-23
