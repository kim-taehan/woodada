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
  // Web-trapping disruptor: low cruise speed, sturdy (resists shoves/traffic).
  speed: 2,
  power: 4,
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
    cooldownMs: [2600, 4200],
    // pullGap: 거미 '바로 뒤'에 떨군다(작은 간격 — 레인이 달라 겹치지 않음). 이전 90(≈9%)에서
    // 축소 → 멀리 내던지지 않고 표적을 자기 등 뒤로 바짝 끌어붙인다.
    params: { range: 130, minRange: 16, pullGap: 14, tangleMul: 0.55, tangleMs: 900, immuneMs: 1000 },
  },
  lines: {
    skill: '거기 서! 줄로 콱! 🕸️',
    win: '다 내 거미줄 안이었어~',
    lose: '줄이… 끊겼다…',
    dodge: '어라, 빠져나갔네?',
  },
};
