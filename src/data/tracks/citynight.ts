import type { TrackTheme } from './schema.ts';

/**
 * 🏙️ City night — dark rooftop track with neon lines, skyscrapers, moon.
 * Readability: the surface is a mid-dark slate (NOT near-black) so the bright
 * chibi characters keep strong contrast; neon-cyan lane lines pop on it.
 */
export const citynight: TrackTheme = {
  id: 'citynight',
  label: '도시 야경',
  emoji: '🏙️',

  surface: 0x444a63, // mid slate rooftop — kept light enough for char contrast
  surfaceAlt: 0x3c4259,
  infield: 0x232842, // dark rooftop core
  infieldEdge: 0x1a1e33,
  laneLine: 0x4ff0ff, // neon cyan
  kerb: 0x6b73a0,
  skyTop: 0x121636,
  skyBottom: 0x2a2350,

  decor: [
    { kind: 'moon', x: 0.85, y: 0.14, scale: 1 },
    { kind: 'building', x: 0.1, y: 0.18, scale: 1.1 },
    { kind: 'building', x: 0.32, y: 0.1, scale: 0.9 },
    { kind: 'building', x: 0.58, y: 0.16, scale: 1 },
    { kind: 'building', x: 0.74, y: 0.08, scale: 0.85 },
  ],
  ambient: 'none',
};
