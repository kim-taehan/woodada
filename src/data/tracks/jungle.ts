import type { TrackTheme } from './schema.ts';

/** 🌴 Jungle — dirt track, deep-green canopy infield, big leaves & vines. */
export const jungle: TrackTheme = {
  id: 'jungle',
  label: '정글',
  emoji: '🌴',

  surface: 0xa9794a, // dirt path track
  surfaceAlt: 0x9c6d40,
  infield: 0x2f7d3f, // deep green growth
  infieldEdge: 0x215c2e,
  laneLine: 0xe8dcc0,
  kerb: 0x6e4a28, // mud rim
  skyTop: 0x3aa05a,
  skyBottom: 0x88c98c,

  decor: [
    { kind: 'leaf', x: 0.08, y: 0.12, scale: 1.1 },
    { kind: 'leaf', x: 0.88, y: 0.1, scale: 1 },
    { kind: 'vine', x: 0.4, y: 0.04, scale: 1 },
    { kind: 'vine', x: 0.66, y: 0.04, scale: 0.85 },
  ],
  ambient: 'fireflies',
};
