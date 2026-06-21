import type { CharacterData } from '../schema.ts';

export const bear: CharacterData = {
  id: 'bear',
  name: '곰',
  visualType: 'parts',
  visualRef: 'woodada-bear.svg',
  partModelId: 'bear',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#7B5536',
    point: '#E6CDA6',
    outline: '#4A3320',
    cheek: '#E89AA0',
    nose: '#3A2A1E',
  },
  runStyle: 'biped',
  renderScale: 1.15,
  // Tank: very slow cruise, but immovable — shrugs off disruption and traffic.
  // (speed 1→2: at 10 laps the slowest-cruise gap compounded so badly the bear
  // fell below the can-win floor; still bottom-tier cruise, just less buried.)
  speed: 2,
  power: 5,
  skill: {
    type: 'roar',
    // Roar that staggers every racer within range for staggerMs. Widened range +
    // longer stagger + faster recharge so the tank's only offence actually bites
    // the pack over long races (was a near-dead char at laps=10).
    cooldownMs: [3000, 5200],
    params: { range: 22, staggerMs: 430 },
  },
  lines: { skill: '크아앙!!', win: '으르렁!', lose: '끄응…' },
};
