import type { PartModel } from './types.ts';

const FARLEG = '#D9C29E'; // far-side legs, a step darker than cream `point` for depth
const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute side-profile galloping hedgehog (faces +x; the renderer flips it to match
 * travel direction). Same side-quadruped rig as the dog/cat — a far-side pair
 * (legR/frontLegR, drawn darker for depth) and a near-side pair (legL/frontLegL)
 * the `gallop` runStyle swings — but its identity is the row of brown spikes (the
 * `spikes` part) bristling along the back + crown. A small cream face pokes out at
 * the front with a pointy snout, a black nose tip and one big eye; a tiny tail nub
 * at the back, short stubby legs.
 *
 * Baby-schema (spec §2.5): oversized round head, big sparkly eye, blush, round low
 * body. Distinct from the dog/cat side-runners by the spiky back dome + snout.
 * The skill bristles the spikes — they snap up/out while the body hunches low.
 */
export const hedgehogModel: PartModel = {
  id: 'hedgehog',
  parts: [
    {
      // Tiny tail nub poking out at the back (-x), low.
      name: 'tail',
      pivot: { x: -30, y: 36 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-28,36 Q-40,32 -38,22 Q-32,28 -24,30 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // Row of spikes running along the back + over the crown (the hedgehog's
      // defining side silhouette). Drawn behind the body so the quills fan up over
      // the topline. Pivot at the centre of the back so the skill pose can bristle
      // (scale) the whole spiky mass outward.
      name: 'spikes',
      pivot: { x: -2, y: 18 },
      z: 1,
      shapes: [
        // rounded prickly mantle hugging the back
        { kind: 'ellipse', cx: -4, cy: 26, rx: 36, ry: 26, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // quills standing up off the topline (back → forward / over the crown)
        { kind: 'path', d: 'M-38,24 L-52,18 L-32,10 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M-30,8 L-40,-10 L-16,0 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M-14,2 L-18,-20 L2,-6 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M4,-2 L6,-24 L22,-6 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M22,-2 L30,-22 L40,-2 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
      ],
    },
    // Far-side legs (behind the body), darker for depth.
    {
      name: 'legR',
      pivot: { x: -18, y: 46 },
      z: 1,
      shapes: [{ kind: 'ellipse', cx: -18, cy: 56, rx: 7, ry: 10, fill: FARLEG, stroke: 'outline', strokeW: 2.4 }],
    },
    {
      name: 'frontLegR',
      pivot: { x: 16, y: 48 },
      z: 1,
      shapes: [{ kind: 'ellipse', cx: 16, cy: 58, rx: 7, ry: 10, fill: FARLEG, stroke: 'outline', strokeW: 2.4 }],
    },
    {
      // Round low body with a cream belly peeking below the spiky mantle.
      name: 'body',
      pivot: { x: -2, y: 36 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: -2, cy: 38, rx: 30, ry: 22, fill: 'point', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 2, cy: 44, rx: 18, ry: 12, fill: 'point' },
      ],
    },
    // Near-side legs (in front of the body).
    {
      name: 'legL',
      pivot: { x: -10, y: 48 },
      z: 3,
      shapes: [{ kind: 'ellipse', cx: -10, cy: 59, rx: 7.5, ry: 11, fill: 'point', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'frontLegL',
      pivot: { x: 22, y: 50 },
      z: 3,
      shapes: [{ kind: 'ellipse', cx: 22, cy: 61, rx: 7.5, ry: 11, fill: 'point', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // Small cream face poking out at the front (+x): round head, pointy snout,
      // black nose tip, one big eye, blush. The crown spikes (above) overlap the
      // back of the head.
      name: 'head',
      pivot: { x: 32, y: 12 },
      z: 4,
      shapes: [
        { kind: 'circle', cx: 33, cy: 10, r: 24, fill: 'point', stroke: 'outline', strokeW: 2.5 },
        // pointy snout tapering forward to the nose
        { kind: 'path', d: 'M48,4 Q66,10 66,17 Q60,22 48,20 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
        // black nose tip
        { kind: 'circle', cx: 65, cy: 15, r: 4.5, fill: 'nose' },
        // cheek blush
        { kind: 'ellipse', cx: 32, cy: 20, rx: 7, ry: 4.5, fill: 'cheek', opacity: 0.85 },
        // big eye + highlight
        { kind: 'circle', cx: 40, cy: 6, r: 8, fill: EYE },
        { kind: 'circle', cx: 37, cy: 3, r: 2.7, fill: HI },
        { kind: 'circle', cx: 43, cy: 9, r: 1.4, fill: HI },
      ],
    },
  ],
  poses: {
    idle: {},
    // 'gallop' run is procedural in the renderer (front/rear leg pairs cycle).
    run: {},
    // bristle: spikes snap up & out (scale) while the body hunches low and the
    // head tucks down into a wary ball. (rot is DEGREES; scale is a multiplier.)
    skill: { spikes: { scaleX: 1.2, scaleY: 1.28, dy: -3 }, body: { scaleY: 0.92, dy: 3 }, head: { dy: 4, rot: 8 }, tail: { rot: -12 } },
    // victory: spikes proudly puffed, head up
    win: { spikes: { scaleX: 1.1, scaleY: 1.14 }, head: { dy: -5 }, tail: { rot: -20 } },
    // tumble: head snaps over
    fall: { head: { rot: 16 }, tail: { rot: 18 } },
  },
};
