import type { PartModel } from './types.ts';

const EYE = '#1C1426';
const HI = '#FFFFFF';

/**
 * Cute chibi spider (front-facing), SKITTER (falls to the biped/swing fallback
 * in the renderer). A round purple body with a big round head and HUGE eyes —
 * baby-schema, friendly not scary. Eight legs total: the front-most pair are the
 * `legL`/`legR` parts so the renderer's biped swing scuttles them; the other six
 * (`leg2L/R`, `leg3L/R`, `leg4L/R`) are static decorative legs splayed around
 * the body so it still reads as an eight-legged spider. No tail. Two tiny silk
 * spinneret tips peek out below for the web-abduct flavor.
 *
 * Distinct from the rest of the roster: many spindly legs + a single round body,
 * dark purple base with a soft lilac belly, no ears/tail.
 */
export const spiderModel: PartModel = {
  id: 'spider',
  parts: [
    // --- decorative back legs (static, behind the body) ---
    {
      name: 'leg4L',
      pivot: { x: -16, y: 70 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-16,70 Q-40,72 -50,90', fill: undefined, stroke: 'leg', strokeW: 3.4 }],
    },
    {
      name: 'leg4R',
      pivot: { x: 16, y: 70 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M16,70 Q40,72 50,90', fill: undefined, stroke: 'leg', strokeW: 3.4 }],
    },
    {
      name: 'leg3L',
      pivot: { x: -18, y: 64 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-18,64 Q-46,60 -58,72', fill: undefined, stroke: 'leg', strokeW: 3.4 }],
    },
    {
      name: 'leg3R',
      pivot: { x: 18, y: 64 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M18,64 Q46,60 58,72', fill: undefined, stroke: 'leg', strokeW: 3.4 }],
    },
    {
      name: 'leg2L',
      pivot: { x: -18, y: 58 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-18,58 Q-48,50 -60,56', fill: undefined, stroke: 'leg', strokeW: 3.4 }],
    },
    {
      name: 'leg2R',
      pivot: { x: 18, y: 58 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M18,58 Q48,50 60,56', fill: undefined, stroke: 'leg', strokeW: 3.4 }],
    },
    // --- front stepping pair: these swing (biped fallback) ---
    {
      name: 'legL',
      pivot: { x: -16, y: 76 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M-16,76 Q-44,86 -52,104', fill: undefined, stroke: 'leg', strokeW: 3.8 },
        { kind: 'circle', cx: -52, cy: 104, r: 3.4, fill: 'point' }, // soft rounded foot
      ],
    },
    {
      name: 'legR',
      pivot: { x: 16, y: 76 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M16,76 Q44,86 52,104', fill: undefined, stroke: 'leg', strokeW: 3.8 },
        { kind: 'circle', cx: 52, cy: 104, r: 3.4, fill: 'point' },
      ],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 64 },
      z: 2,
      shapes: [
        // round abdomen
        { kind: 'ellipse', cx: 0, cy: 66, rx: 26, ry: 24, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // soft lilac belly marking (brighter, fully opaque so it pops)
        { kind: 'ellipse', cx: 0, cy: 70, rx: 15, ry: 15, fill: 'point' },
        // glossy belly highlight
        { kind: 'ellipse', cx: -5, cy: 64, rx: 5, ry: 6, fill: HI, opacity: 0.6 },
        // tiny spinneret tips
        { kind: 'circle', cx: -4, cy: 90, r: 2, fill: 'web' },
        { kind: 'circle', cx: 4, cy: 90, r: 2, fill: 'web' },
      ],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 34 },
      z: 5,
      shapes: [
        // big round cephalothorax/head
        { kind: 'circle', cx: 0, cy: 30, r: 30, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // rosy blush cheeks (brighter, rounder)
        { kind: 'ellipse', cx: -17, cy: 41, rx: 7, ry: 5, fill: 'cheek', opacity: 0.85 },
        { kind: 'ellipse', cx: 17, cy: 41, rx: 7, ry: 5, fill: 'cheek', opacity: 0.85 },
        // two big sparkly main eyes (baby-schema) + tiny upper eye pair for spider charm
        { kind: 'circle', cx: -11, cy: 28, r: 10, fill: EYE },
        { kind: 'circle', cx: 11, cy: 28, r: 10, fill: EYE },
        // big glossy highlights + tiny secondary sparkle
        { kind: 'circle', cx: -14, cy: 24, r: 4, fill: HI },
        { kind: 'circle', cx: 8, cy: 24, r: 4, fill: HI },
        { kind: 'circle', cx: -8, cy: 31, r: 1.6, fill: HI, opacity: 0.8 },
        { kind: 'circle', cx: 14, cy: 31, r: 1.6, fill: HI, opacity: 0.8 },
        // tiny soft upper eyes (lilac, friendly — not beady black)
        { kind: 'circle', cx: -20, cy: 15, r: 2.6, fill: 'leg' },
        { kind: 'circle', cx: 20, cy: 15, r: 2.6, fill: 'leg' },
        // tiny smiling mouth
        { kind: 'path', d: 'M-5,44 Q0,49 5,44', fill: undefined, stroke: 'outline', strokeW: 2 },
      ],
    },
  ],
  poses: {
    idle: {},
    // skitter scuttle is procedural (front legL/legR swing in the biped fallback).
    run: {},
    // skill: rear up and fling the front legs wide to cast the web.
    skill: { legL: { rot: -34, dy: -6 }, legR: { rot: 34, dy: -6 }, head: { dy: -4 }, body: { dy: -3 } },
    // victory: front legs thrown up, happy little bounce.
    win: { legL: { rot: -28, dy: -4 }, legR: { rot: 28, dy: -4 }, head: { dy: -4 } },
    // fall: tipped, legs curl in.
    fall: { head: { rot: 16 }, legL: { rot: 26 }, legR: { rot: -26 }, leg2L: { rot: 14 }, leg2R: { rot: -14 } },
  },
};
