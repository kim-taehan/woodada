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
        // perky curled tail, fuller arc so the wag reads at a glance
        { kind: 'path', d: 'M-28,30 Q-58,24 -54,-4 Q-44,-12 -40,2 Q-50,2 -44,18 Q-38,26 -22,22 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M-30,26 Q-50,20 -48,2', fill: 'none', stroke: 'cheek', strokeW: 2.5, opacity: 0.5 },
      ],
    },
    {
      // floppy ear hinged high on the head; a long teardrop that reads clearly
      // as it flutters back during the gallop (pivot up top so swing is legible).
      name: 'earL',
      pivot: { x: 30, y: -20 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M30,-18 Q6,-30 14,-58 Q34,-54 46,-22 Q40,-12 30,-18 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M28,-22 Q14,-30 20,-48 Q30,-44 36,-24 Z', fill: 'cheek', opacity: 0.55 },
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
        // bigger round cranium for a stronger chibi head-to-body ratio
        { kind: 'circle', cx: 41, cy: -1, r: 39, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // rounded muzzle puff
        { kind: 'ellipse', cx: 64, cy: 15, rx: 13, ry: 10.5, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 63, cy: 17, rx: 8, ry: 5.5, fill: BELLY },
        { kind: 'ellipse', cx: 36, cy: 19, rx: 9.5, ry: 6.5, fill: 'cheek' },
        { kind: 'ellipse', cx: 76, cy: 11, rx: 5.6, ry: 6.2, fill: 'nose' },
        { kind: 'path', d: 'M76,16 Q70,24 62,22', fill: 'none', stroke: 'nose', strokeW: 1.8 },
        { kind: 'ellipse', cx: 60, cy: 24, rx: 5, ry: 7, fill: 'tongue' },
        // big round sparkly eye (rounder + larger highlight = babier)
        { kind: 'circle', cx: 48, cy: -4, r: 13, fill: EYE },
        { kind: 'circle', cx: 43, cy: -9, r: 5.4, fill: HI },
        { kind: 'circle', cx: 52, cy: 2, r: 2.6, fill: HI },
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
