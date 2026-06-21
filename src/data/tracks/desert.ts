import type { TrackTheme } from './schema.ts';

/** 🏜️ Desert oasis — sandy track, beige dunes, cacti & palms, blazing sun. */
export const desert: TrackTheme = {
  id: 'desert',
  label: '사막 오아시스',
  emoji: '🏜️',

  surface: 0xd9a86a, // packed sand track
  surfaceAlt: 0xce9a5b,
  infield: 0xe6c98c, // pale dune field
  infieldEdge: 0xd8b873,
  laneLine: 0xfff2d8,
  kerb: 0xb5793f, // rocky rim
  skyTop: 0xf6c66a,
  skyBottom: 0xfbe6a8,

  decor: [
    { kind: 'sun', x: 0.84, y: 0.14, scale: 1.2 },
    { kind: 'cactus', x: 0.12, y: 0.2, scale: 1 },
    { kind: 'cactus', x: 0.68, y: 0.1, scale: 0.8 },
    { kind: 'palm', x: 0.3, y: 0.08, scale: 1 },
    { kind: 'palm', x: 0.9, y: 0.46, scale: 0.9 },
  ],
  ambient: 'sand',
};
