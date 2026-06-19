import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute chibi penguin (front-facing), WADDLER. Round black-backed body with a big
 * cream belly, a round head with a black cap framing a white face, big eyes and a
 * little orange triangle beak. Two short flippers are the `armL`/`armR` parts so
 * the renderer's 'biped' runStyle swings them as it waddles; two stubby orange
 * feet are `legL`/`legR` for the alternating step. A short tail pokes out behind.
 *
 * Distinct from the eagle (fierce brow cap, hooked beak, sharp talons) and the
 * other birds-of-the-roster: the penguin's flippers stay short and close to the
 * body, belly is the dominant cream silhouette, beak is a small orange triangle.
 */
export const penguinModel: PartModel = {
  id: 'penguin',
  parts: [
    {
      name: 'tail',
      pivot: { x: 0, y: 96 },
      z: 0,
      // short stubby tail fan poking out below/behind the body
      shapes: [{ kind: 'path', d: 'M-9,90 L0,104 L9,90 Q0,94 -9,90 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'legL',
      pivot: { x: -11, y: 96 },
      z: 1,
      // stubby orange webbed foot
      shapes: [{ kind: 'path', d: 'M-11,92 L-22,104 L0,104 Z', fill: 'beak', stroke: 'outline', strokeW: 2.2 }],
    },
    {
      name: 'legR',
      pivot: { x: 11, y: 96 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M11,92 L22,104 L0,104 Z', fill: 'beak', stroke: 'outline', strokeW: 2.2 }],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 66 },
      z: 2,
      shapes: [
        // black back/body
        { kind: 'ellipse', cx: 0, cy: 66, rx: 30, ry: 32, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // big cream belly
        { kind: 'ellipse', cx: 0, cy: 70, rx: 20, ry: 25, fill: 'point' },
      ],
    },
    {
      name: 'armL',
      // short flipper, pivoted at the shoulder so it swings with the waddle
      pivot: { x: -28, y: 56 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-28,52 Q-42,62 -34,80 Q-26,72 -26,58 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'armR',
      pivot: { x: 28, y: 56 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M28,52 Q42,62 34,80 Q26,72 26,58 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 32 },
      z: 5,
      shapes: [
        // black cap (whole head base)
        { kind: 'circle', cx: 0, cy: 0, r: 36, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // white face mask
        { kind: 'path', d: 'M0,-30 Q26,-26 28,4 Q26,26 0,28 Q-26,26 -28,4 Q-26,-26 0,-30 Z', fill: 'point' },
        { kind: 'ellipse', cx: -20, cy: 10, rx: 6, ry: 4, fill: 'cheek', opacity: 0.75 },
        { kind: 'ellipse', cx: 20, cy: 10, rx: 6, ry: 4, fill: 'cheek', opacity: 0.75 },
        // big round eyes
        { kind: 'circle', cx: -12, cy: -2, r: 8.5, fill: EYE },
        { kind: 'circle', cx: 12, cy: -2, r: 8.5, fill: EYE },
        { kind: 'circle', cx: -14, cy: -5, r: 2.8, fill: HI },
        { kind: 'circle', cx: 10, cy: -5, r: 2.8, fill: HI },
        // little orange triangle beak
        { kind: 'path', d: 'M-7,9 L7,9 L0,20 Z', fill: 'beak', stroke: 'outline', strokeW: 2 },
      ],
    },
  ],
  poses: {
    idle: {},
    // 'biped' waddle is procedural in the renderer (legs + flipper swing).
    run: {},
    // flood: throw both flippers up & out, head tips back with a splash cheer
    skill: { armL: { rot: -36, dy: -6 }, armR: { rot: 36, dy: -6 }, head: { dy: -3 } },
    // victory: flippers raised wide
    win: { armL: { rot: -30 }, armR: { rot: 30 }, head: { dy: -4 } },
    fall: { head: { rot: 16 }, armL: { rot: 22 }, armR: { rot: -22 } },
  },
};
