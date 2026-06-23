import type { CharacterData } from '../schema.ts';

export const cat: CharacterData = {
  id: 'cat',
  name: '고양이',
  visualType: 'parts',
  visualRef: 'woodada-cat.svg',
  partModelId: 'cat',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    // Sleek black cat: near-black body with a slate underside, deep outline, and
    // a fierce amber-yellow eye (in the part model) as the sharp accent.
    base: '#1C1E24',
    point: '#34373F',
    outline: '#0C0D11',
    cheek: '#34373F',
    nose: '#D77A8E',
    stripe: '#2A2D34',
  },
  runStyle: 'gallop',
  renderScale: 0.88,
  // Nimble dodger: agile through bends, loses a little on the straights.
  cornering: 4,
  skill: {
    type: 'catwalk',
    cooldownMs: [3000, 5000],
    // Opens a dodge window: during it, each incoming disruption is avoided with
    // `dodgeChance` (not guaranteed), plus a small forward slip (`slipBoost`).
    params: { windowMs: 1350, dodgeChance: 0.52, slipBoost: 0.11 },
  },
  lines: { skill: '캣워크~ 😼', win: '냥, 1등은 내 거지.', lose: '흥, 봐준 거야.', dodge: '냐옹, 안 맞지롱' },
};
