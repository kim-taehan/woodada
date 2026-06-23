import type { PartModel } from './types.ts';

const WHITE = '#FFFAF0';  // floral white — matches palette tailTip
const BELLY = '#F5DEB3';  // wheat cream — matches palette point
const FARLEG = '#C4975A'; // medium sand — darker than base (#DEB887) for depth
const EYE = '#3D2B1F';    // matches palette eye
const HI = '#FFFFFF';
const TAIL_TIP = '#FFFAF0'; // matches palette tailTip
const OUTLINE = '#8B6914';  // matches palette outline

/**
 * Cute side-profile fox (구미호) — faces +x; renderer flips to match travel direction.
 * Baby-schema proportions: oversized head with a distinctly foxy pointed-wedge face,
 * tall pricked ears, slim body, slender legs, and nine fluffy tails fanned behind.
 *
 * Key fox-vs-pig differences locked in:
 *  - Head is a forward-tapered wedge (ellipse), NOT a round circle.
 *  - Muzzle is long, narrow, and pointed; nose is a tiny dark dot at the tip.
 *  - White muzzle underside + white chest patch — classic fox mask markings.
 *  - Ears are tall sharp triangles, angled back ("alert").
 *  - Body is slim/elongated (ry reduced); legs are slender (rx reduced).
 *  - Tails: 9 plumes in a fan; tail1 (topmost) is the showpiece — wide and fluffy.
 */
