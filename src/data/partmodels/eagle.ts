import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute chibi eagle (front-facing), GROUND RUNNER. Stands on two scaly talon feet
 * and runs like the penguin/monkey bipeds: the renderer's 'biped' runStyle cycles
 * `legL`/`legR` and swings the short folded wings `armL`/`armR` (held close to the
 * body, like the penguin's flippers). A round brown body with a cream breast, a
 * round head with a darker feather cap + brow for a fierce-but-cute look, big eyes
 * and a hooked yellow beak. A short tail fan pokes out behind.
 *
 * Fierce-but-cute identity kept (brow cap, hooked beak, sharp talons) while it now
 * shares the same standing chibi schema as the other animals — no airborne hover.
 * The skill is a "jump headbutt": it springs forward and rams head-first.
 */
export const eagleModel: PartModel = {
  id: 'eagle',
  parts: [
    {
      name: 'tail',
      pivot: { x: 0, y: 96 },
      z: 0,
      // short tail fan poking out below/behind the body
      shapes: [{ kind: 'path', d: 'M-11,90 L0,104 L11,90 Q0,94 -11,90 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'legL',
      // scaly yellow talon foot, planted on the ground
      pivot: { x: -11, y: 92 },
      z: 1,
      shapes: [
        { kind: 'line', x1: -11, y1: 92, x2: -11, y2: 100, stroke: 'beak', strokeW: 3.2 },
        { kind: 'line', x1: -11, y1: 100, x2: -17, y2: 104, stroke: 'beak', strokeW: 2.6 },
        { kind: 'line', x1: -11, y1: 100, x2: -5, y2: 104, stroke: 'beak', strokeW: 2.6 },
        { kind: 'line', x1: -11, y1: 100, x2: -11, y2: 105, stroke: 'beak', strokeW: 2.6 },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 11, y: 92 },
      z: 1,
      shapes: [
        { kind: 'line', x1: 11, y1: 92, x2: 11, y2: 100, stroke: 'beak', strokeW: 3.2 },
        { kind: 'line', x1: 11, y1: 100, x2: 17, y2: 104, stroke: 'beak', strokeW: 2.6 },
        { kind: 'line', x1: 11, y1: 100, x2: 5, y2: 104, stroke: 'beak', strokeW: 2.6 },
        { kind: 'line', x1: 11, y1: 100, x2: 11, y2: 105, stroke: 'beak', strokeW: 2.6 },
      ],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 64 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: 0, cy: 64, rx: 28, ry: 30, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // cream breast feathers
        { kind: 'ellipse', cx: 0, cy: 68, rx: 18, ry: 22, fill: 'point' },
      ],
    },
    {
      name: 'armL',
      // short folded wing held close to the body, pivoted at the shoulder so the
      // 'biped' run swings it like a flipper
      pivot: { x: -26, y: 54 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-26,50 Q-44,60 -36,82 Q-26,72 -25,56 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'armR',
      pivot: { x: 26, y: 54 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M26,50 Q44,60 36,82 Q26,72 25,56 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
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
    // 'biped' run is procedural in the renderer (alternating legs + wing swing).
    run: {},
    // jump headbutt: springs forward — head & body thrust ahead, folded wings
    // sweep back for the lunge, a little airborne (dy up). (rot is DEGREES.)
    skill: { head: { dy: 6, rot: 10 }, body: { dy: -4 }, armL: { rot: 40 }, armR: { rot: -40 } },
    // victory: wings thrown wide, head up
    win: { armL: { rot: -34 }, armR: { rot: 34 }, head: { dy: -4 } },
    // crash / tumble: head snaps over, wings flail
    fall: { head: { rot: 16 }, armL: { rot: 22 }, armR: { rot: -22 } },
  },
};
