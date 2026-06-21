import type { TrackTheme } from './schema.ts';

/**
 * 🌿 Grassland — the default/classic arena.
 *
 * Colors are copied VERBATIM from the original hardcoded TrackScene so this
 * theme is a pixel-for-pixel regression-free match of the pre-arena look:
 *   surface  = tatan track band   0xd2452f
 *   kerb     = inner orange edge  0xe8923c
 *   infield  = grass field        0x7ec46f
 *   infieldEdge = darker core     0x68b25b
 *   laneLine = white lines        0xffffff
 *   sky/bg   = grass surround      0x6fae6a (flat → top==bottom)
 *   stands ring 0x9aa3b2 stays renderer-internal (not themed).
 */
export const grassland: TrackTheme = {
  id: 'grassland',
  label: '초원',
  emoji: '🌿',

  surface: 0xd2452f,
  infield: 0x7ec46f,
  infieldEdge: 0x68b25b,
  laneLine: 0xffffff,
  kerb: 0xe8923c,
  skyTop: 0x6fae6a,
  skyBottom: 0x6fae6a,

  // No decor: the default arena must render exactly like the original
  // (flat green surround, no props) → zero visual regression.
  decor: [],
  ambient: 'none',
};