export const foxModel: PartModel = {
  id: 'fox',
  parts: [
    // ── Nine tails fanned behind the body ────────────────────────────────────
    // Layered z=0 (bottom/tail9) → z=8 (top/tail1). Angles spread bottom-to-top.
    {
      name: 'tail9',
      pivot: { x: -28, y: 28 },
      z: 0,
      shapes: [
        { kind: 'path', d: 'M-24,32 Q-68,46 -76,24 Q-68,8 -58,20 Q-64,28 -54,30 Q-44,34 -24,28 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -70, cy: 20, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail8',
      pivot: { x: -28, y: 26 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M-24,28 Q-72,30 -74,8 Q-64,-4 -54,8 Q-62,18 -50,22 Q-40,26 -24,22 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -68, cy: 4, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail7',
      pivot: { x: -28, y: 24 },
      z: 2,
      shapes: [
        { kind: 'path', d: 'M-24,26 Q-72,14 -70,-10 Q-58,-22 -50,-6 Q-60,2 -48,12 Q-38,18 -24,18 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -64, cy: -14, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail6',
      pivot: { x: -28, y: 22 },
      z: 3,
      shapes: [
        { kind: 'path', d: 'M-24,24 Q-70,2 -64,-20 Q-50,-32 -44,-14 Q-56,-8 -44,4 Q-34,14 -24,14 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -58, cy: -24, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail5',
      pivot: { x: -28, y: 20 },
      z: 4,
      shapes: [
        { kind: 'path', d: 'M-24,22 Q-64,-10 -54,-34 Q-40,-40 -36,-22 Q-50,-18 -40,-4 Q-32,8 -24,10 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -48, cy: -36, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail4',
      pivot: { x: -26, y: 20 },
      z: 5,
      shapes: [
        { kind: 'path', d: 'M-22,22 Q-54,-20 -40,-44 Q-26,-48 -24,-30 Q-40,-28 -32,-12 Q-26,0 -20,8 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -34, cy: -46, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail3',
      pivot: { x: -24, y: 20 },
      z: 6,
      shapes: [
        { kind: 'path', d: 'M-20,22 Q-42,-28 -24,-50 Q-10,-52 -10,-34 Q-26,-32 -22,-16 Q-18,0 -16,8 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -18, cy: -50, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail2',
      pivot: { x: -22, y: 22 },
      z: 7,
      shapes: [
        { kind: 'path', d: 'M-18,24 Q-28,-30 -8,-48 Q6,-48 4,-30 Q-12,-28 -10,-12 Q-8,2 -12,10 Z', fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -2, cy: -46, rx: 7, ry: 5, fill: TAIL_TIP, opacity: 0.9 },
      ],
    },
    {
      name: 'tail1',
      pivot: { x: -20, y: 24 },
      z: 8,
      shapes: [
        // Topmost showpiece tail — wide and fluffy, clearly foxy
        { kind: 'path', d: 'M-16,28 Q-10,-32 16,-44 Q32,-42 26,-24 Q8,-26 4,-8 Q-2,8 -8,14 Z', fill: 'base', stroke: OUTLINE, strokeW: 2.5 },
        // Prominent white tip at the end of the topmost tail
        { kind: 'ellipse', cx: 22, cy: -34, rx: 10, ry: 7, fill: TAIL_TIP, opacity: 0.95 },
      ],
    },

    // ── Far-side legs — slender ──────────────────────────────────────────────
    {
      name: 'legR',
      pivot: { x: -16, y: 44 },
      z: 9,
      shapes: [
        { kind: 'ellipse', cx: -16, cy: 55, rx: 5.5, ry: 12, fill: FARLEG, stroke: OUTLINE, strokeW: 1.8 },
        { kind: 'ellipse', cx: -16, cy: 66, rx: 7, ry: 4.5, fill: FARLEG, stroke: OUTLINE, strokeW: 1.5 },
      ],
    },
    {
      name: 'frontLegR',
      pivot: { x: 18, y: 44 },
      z: 9,
      shapes: [
        { kind: 'ellipse', cx: 18, cy: 55, rx: 5.5, ry: 12, fill: FARLEG, stroke: OUTLINE, strokeW: 1.8 },
        { kind: 'ellipse', cx: 18, cy: 66, rx: 7, ry: 4.5, fill: FARLEG, stroke: OUTLINE, strokeW: 1.5 },
      ],
    },

    // ── Body — slim and elongated ────────────────────────────────────────────
    {
      name: 'body',
      pivot: { x: -2, y: 30 },
      z: 10,
      shapes: [
        // Slim torso: rx kept wide for length, ry reduced to avoid pig roundness
        { kind: 'ellipse', cx: -2, cy: 30, rx: 30, ry: 18, fill: 'base', stroke: OUTLINE, strokeW: 2.5 },
        // White chest patch — classic fox marking
        { kind: 'ellipse', cx: 8, cy: 34, rx: 14, ry: 9, fill: WHITE, opacity: 0.85 },
        // Gold tinge over chest
        { kind: 'ellipse', cx: 8, cy: 35, rx: 10, ry: 6, fill: BELLY, opacity: 0.5 },
      ],
    },

    // ── Near-side legs — slender ─────────────────────────────────────────────
    {
      name: 'legL',
      pivot: { x: -10, y: 44 },
      z: 11,
      shapes: [
        { kind: 'ellipse', cx: -10, cy: 56, rx: 6, ry: 13, fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: -10, cy: 68, rx: 7.5, ry: 4.5, fill: WHITE },
      ],
    },
    {
      name: 'frontLegL',
      pivot: { x: 24, y: 46 },
      z: 11,
      shapes: [
        { kind: 'ellipse', cx: 24, cy: 58, rx: 6, ry: 13, fill: 'base', stroke: OUTLINE, strokeW: 2 },
        { kind: 'ellipse', cx: 24, cy: 70, rx: 7.5, ry: 4.5, fill: WHITE },
      ],
    },

    // ── Ears — tall, pricked, angled back ────────────────────────────────────
    {
      name: 'earL',
      pivot: { x: 24, y: -18 },
      z: 12,
      shapes: [
        // Tall, sharply pointed triangle ear angled slightly backward
        { kind: 'path', d: 'M24,-16 Q8,-24 18,-70 Q38,-66 50,-20 Q42,-10 24,-16 Z', fill: 'base', stroke: OUTLINE, strokeW: 2.5 },
        // Inner gold stripe
        { kind: 'path', d: 'M22,-20 Q10,-26 20,-62 Q36,-60 44,-22 Z', fill: 'point', opacity: 0.7 },
      ],
    },

    // ── Head — forward-tapered wedge, clearly foxy ───────────────────────────
    {
      name: 'head',
      pivot: { x: 32, y: 2 },
      z: 13,
      shapes: [
        // Wedge-shaped head: wider at back (cranium), tapering toward muzzle.
        // Use an ellipse offset forward so the back is rounder, front is flatter.
        { kind: 'ellipse', cx: 34, cy: 0, rx: 36, ry: 28, fill: 'base', stroke: OUTLINE, strokeW: 2.5 },
        // Long narrow pointed muzzle — key fox identifier
        { kind: 'ellipse', cx: 72, cy: 12, rx: 18, ry: 7, fill: 'base', stroke: OUTLINE, strokeW: 2 },
        // White muzzle underside (classic fox mask)
        { kind: 'ellipse', cx: 70, cy: 15, rx: 14, ry: 5.5, fill: WHITE, opacity: 0.9 },
        // Blush high on cheek, away from muzzle
        { kind: 'ellipse', cx: 28, cy: 16, rx: 8, ry: 5.5, fill: 'cheek', opacity: 0.5 },
        // Tiny pointed nose at the very tip of the muzzle
        { kind: 'circle', cx: 88, cy: 10, r: 3.5, fill: EYE },
        // Subtle mouth line
        { kind: 'path', d: 'M88,13 Q82,20 74,18', fill: 'none', stroke: OUTLINE, strokeW: 1.4 },
        // Cunning slit eye — narrow, slanted upward toward the ear (gumiho expression)
        { kind: 'path', d: 'M40,-8 Q52,-18 62,-10 Q52,-3 40,-8 Z', fill: EYE },
        { kind: 'circle', cx: 48, cy: -10, r: 4.5, fill: EYE },
        { kind: 'circle', cx: 44, cy: -13, r: 2.5, fill: HI },
        { kind: 'circle', cx: 54, cy: -7, r: 1.5, fill: HI },
      ],
    },
  ],
  poses: {
    idle: {},
    run: {
      // Gallop: legs pump fore-and-aft; tails lift and sway as a fan
      legL:      { rot: -30 },
      legR:      { rot:  26 },
      frontLegL: { rot:  26 },
      frontLegR: { rot: -22 },
      tail1: { rot:  20 },
      tail2: { rot:  15 },
      tail3: { rot:  10 },
      tail4: { rot:   5 },
      tail5: { rot:   0 },
      tail6: { rot:  -5 },
      tail7: { rot: -10 },
      tail8: { rot: -15 },
      tail9: { rot: -18 },
      // Slight head lunge forward
      head: { dx: 5 },
      // Ear pressed back in the wind
      earL: { rot: 12 },
    },
    skill: {
      // Cunning glint — head tilts slyly, tails flare wide as clone splits off
      head: { rot: -8, dx: 7 },
      earL: { rot: -14 },
      tail1: { rot: -32 },
      tail2: { rot: -24 },
      tail3: { rot: -16 },
      tail4: { rot:  -8 },
      tail5: { rot:   2 },
      tail6: { rot:  12 },
      tail7: { rot:  22 },
      tail8: { rot:  32 },
      tail9: { rot:  42 },
    },
    win: {
      // Victory — head raised proudly, tails fan triumphantly
      head: { dy: -10 },
      earL: { rot: -10 },
      tail1: { rot: -30 },
      tail2: { rot: -22 },
      tail3: { rot: -14 },
      tail4: { rot:  -6 },
      tail5: { rot:   4 },
      tail6: { rot:  14 },
      tail7: { rot:  24 },
      tail8: { rot:  34 },
      tail9: { rot:  44 },
    },
    fall: {
      // Stumble — head droops forward, tails sag
      head: { rot: 22 },
      tail1: { rot:  24 },
      tail2: { rot:  18 },
      tail3: { rot:  14 },
      tail4: { rot:  10 },
      tail5: { rot:   6 },
      tail6: { rot:   2 },
      tail7: { rot:  -4 },
      tail8: { rot:  -8 },
      tail9: { rot: -12 },
    },
  },
};
