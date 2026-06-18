import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute chibi brown bear (front-facing). Big round head, small round ears on top,
 * a round cream muzzle and chunky body — distinct from the monkey (side ears +
 * tail) by its top ears + round snout.
 */
export const bearModel: PartModel = {
  id: 'bear',
  parts: [
    {
      name: 'tail',
      pivot: { x: 30, y: 58 },
      z: 0,
      shapes: [{ kind: 'circle', cx: 30, cy: 58, r: 8, fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 70 },
      z: 1,
      shapes: [
        { kind: 'ellipse', cx: 0, cy: 70, rx: 33, ry: 29, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 0, cy: 78, rx: 20, ry: 14, fill: 'point' },
      ],
    },
    {
      name: 'legL',
      pivot: { x: -15, y: 84 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: -15, cy: 98, rx: 11, ry: 14, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -15, cy: 110, rx: 12, ry: 5, fill: 'point' },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 15, y: 84 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: 15, cy: 98, rx: 11, ry: 14, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 15, cy: 110, rx: 12, ry: 5, fill: 'point' },
      ],
    },
    {
      name: 'earL',
      pivot: { x: -27, y: -30 },
      z: 3,
      shapes: [
        { kind: 'circle', cx: -27, cy: -30, r: 14, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'circle', cx: -27, cy: -30, r: 7.5, fill: 'point' },
      ],
    },
    {
      name: 'earR',
      pivot: { x: 27, y: -30 },
      z: 3,
      shapes: [
        { kind: 'circle', cx: 27, cy: -30, r: 14, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'circle', cx: 27, cy: -30, r: 7.5, fill: 'point' },
      ],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 34 },
      z: 4,
      shapes: [
        { kind: 'circle', cx: 0, cy: 0, r: 41, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 0, cy: 15, rx: 17, ry: 14, fill: 'point' },
        { kind: 'ellipse', cx: -27, cy: 10, rx: 7, ry: 5, fill: 'cheek' },
        { kind: 'ellipse', cx: 27, cy: 10, rx: 7, ry: 5, fill: 'cheek' },
        { kind: 'circle', cx: -15, cy: -4, r: 8, fill: EYE },
        { kind: 'circle', cx: 15, cy: -4, r: 8, fill: EYE },
        { kind: 'circle', cx: -18, cy: -7, r: 3, fill: HI },
        { kind: 'circle', cx: 12, cy: -7, r: 3, fill: HI },
        { kind: 'ellipse', cx: 0, cy: 7, rx: 6, ry: 4.5, fill: 'nose' },
        { kind: 'path', d: 'M0,11 Q-6,17 -11,14', fill: 'none', stroke: 'outline', strokeW: 1.8 },
        { kind: 'path', d: 'M0,11 Q6,17 11,14', fill: 'none', stroke: 'outline', strokeW: 1.8 },
      ],
    },
  ],
  poses: {
    idle: {},
    run: {},
    skill: { head: { dy: -3 }, earL: { rot: -6 }, earR: { rot: 6 } },
    win: { head: { dy: -6 } },
    fall: { head: { rot: 15 } },
  },
};
