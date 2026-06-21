import type { PartModel } from './types.ts';

// Sharp-black-cat accent colors (the palette in cat.ts carries the body tones).
const FARLEG = '#15171C'; // far-side legs, a step darker than `base` for depth
const EYE = '#F5C518'; // fierce amber-yellow iris
const PUPIL = '#101216'; // vertical slit pupil for a sharp predatory read
const RIM = '#3A3F49'; // subtle dark rim-light (keeps the pure-black mood)
const HI = '#FFFFFF';
const INNER_EAR = '#34373F'; // dark slate inner ear

/**
 * Cute side-profile galloping cat (faces +x; the renderer flips it to match
 * travel direction). Same side-quadruped rig as the dog — a far-side pair
 * (legR/frontLegR, drawn slightly darker for depth) and a near-side pair
 * (legL/frontLegL) the `gallop` runStyle swings — but a slimmer, more feline
 * silhouette: a narrow, slightly long body, thin legs, a slender S-curl tail,
 * a triangular ear with a pink inner, whiskers and a heart nose.
 *
 * Sharp black-cat read: a charcoal body, tall pointed ears, a slick silhouette
 * traced by a silver rim-light (so the near-black shape keeps its form over the
 * red track), and a narrowed, sharp lime-yellow eye with a vertical slit pupil
 * for a cool, alert look. Baby-schema (spec §2.5) is still honored — oversized
 * round head, big eye with a highlight dot — but tuned "sleek + sharp" rather
 * than soft. Distinct from the bear (round ears, no whiskers) and monkey
 * (front face).
 */
