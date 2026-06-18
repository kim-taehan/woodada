import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';

/** Transcribed from woodada-monkey.svg idle cell (origin = head center). */
export const monkeyModel: PartModel = {
  id: 'monkey',
  parts: [
    {
      name: 'tail',
      pivot: { x: 30, y: 70 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M22,78 Q56,84 56,50 Q56,40 46,42 Q52,46 50,52 Q50,72 22,70 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 74 },
      z: 1,
      shapes: [
        { kind: 'ellipse', cx: 0, cy: 74, rx: 29, ry: 27, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 0, cy: 79, rx: 18, ry: 17, fill: 'point' },
      ],
    },
    {
      name: 'legL',
      pivot: { x: -13, y: 87 },
      z: 2,
      shapes: [{ kind: 'ellipse', cx: -13, cy: 98, rx: 8, ry: 11, fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'legR',
      pivot: { x: 13, y: 87 },
      z: 2,
      shapes: [{ kind: 'ellipse', cx: 13, cy: 98, rx: 8, ry: 11, fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'armL',
      pivot: { x: -30, y: 60 },
      z: 2,
      shapes: [{ kind: 'ellipse', cx: -30, cy: 68, rx: 7, ry: 13, rotation: 20, fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'armR',
      pivot: { x: 32, y: 54 },
      z: 6,
      shapes: [
        { kind: 'ellipse', cx: 32, cy: 62, rx: 7, ry: 13, rotation: -32, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M37,44 Q50,42 51,53 Q47,48 38,50 Z', fill: 'banana', stroke: '#C9952E', strokeW: 1.5 },
      ],
    },
    {
      name: 'earL',
      pivot: { x: -42, y: -2 },
      z: 3,
      shapes: [
        { kind: 'circle', cx: -42, cy: -2, r: 13, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'circle', cx: -42, cy: -2, r: 7, fill: 'point' },
      ],
    },
    {
      name: 'earR',
      pivot: { x: 42, y: -2 },
      z: 3,
      shapes: [
        { kind: 'circle', cx: 42, cy: -2, r: 13, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'circle', cx: 42, cy: -2, r: 7, fill: 'point' },
      ],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 36 },
      z: 5,
      shapes: [
        { kind: 'circle', cx: 0, cy: 0, r: 39, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 0, cy: 4, rx: 25, ry: 24, fill: 'point' },
        { kind: 'ellipse', cx: -22, cy: 10, rx: 6, ry: 4, fill: 'cheek', opacity: 0.7 },
        { kind: 'ellipse', cx: 22, cy: 10, rx: 6, ry: 4, fill: 'cheek', opacity: 0.7 },
        { kind: 'circle', cx: -12, cy: -3, r: 8, fill: EYE },
        { kind: 'circle', cx: 12, cy: -3, r: 8, fill: EYE },
        { kind: 'circle', cx: -14, cy: -6, r: 2.6, fill: HI },
        { kind: 'circle', cx: 10, cy: -6, r: 2.6, fill: HI },
        { kind: 'ellipse', cx: -3, cy: 8, rx: 1.4, ry: 2, fill: 'outline' },
        { kind: 'ellipse', cx: 3, cy: 8, rx: 1.4, ry: 2, fill: 'outline' },
        // cheeky open grin with a row of teeth
        { kind: 'path', d: 'M-12,11 Q0,16 12,11 Q10,23 0,24 Q-10,23 -12,11 Z', fill: '#7A3B30', stroke: 'outline', strokeW: 1.5 },
        { kind: 'path', d: 'M-10,12 Q0,15 10,12 L9,15 Q0,17 -9,15 Z', fill: '#FFFFFF' },
      ],
    },
  ],
  poses: {
    idle: {},
    run: {},
    skill: { armR: { rot: -70, dy: -10 }, head: { dx: 4 } },
    win: { armL: { rot: -30 }, armR: { rot: -40 } },
    fall: { head: { rot: 16 } },
  },
};
