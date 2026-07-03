import type { CharacterData } from '../schema.ts';

export const spider: CharacterData = {
  id: 'spider',
  name: '거미',
  visualType: 'parts',
  visualRef: 'woodada-spider.svg',
  partModelId: 'spider',
  proportions: { headBody: '2등신', bigEyes: true },
  palette: {
    base: '#9B7FD4', // bright pastel lavender body (was dark #4A3B66)
    point: '#D6C5F5', // soft lilac belly / leg accents (lightened)
    outline: '#5A4488', // soft plum outline, not harsh black (was #241A38)
    cheek: '#FF9EB4', // rosier blush (was #E89AA0)
    leg: '#7B62B8', // friendly lilac legs (instead of dark outline)
    web: '#F2F0FA', // sticky web silk (FX/leg tips), slight lilac tint
  },
  // Skitter runStyle: many-legged scuttle. Sticky disruptor — slow itself but
  // tough; it doesn't sprint, it yanks the leader back into the pack.
  runStyle: 'skitter',
  renderScale: 0.9,
  // Web-trapping disruptor: curve specialist — hangs back on the straights, reels them in through the bends.
  cornering: 5,
  // 벽타기: clings anywhere, so swinging onto the outer rail through a curve costs it less distance —
  // synergises with its curve mastery (run wide AND keep pace in the bends). Started at 0.3 (not the
  // initially-floated 0.5): at laps=10 a grip ≥0.4 perturbs start-slot distance enough to break the
  // loose slot-fairness gate (one slot starves below floor); 0.3 holds with margin and keeps the
  // spider win-rate ~unchanged (flavor, not a power spike). Final strength = balance pass.
  outerGrip: 0.3,

  skill: {
    // Web abduct (단일표적 위치강등): grab the nearest racer meaningfully ahead
    // and yank them behind the spider (progress demotion), then leave them
    // tangled in web (speed *= tangleMul for tangleMs). New role on the roster:
    // single-target *positional* demotion (others stun/shove/slow in place).
    // immuneMs guards relay chain-grabs. Values provisional — balance-tuner tunes.
    // Units: range/minRange/pullGap are ABSOLUTE progress (trackLength=1000), like
    // divebomb (range 70/minRange 16) — NOT lap fractions. tangleMul (0..1 mult),
    // tangleMs/immuneMs (ms). Values per engine-dev's abduct contract; balance-tuner
    // does the final tuning (catch within range, yank pullGap behind the spider).
    type: 'abduct',
    // 개인전(밀집 필드) 스타브 → 선두를 더 먼 곳에서/자주 낚아채 상대 위치 강등.
    // cooldown [3000,5000]→[2600,4300], range 130→155, pullGap 14→26.
    // (170/36 이상은 2기 낚아채기 루프로 경주 무한정체 → 안전권으로 제한.)
    // 엔진 보강(engine-dev): abduct 성공 시 거미 자기 자신에게도 바퀴 수 비례 가속
    // (selfBurst × (1 + lapsDone×selfBurstGrowth))을 부여 — 상대 위치강등만 하고
    // 자기추진이 없어 장거리에서 뒤처지던 구조적 약점을 보완(곰 roar와 동일 패턴).
    // laps=1/3 floor는 이미 통과선 이상이라 base selfBurst는 작게, growth로 장거리만 보강.
    cooldownMs: [2600, 4300],
    params: {
      range: 155,
      minRange: 16,
      pullGap: 26,
      tangleMul: 0.55,
      tangleMs: 900,
      immuneMs: 1000,
      selfBurst: 0.2,
      selfBurstMs: 1000,
      selfBurstGrowth: 0.35,
      lapDistance: 1000,
    },
  },
  lines: {
    skill: '거기 서! 줄로 콱! 🕸️',
    win: '다 내 거미줄 안이었어~',
    lose: '줄이… 끊겼다…',
    dodge: '어라, 빠져나갔네?',
  },
};