export const catModel: PartModel = {
  id: 'cat',
  parts: [
    {
      // Slender S-curl tail sweeping back and up behind the body.
      name: 'tail',
      pivot: { x: -28, y: 28 },
      z: 0,
      shapes: [
        // slender S-curl tail, thinner taper with a hooked tip for a clean feline read
        { kind: 'path', d: 'M-26,30 Q-56,30 -56,4 Q-56,-12 -42,-12 Q-50,-8 -49,4 Q-48,20 -24,22 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M-50,-10 Q-44,-10 -44,-2', fill: 'none', stroke: 'stripe', strokeW: 2.5 },
      ],
    },
    {
      // Single tall triangular ear, perked up and sharp for an alert feline read.
      name: 'earL',
      pivot: { x: 34, y: -22 },
      z: 1,
      shapes: [
        // taller, sharper triangular ear with a crisp tip
        { kind: 'path', d: 'M19,-20 L37,-64 L53,-22 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // dark inner ear (no soft pink)
        { kind: 'path', d: 'M27,-22 L37,-50 L45,-23 Z', fill: INNER_EAR },
        // rim-light along the leading edge so the black ear keeps its tip
        { kind: 'line', x1: 37, y1: -62, x2: 21, y2: -22, stroke: RIM, strokeW: 1.6 },
      ],
    },
    // Far-side legs (behind the body), thin and a touch darker for depth.
    {
      name: 'legR',
      pivot: { x: -18, y: 42 },
      z: 1,
      shapes: [
        { kind: 'ellipse', cx: -18, cy: 54, rx: 6, ry: 13, fill: FARLEG, stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -17, cy: 66, rx: 7, ry: 4, fill: FARLEG, stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      name: 'frontLegR',
      pivot: { x: 18, y: 44 },
      z: 1,
      shapes: [
        { kind: 'ellipse', cx: 18, cy: 56, rx: 6, ry: 13, fill: FARLEG, stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 19, cy: 68, rx: 7, ry: 4, fill: FARLEG, stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      // Slim, slightly long feline body (narrower than the dog's round barrel).
      name: 'body',
      pivot: { x: -2, y: 32 },
      z: 2,
      shapes: [
        // slim feline body with a gently arched back line (haunches higher at the rear)
        { kind: 'path', d: 'M-28,32 Q-26,16 -6,15 Q22,14 25,30 Q26,46 6,49 Q-22,50 -28,38 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 2, cy: 40, rx: 16, ry: 8, fill: 'point' },
        // rim-light along the arched back so the black body keeps its silhouette
        { kind: 'path', d: 'M-26,30 Q-24,17 -6,16 Q21,15 24,29', fill: 'none', stroke: RIM, strokeW: 1.8 },
        // faint flank stripes
        { kind: 'path', d: 'M-14,20 Q-12,30 -16,40', fill: 'none', stroke: 'stripe', strokeW: 2.5 },
        { kind: 'path', d: 'M-2,18 Q0,29 -4,40', fill: 'none', stroke: 'stripe', strokeW: 2.5 },
      ],
    },
    // Near-side legs (in front of the body), thin.
    {
      name: 'legL',
      pivot: { x: -11, y: 44 },
      z: 3,
      shapes: [
        { kind: 'ellipse', cx: -11, cy: 57, rx: 6.5, ry: 14, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -10, cy: 70, rx: 7.5, ry: 4, fill: 'point' },
      ],
    },
    {
      name: 'frontLegL',
      pivot: { x: 25, y: 46 },
      z: 3,
      shapes: [
        { kind: 'ellipse', cx: 25, cy: 59, rx: 6.5, ry: 14, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 26, cy: 72, rx: 7.5, ry: 4, fill: 'point' },
      ],
    },
    {
      // Oversized round head in side profile, with a small muzzle.
      name: 'head',
      pivot: { x: 38, y: 2 },
      z: 4,
      shapes: [
        { kind: 'circle', cx: 39, cy: 0, r: 33, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // rim-light tracing the crown/brow so the black head reads on the red track
        { kind: 'path', d: 'M14,-12 Q16,-30 36,-32', fill: 'none', stroke: RIM, strokeW: 1.8 },
        // small muzzle / cheek (slate)
        { kind: 'ellipse', cx: 58, cy: 14, rx: 13, ry: 10, fill: 'point' },
        // small heart-shaped nose at the muzzle tip
        { kind: 'path', d: 'M66,9 L62,5 Q62,2 64,3 L66,5 L68,3 Q70,2 70,5 Z', fill: 'nose' },
        // mouth
        { kind: 'path', d: 'M66,11 Q62,15 57,13', fill: 'none', stroke: 'outline', strokeW: 1.6 },
        // sharp narrowed almond eye — yellow iris + vertical slit pupil for a fierce read
        { kind: 'path', d: 'M37,-3 Q46,-13 56,-2 Q46,3 37,-3 Z', fill: EYE, stroke: 'outline', strokeW: 1.6 },
        { kind: 'ellipse', cx: 47, cy: -3, rx: 2.2, ry: 8, fill: PUPIL },
        { kind: 'circle', cx: 43, cy: -6, r: 2.2, fill: HI },
        // heavy upper lid angled down toward the nose for a glaring, sharp brow
        { kind: 'path', d: 'M35,-7 Q46,-13 57,-4', fill: 'none', stroke: 'outline', strokeW: 2.6 },
        // whiskers fanning forward off the muzzle
        { kind: 'line', x1: 56, y1: 14, x2: 84, y2: 9, stroke: RIM, strokeW: 1.4 },
        { kind: 'line', x1: 56, y1: 18, x2: 84, y2: 20, stroke: RIM, strokeW: 1.4 },
      ],
    },
  ],
  poses: {
    idle: {},
    run: {},
    // catwalk: chin held high + tail lofted in a proud curl + a dainty lifted front paw
    skill: { head: { dy: -5, rot: -6 }, body: { dy: -2 }, tail: { rot: -30 }, frontLegL: { rot: 26 }, earL: { rot: -8 } },
    win: { head: { dy: -6 }, tail: { rot: -28 } },
    fall: { head: { rot: 16 }, tail: { rot: 20 } },
  },
};
