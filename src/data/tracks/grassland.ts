import type { TrackTheme } from './schema.ts';

/**
 * 🌿 Grassland — lively sports-day / field-festival arena.
 *
 * Palette is kept VERBATIM from the original hardcoded TrackScene (the classic
 * look players already know):
 *   surface  = tatan track band   0xd2452f
 *   kerb     = inner orange edge  0xe8923c
 *   infield  = grass field        0x7ec46f
 *   infieldEdge = darker core     0x68b25b
 *   laneLine = white lines        0xffffff
 *   sky/bg   = grass surround      0x6fae6a (flat → top==bottom)
 *
 * Decor was previously empty (regression-free). The festival props below are
 * additive only — colors/track untouched — so the running surface stays
 * pixel-identical; props live on the sky/stands backdrop (top band) and on the
 * open infield only, never on the track band.
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

  decor: [
    // Bright field-day sun + a couple of soft clouds across the top backdrop.
    { kind: 'sun', x: 0.88, y: 0.13, scale: 1 },
    { kind: 'cloud', x: 0.18, y: 0.1, scale: 1 },
    { kind: 'cloud', x: 0.55, y: 0.08, scale: 0.8 },
    // Festival bunting (flag garland) strung across the very top — reads as a
    // sports-day banner. Two spans give it width without crowding.
    { kind: 'bunting', x: 0.06, y: 0.04, scale: 1 },
    { kind: 'bunting', x: 0.5, y: 0.04, scale: 1 },
    // Flower clumps on the open infield center (clear of the lanes) for pops of
    // color on the green field.
    { kind: 'flower', x: 0.5, y: 0.52, scale: 1 },
  ],
  ambient: 'petals',
};
