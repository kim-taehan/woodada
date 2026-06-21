import type { PartModel } from './types.ts';

const FARLEG = '#838B94'; // far-side legs, a step darker than `base` for depth
const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute side-profile galloping cat (faces +x; the renderer flips it to match
 * travel direction). Same side-quadruped rig as the dog — a far-side pair
 * (legR/frontLegR, drawn slightly darker for depth) and a near-side pair
 * (legL/frontLegL) the `gallop` runStyle swings — but a slimmer, more feline
 * silhouette: a narrow, slightly long body, thin legs, a slender S-curl tail,
 * a triangular ear with a pink inner, whiskers and a heart nose.
 *
 * Baby-schema (spec §2.5) is pushed: an oversized round head, a big sparkly
 * eye with a highlight dot, and a clear cheek blush — kept "aloof + cute" with
 * a half-lidded upper lid so the cat still reads as haughty, not goofy.
 * Distinct from the bear (round ears, no whiskers) and monkey (front face).
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
      // Single triangular ear (with pink inner), perked up on the head.
      name: 'earL',
      pivot: { x: 34, y: -22 },
      z: 1,
      shapes: [
        // taller, sharper triangular ear with a crisp tip for an alert feline read
        { kind: 'path', d: 'M20,-20 L36,-60 L52,-22 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M27,-22 L36,-48 L45,-23 Z', fill: 'cheek' },
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
        // tabby flank stripes
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
        // forehead tabby stripe
        { kind: 'path', d: 'M34,-30 L37,-16', fill: 'none', stroke: 'stripe', strokeW: 3 },
        // small muzzle / cheek
        { kind: 'ellipse', cx: 58, cy: 14, rx: 13, ry: 10, fill: 'point' },
        // cheek blush
        { kind: 'ellipse', cx: 40, cy: 16, rx: 7, ry: 4.5, fill: 'cheek', opacity: 0.85 },
        // heart-shaped pink nose at the muzzle tip
        { kind: 'path', d: 'M66,9 L62,5 Q62,2 64,3 L66,5 L68,3 Q70,2 70,5 Z', fill: 'nose' },
        // mouth
        { kind: 'path', d: 'M66,11 Q62,15 57,13', fill: 'none', stroke: 'outline', strokeW: 1.6 },
        // big aloof almond eye, rounder + larger for a babier chibi read + highlight
        { kind: 'ellipse', cx: 46, cy: -2, rx: 9, ry: 10.5, fill: EYE },
        { kind: 'circle', cx: 42, cy: -7, r: 3.6, fill: HI },
        { kind: 'circle', cx: 49, cy: 1, r: 1.8, fill: HI },
        // crisp upper lid for a sleepy / haughty look
        { kind: 'path', d: 'M36,-7 Q46,-12 56,-5', fill: 'none', stroke: 'outline', strokeW: 2.2 },
        // whiskers fanning forward off the muzzle
        { kind: 'line', x1: 56, y1: 14, x2: 84, y2: 9, stroke: 'outline', strokeW: 1.4 },
        { kind: 'line', x1: 56, y1: 18, x2: 84, y2: 20, stroke: 'outline', strokeW: 1.4 },
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
