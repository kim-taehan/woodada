import type { TrackTheme } from './schema.ts';

/** ❄️ Snowfield — pale icy-blue track, snow infield, pines & snowmen. */
export const snow: TrackTheme = {
  id: 'snow',
  label: '설원',
  emoji: '❄️',

  surface: 0xbfe0ef, // pale ice track
  surfaceAlt: 0xb0d6e8,
  infield: 0xf2f7fb, // snow field
  infieldEdge: 0xdde9f1,
  laneLine: 0x8fc4dd,
  kerb: 0x9fc6da, // packed-ice rim
  skyTop: 0xa9cfe4,
  skyBottom: 0xeaf4fb,

  decor: [
    { kind: 'cloud', x: 0.22, y: 0.12, scale: 1 },
    { kind: 'pine', x: 0.1, y: 0.22, scale: 1 },
    { kind: 'pine', x: 0.78, y: 0.12, scale: 0.9 },
    { kind: 'snowman', x: 0.5, y: 0.5, scale: 0.85 },
  ],
  ambient: 'snow',
};
