import type { CharacterData } from '../schema.ts';

export const eagle: CharacterData = {
  id: 'eagle',
  name: '독수리',
  visualType: 'parts',
  visualRef: 'woodada-eagle.svg',
  partModelId: 'eagle',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    // Golden-eagle tones: a warm russet-gold body, a golden-ivory face/nape,
    // deep near-black wings for strong contrast, and a bright gold beak + talon.
    base: '#7A4F23', // warm russet-gold body
    point: '#EFE0BC', // golden-ivory face / nape (warmer than cold cream)
    outline: '#2A1B0F', // dark, crisp outline
    cheek: '#D98A72', // warm tawny blush
    beak: '#FFB627', // bright gold beak + talons
    wing: '#36240F', // deep near-black wing feathers (strong contrast)
    crest: '#241710', // near-black pointed crest tufts + angry brow
  },
  // Side-profile raptor: a "real bird" silhouette (head faces +x). The 'glide'
  // runStyle mirrors it to travel direction + adds a tilt/hover (no leg cycle —
  // it flies). See src/data/partmodels/eagle.ts.
  runStyle: 'glide',
  renderScale: 0.95,
  // Gambling raptor: fast and aggressive on the charge, lighter on defence.
  speed: 4,
  power: 2,
  skill: {
    // type stays 'divebomb' — mechanic unchanged, only the flavor is now a
    // ground hop + headbutt (see src/engine/skills/divebomb.ts).
    type: 'divebomb',
    cooldownMs: [4500, 7000],
    // Hops up and headbutts the nearest racer just ahead within `range`. A 50/50
    // gamble (`selfRiskChance`): win → stun the target + the eagle keeps the
    // hop's momentum (diveBurst for diveBurstMs); lose → the eagle crashes itself.
    // selfStunMs: shorter self-botch stun than stunMs, so multi-lap self-crashes
    // recover faster and the eagle isn't polarized to last place over many laps.
    // minRange: a target closer than this is skipped — the dive needs runway, so
    // only racers in the minRange..range band are valid (none → hold, no fire).
    params: { range: 70, minRange: 16, stunMs: 720, selfStunMs: 400, selfRiskChance: 0.42, diveBurst: 0.92, diveBurstMs: 850 },
  },
  lines: { skill: '받아랏! 🦅', win: '1등은 내 거다!', lose: '끼…욱…', dodge: '휘릭, 안 맞지롱~' },
};
