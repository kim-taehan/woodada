import type { PartModel } from './types.ts';

const BELLY = '#FCEAC8';
const FARLEG = '#E6C896'; // far-side legs, slightly darker for depth
const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute side-profile galloping puppy (faces +x; the renderer flips it to match
 * travel direction). Chibi baby-schema proportions (spec §2.5): an oversized
 * round head, big sparkly eye, blush, tiny snout, a small chunky body and short
 * stubby legs — a front pair + rear pair the renderer swings in a gallop.
 */
export const dogModel: PartModel = {
  id: 'dog',
  parts: [
    {
      name: 'tail',
      pivot: { x: -32, y: 26 },
      z: 0,
      shapes: [
        { kind: 'path', d: 'M-30,30 Q-52,22 -46,2 Q-38,14 -22,20 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
      ],
    },
    {
      name: 'earL',
      pivot: { x: 30, y: -18 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M32,-14 Q12,-30 22,-52 Q40,-44 44,-16 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
      ],
    },
    // Far-side legs (behind the body).
    {
      name: 'legR',
      pivot: { x: -20, y: 44 },
      z: 1,
      shapes: [
        { kind: 'ellipse', cx: -20, cy: 55, rx: 8.5, ry: 12.5, fill: FARLEG, stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -19, cy: 66, rx: 9.5, ry: 5.5, fill: FARLEG, stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      name: 'frontLegR',
      pivot: { x: 16, y: 46 },
      z: 1,
      shapes: [
        { kind: 'ellipse', cx: 16, cy: 57, rx: 8.5, ry: 12.5, fill: FARLEG, stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 17, cy: 68, rx: 9.5, ry: 5.5, fill: FARLEG, stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      name: 'body',
      pivot: { x: -4, y: 32 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: -4, cy: 32, rx: 31, ry: 25, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 0, cy: 40, rx: 20, ry: 13, fill: BELLY },
      ],
    },
    // Near-side legs (in front of the body).
    {
      name: 'legL',
      pivot: { x: -12, y: 46 },
      z: 3,
      shapes: [
        { kind: 'ellipse', cx: -12, cy: 58, rx: 9, ry: 13, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -11, cy: 70, rx: 10, ry: 5.5, fill: BELLY },
      ],
    },
    {
      name: 'frontLegL',
      pivot: { x: 24, y: 48 },
      z: 3,
      shapes: [
        { kind: 'ellipse', cx: 24, cy: 60, rx: 9, ry: 13, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 25, cy: 72, rx: 10, ry: 5.5, fill: BELLY },
      ],
    },
    {
      name: 'head',
      pivot: { x: 40, y: 4 },
      z: 4,
      shapes: [
        { kind: 'circle', cx: 41, cy: 0, r: 36, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 62, cy: 14, rx: 12, ry: 9.5, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 61, cy: 16, rx: 7.5, ry: 5, fill: BELLY },
        { kind: 'ellipse', cx: 38, cy: 17, rx: 9, ry: 6, fill: 'cheek' },
        { kind: 'ellipse', cx: 73, cy: 11, rx: 5.2, ry: 5.8, fill: 'nose' },
        { kind: 'path', d: 'M73,15 Q68,23 60,21', fill: 'none', stroke: 'nose', strokeW: 1.8 },
        { kind: 'ellipse', cx: 58, cy: 23, rx: 5, ry: 7, fill: 'tongue' },
        { kind: 'circle', cx: 47, cy: -3, r: 12, fill: EYE },
        { kind: 'circle', cx: 42, cy: -8, r: 4.8, fill: HI },
        { kind: 'circle', cx: 51, cy: 2, r: 2.2, fill: HI },
      ],
    },
  ],
  poses: {
    idle: {},
    run: {},
    skill: { head: { dx: 5 }, tail: { rot: -16 } },
    win: { head: { dy: -6 }, tail: { rot: -26 } },
    fall: { head: { rot: 16 } },
  },
};
