import type { CharacterData } from '../schema.ts';

export const penguin: CharacterData = {
  id: 'penguin',
  name: '펭귄',
  visualType: 'parts',
  visualRef: 'woodada-penguin.svg',
  partModelId: 'penguin',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#2B3540', // black back / cap
    point: '#F4F1EA', // white belly / face
    outline: '#161C24',
    cheek: '#F2A6B6',
    beak: '#F2972F', // orange beak + feet
    water: '#5BC8E8', // flood zone tint (renderer FX uses this)
  },
  // Front-facing waddler: biped runStyle gives alternating legs + flipper swing.
  runStyle: 'biped',
  renderScale: 0.9,
  // Roly-poly slider: slow waddle, but heavy and hard to shove around.
  speed: 2,
  power: 4,
  skill: {
    type: 'icefield',
    cooldownMs: [5000, 8000],
    // Lays an ice patch ahead (start = progress + aheadOffset, length zoneLength)
    // for durationMs. Species-based, team-agnostic: penguins glide faster
    // (boostFactor) across it; everyone else slips slower (slowFactor).
    params: { zoneLength: 80, durationMs: 2800, slowFactor: 0.80, boostFactor: 1.06, aheadOffset: 40 },
  },
  lines: {
    skill: '빙판 깔기! 미끌미끌~ 🧊',
    win: '뒤뚱뒤뚱, 1등 펭귄!',
    lose: '미끄러졌다… 삐악…',
    dodge: '얼음은 내 홈이지롱~',
  },
};
