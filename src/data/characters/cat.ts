import type { CharacterData } from '../schema.ts';

export const cat: CharacterData = {
  id: 'cat',
  name: '고양이',
  visualType: 'parts',
  visualRef: 'woodada-cat.svg',
  partModelId: 'cat',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#9AA3AC',
    point: '#EDEEF0',
    outline: '#5C636B',
    cheek: '#F2A6B6',
    nose: '#E58A9C',
    stripe: '#7C858E',
  },
  runStyle: 'gallop',
  renderScale: 0.88,
  skill: {
    type: 'catwalk',
    cooldownMs: [3000, 5000],
    // Opens a dodge window: during it, each incoming disruption is avoided with
    // `dodgeChance` (not guaranteed), plus a small forward slip (`slipBoost`).
    params: { windowMs: 1350, dodgeChance: 0.52, slipBoost: 0.11 },
  },
  lines: { skill: '캣워크~ 😼', win: '냥, 1등은 내 거지.', lose: '흥, 봐준 거야.', dodge: '냐옹, 안 맞지롱' },
};
