import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute chibi eagle (front-facing), AIRBORNE. The idle cell is a *hovering* pose:
 * the body floats and the two spread wings are the main silhouette; the legs are
 * tiny and tucked up (not standing on the ground). The renderer's 'fly' runStyle
 * adds a vertical hover bob (around the body pivot) and flaps the wings.
 *
 * Hover reference point = body pivot {x:0,y:56}: the renderer should bob the root
 * around this center. Wing parts are `wingL` / `wingR`, pivoted at the shoulders
 * so a rot delta swings them up (skill/flap-up) or down. Poses include an
 * up-swept wing key (negative rot raises the left, positive raises the right).
 */
export const eagleModel: PartModel = {
  id: 'eagle',
  parts: [
    {
      name: 'wingL',
      // shoulder pivot (left), so rot swings the whole wing up/down
      pivot: { x: -22, y: 52 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M-22,52 Q-58,40 -78,54 Q-70,58 -58,57 Q-66,64 -60,70 Q-44,62 -22,64 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'wingR',
      pivot: { x: 22, y: 52 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M22,52 Q58,40 78,54 Q70,58 58,57 Q66,64 60,70 Q44,62 22,64 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'tail',
      pivot: { x: 0, y: 84 },
      z: 0,
      // short tail fan beneath the body
      shapes: [{ kind: 'path', d: 'M-12,78 L0,98 L12,78 Q0,84 -12,78 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 56 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: 0, cy: 60, rx: 26, ry: 28, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // cream breast feathers
        { kind: 'ellipse', cx: 0, cy: 64, rx: 16, ry: 20, fill: 'point' },
      ],
    },
    {
      name: 'legL',
      // tiny tucked-up talon
      pivot: { x: -9, y: 84 },
      z: 3,
      shapes: [
        { kind: 'line', x1: -9, y1: 84, x2: -9, y2: 92, stroke: 'beak', strokeW: 3 },
        { kind: 'line', x1: -9, y1: 92, x2: -13, y2: 95, stroke: 'beak', strokeW: 2.4 },
        { kind: 'line', x1: -9, y1: 92, x2: -5, y2: 95, stroke: 'beak', strokeW: 2.4 },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 9, y: 84 },
      z: 3,
      shapes: [
        { kind: 'line', x1: 9, y1: 84, x2: 9, y2: 92, stroke: 'beak', strokeW: 3 },
        { kind: 'line', x1: 9, y1: 92, x2: 5, y2: 95, stroke: 'beak', strokeW: 2.4 },
        { kind: 'line', x1: 9, y1: 92, x2: 13, y2: 95, stroke: 'beak', strokeW: 2.4 },
      ],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 30 },
      z: 5,
      shapes: [
        { kind: 'circle', cx: 0, cy: 0, r: 36, fill: 'point', stroke: 'outline', strokeW: 2.5 },
        // brow / cap of darker feathers for a fierce-but-cute look
        { kind: 'path', d: 'M-36,-4 Q0,-40 36,-4 Q24,-18 0,-18 Q-24,-18 -36,-4 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -22, cy: 8, rx: 6, ry: 4, fill: 'cheek', opacity: 0.7 },
        { kind: 'ellipse', cx: 22, cy: 8, rx: 6, ry: 4, fill: 'cheek', opacity: 0.7 },
        // big eyes with an angry-cute brow already implied by the cap
        { kind: 'circle', cx: -13, cy: -2, r: 8.5, fill: EYE },
        { kind: 'circle', cx: 13, cy: -2, r: 8.5, fill: EYE },
        { kind: 'circle', cx: -15, cy: -5, r: 2.8, fill: HI },
        { kind: 'circle', cx: 11, cy: -5, r: 2.8, fill: HI },
        // hooked yellow beak
        { kind: 'path', d: 'M-8,9 L8,9 L2,20 Q0,24 -2,20 Q-3,17 -1,16 Q-5,15 -8,9 Z', fill: 'beak', stroke: 'outline', strokeW: 2 },
      ],
    },
  ],
  poses: {
    idle: {},
    // 'fly' run is procedural (hover + flap) in the renderer; keep a gentle base.
    run: {},
    // diving snatch: wings sweep up & back, head thrusts forward
    skill: { wingL: { rot: -34, dy: -6 }, wingR: { rot: 34, dy: -6 }, head: { dy: 4 } },
    // victory: wings thrown wide up
    win: { wingL: { rot: -28 }, wingR: { rot: 28 }, head: { dy: -4 } },
    fall: { head: { rot: 16 }, wingL: { rot: 20 }, wingR: { rot: -20 } },
  },
};
