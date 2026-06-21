import type { TrackTheme } from './schema.ts';

/** 🌊 Beach — wet-sand track, teal sea infield, parasols & rings. */
export const beach: TrackTheme = {
  id: 'beach',
  label: '해변',
  emoji: '🌊',

  surface: 0xe2c79a, // wet sand track
  surfaceAlt: 0xd6b884,
  infield: 0x36b5c4, // teal sea
  infieldEdge: 0x1f93a8,
  laneLine: 0xfffaf0,
  kerb: 0xc9a06a, // sand rim
  skyTop: 0x7fd0e8,
  skyBottom: 0xd6f3fb,

  decor: [
    { kind: 'sun', x: 0.86, y: 0.16, scale: 1 },
    { kind: 'cloud', x: 0.2, y: 0.12, scale: 0.9 },
    // parasols sit on the sandy outer surround (below the bottom straight), not
    // on the track surface — keeps the running lanes clear (schema: decor must
    // not overlap the surface).
    { kind: 'parasol', x: 0.14, y: 0.88, scale: 1 },
    { kind: 'parasol', x: 0.82, y: 0.9, scale: 0.9 },
    { kind: 'tube', x: 0.5, y: 0.5, scale: 0.8 },
  ],
  ambient: 'none',
};
