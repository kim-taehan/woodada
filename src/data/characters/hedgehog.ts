import type { CharacterData } from '../schema.ts';

export const hedgehog: CharacterData = {
  id: 'hedgehog',
  name: '고슴도치',
  visualType: 'parts',
  visualRef: 'woodada-hedgehog.svg',
  partModelId: 'hedgehog',
  proportions: { headBody: '2.5등신', bigEyes: true },
  palette: {
    base: '#9C6B3F', // brown spikes running down the back
    point: '#F3E2C7', // cream face / belly / legs
    outline: '#4A3320',
    cheek: '#E89AA0',
    nose: '#3A2A1E',
  },
  // Side-profile prickly defender: gallop runStyle gives a low four-legged scurry
  // (front pair + rear pair), spikes bristling along the back.
  runStyle: 'gallop',
  renderScale: 0.95,
  // Prickly defender: slow scurry, but tough — spikes shrug off shoves + traffic.
  speed: 2,
  power: 4,
  skill: {
    // Bristle (반응형 카운터 연출): on a short cooldown, if a racer is chasing just
    // behind within `range`, the hedgehog flares its spikes — `triggerChance` to
    // shove that chaser back (progress -= pushBack) and slow them (speed *= slowMul
    // for slowMs). A spiky recoil also nudges the hedgehog itself forward
    // (recoilBurst for recoilMs) so it isn't purely defensive (keeps it off the
    // win-rate floor). The mechanic is the engine `onOvertaken` hook (TODO #7):
    // it fires the exact frame a non-teammate crosses ahead of the hedgehog, so
    // triggerChance is the per-overtake counter odds. Values are provisional —
    // balance-tuner does the final tuning.
    type: 'bristle',
    cooldownMs: [1500, 2500],
    params: { range: 40, triggerChance: 0.75, pushBack: 10, slowMs: 600, slowMul: 0.6, recoilBurst: 0.42, recoilMs: 700 },
  },
  lines: {
    skill: '따끔! 붙지 마! 🦔',
    win: '가까이 오지 말랬지?',
    lose: '으… 가시가 무뎌졌나…',
    dodge: '내 등은 못 건드려~',
  },
};
