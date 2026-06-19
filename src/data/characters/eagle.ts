import type { CharacterData } from '../schema.ts';

export const eagle: CharacterData = {
  id: 'eagle',
  name: '독수리',
  visualType: 'parts',
  visualRef: 'woodada-eagle.svg',
  partModelId: 'eagle',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    // Raptor tones, contrast pushed vs the penguin's soft black-and-white: a
    // deep chocolate body, a bright cream face/breast, a sharp golden beak +
    // talon, and a near-black crest for the angular feather tufts.
    base: '#5E3F26', // deep chocolate-brown body
    point: '#F6F2E6', // bright cream face / breast
    outline: '#2E2013', // dark, crisp outline
    cheek: '#E08A86', // muted blush (less candy than the penguin's pink)
    beak: '#F6A81E', // sharp golden-orange beak + talons
    wing: '#43301D', // darker wing feathers (more contrast against the body)
    crest: '#2A1D12', // near-black pointed crest tufts + angry brow
  },
  // Ground runner: front-facing biped (talon feet, folded wings swing like the
  // penguin's flippers). renderer 'biped' runStyle drives the leg/wing cycle.
  runStyle: 'biped',
  renderScale: 0.95,
  skill: {
    // type stays 'divebomb' — mechanic unchanged, only the flavor is now a
    // ground hop + headbutt (see src/engine/skills/divebomb.ts).
    type: 'divebomb',
    cooldownMs: [4500, 7000],
    // Hops up and headbutts the nearest racer just ahead within `range`. A 50/50
    // gamble (`selfRiskChance`): win → stun the target + the eagle keeps the
    // hop's momentum (diveBurst for diveBurstMs); lose → the eagle crashes itself.
    params: { range: 70, stunMs: 720, selfRiskChance: 0.47, diveBurst: 0.92, diveBurstMs: 850 },
  },
  lines: { skill: '받아랏! 🦅', win: '1등은 내 거다!', lose: '끼…욱…', dodge: '휘릭, 안 맞지롱~' },
};
