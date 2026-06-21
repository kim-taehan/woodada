import type { TrackTheme } from './schema.ts';

/** 🌊 Beach — wet-sand track, bright turquoise sea infield, full seaside set. */
export const beach: TrackTheme = {
  id: 'beach',
  label: '해변',
  emoji: '🌊',

  surface: 0xe2c79a, // wet sand track
  surfaceAlt: 0xd6b884,
  // Brighter, more refreshing turquoise sea (was 0x36b5c4 / 0x1f93a8).
  infield: 0x2fcad6, // bright turquoise sea
  infieldEdge: 0x18a6c0, // cooler deep-water core
  laneLine: 0xfffaf0,
  kerb: 0xc9a06a, // sand rim
  skyTop: 0x7fd0e8,
  skyBottom: 0xd6f3fb,

  decor: [
    // Sky backdrop: sun, a cloud, and a pair of gulls gliding across the top.
    { kind: 'sun', x: 0.86, y: 0.14, scale: 1 },
    { kind: 'cloud', x: 0.2, y: 0.12, scale: 0.9 },
    { kind: 'seagull', x: 0.42, y: 0.09, scale: 1 },
    { kind: 'seagull', x: 0.56, y: 0.13, scale: 0.8 },
    // Parasols on the sandy outer surround (below the bottom straight), NOT on
    // the track surface — keeps the lanes clear (schema: decor off the surface).
    { kind: 'parasol', x: 0.12, y: 0.88, scale: 1 },
    { kind: 'parasol', x: 0.86, y: 0.9, scale: 0.9 },
    // Sandcastle + starfish nestle in the bottom sand corner, clear of the band.
    { kind: 'sandcastle', x: 0.5, y: 0.94, scale: 1 },
    { kind: 'starfish', x: 0.3, y: 0.92, scale: 0.9 },
    // Beach toys floating on the open sea infield (center, clear of the lanes).
    { kind: 'tube', x: 0.4, y: 0.5, scale: 0.8 },
    { kind: 'beachball', x: 0.6, y: 0.52, scale: 0.9 },
  ],
  ambient: 'sand',
};
