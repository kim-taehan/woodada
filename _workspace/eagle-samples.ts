/**
 * EXPLORATION SAMPLES — not production. Three "real bird" eagle PartModel
 * variants for renderer-dev to render & capture as portraits so the user can
 * compare. Deliberately step away from the chibi baby-schema toward a more
 * anatomical raptor look (still game-friendly, stylized flat shapes).
 *
 * Production files (src/data/partmodels/eagle.ts, characters/eagle.ts) are left
 * untouched. These reuse the eagle palette keys so partsFactory resolves colors:
 *   base   deep chocolate body      point  bright cream face/breast
 *   wing   darker wing feathers     beak   golden beak + talons
 *   crest  near-black crest/brows   outline dark outline
 * (literal #hex also allowed; undefined keys render with no fill, no crash.)
 *
 * rot is DEGREES. Coords are in the same ~120px-tall local space the other
 * partmodels use (head/body near the vertical centre, feet near y≈100).
 *
 * Exports: eagleSampleSpread, eagleStanding, eagleProfile.
 */
import type { PartModel } from '../src/data/partmodels/types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';
const TALON = '#D9981A'; // a deeper gold for claw detail over the beak yellow

/* ───────────────────────────────────────────────────────────────────────────
 * 1) SPREAD GLIDER — wings flung wide into a flight silhouette, sharp primary
 *    feathers fanned at the tips. Front-facing body, head tucked between the
 *    shoulders. Reads as "soaring raptor" (pairs with the glide staging).
 * ─────────────────────────────────────────────────────────────────────────── */
export const eagleSampleSpread: PartModel = {
  id: 'eagle-spread',
  parts: [
    {
      // Left wing: a long swept plane with 4 notched primary feathers at the tip.
      name: 'wingL',
      pivot: { x: -18, y: 44 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M-18,44 Q-70,22 -116,40 L-104,46 L-110,52 L-96,54 L-102,62 L-86,60 L-92,70 L-72,62 Q-44,56 -18,58 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 },
        // a few cream covert streaks near the shoulder
        { kind: 'path', d: 'M-22,48 Q-44,48 -60,54', fill: 'none', stroke: 'point', strokeW: 2 },
      ],
    },
    {
      name: 'wingR',
      pivot: { x: 18, y: 44 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M18,44 Q70,22 116,40 L104,46 L110,52 L96,54 L102,62 L86,60 L92,70 L72,62 Q44,56 18,58 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M22,48 Q44,48 60,54', fill: 'none', stroke: 'point', strokeW: 2 },
      ],
    },
    {
      name: 'tail',
      pivot: { x: 0, y: 78 },
      z: 0,
      // fanned tail feathers below the body
      shapes: [{ kind: 'path', d: 'M-18,74 L-10,98 L-4,80 L0,100 L4,80 L10,98 L18,74 Q0,80 -18,74 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 56 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: 0, cy: 56, rx: 22, ry: 28, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: 0, cy: 58, rx: 13, ry: 19, fill: 'point' },
      ],
    },
    {
      name: 'legL',
      pivot: { x: -8, y: 84 },
      z: 3,
      shapes: [
        { kind: 'line', x1: -8, y1: 84, x2: -8, y2: 92, stroke: 'beak', strokeW: 3 },
        { kind: 'path', d: 'M-8,92 L-13,96 M-8,92 L-3,96 M-8,92 L-8,97', fill: 'none', stroke: 'beak', strokeW: 2.2 },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 8, y: 84 },
      z: 3,
      shapes: [
        { kind: 'line', x1: 8, y1: 84, x2: 8, y2: 92, stroke: 'beak', strokeW: 3 },
        { kind: 'path', d: 'M8,92 L13,96 M8,92 L3,96 M8,92 L8,97', fill: 'none', stroke: 'beak', strokeW: 2.2 },
      ],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 26 },
      z: 5,
      shapes: [
        // smaller, rounder head sunk between the wings (less chibi than production)
        { kind: 'circle', cx: 0, cy: 0, r: 22, fill: 'point', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M-22,-2 Q0,-26 22,-2 L14,-8 L0,-12 L-14,-8 Z', fill: 'base', stroke: 'outline', strokeW: 2.4 },
        // brows + eyes
        { kind: 'path', d: 'M-18,-2 L-4,2 L-6,6 L-17,3 Z', fill: 'crest', stroke: 'outline', strokeW: 1.6 },
        { kind: 'path', d: 'M18,-2 L4,2 L6,6 L17,3 Z', fill: 'crest', stroke: 'outline', strokeW: 1.6 },
        { kind: 'circle', cx: -8, cy: 3, r: 5, fill: EYE },
        { kind: 'circle', cx: 8, cy: 3, r: 5, fill: EYE },
        { kind: 'circle', cx: -9, cy: 1, r: 1.8, fill: HI },
        { kind: 'circle', cx: 7, cy: 1, r: 1.8, fill: HI },
        // hooked beak
        { kind: 'path', d: 'M-6,9 L6,9 L3,16 Q2,21 -2,22 Q1,17 0,15 Q-3,14 -6,9 Z', fill: 'beak', stroke: 'outline', strokeW: 1.8 },
      ],
    },
  ],
  poses: { idle: {}, run: {}, skill: { wingL: { rot: -10 }, wingR: { rot: 10 } }, win: { head: { dy: -3 } }, fall: { head: { rot: 14 } } },
};

/* ───────────────────────────────────────────────────────────────────────────
 * 2) MAJESTIC STANDING RAPTOR — a realistically proportioned eagle standing
 *    tall: smaller head on a fuller body, long feathered legs ending in big
 *    taloned feet, folded wings down the sides, hooked beak, fierce browed head.
 *    Baby proportions dialed back for a stately, imposing look.
 * ─────────────────────────────────────────────────────────────────────────── */
export const eagleStanding: PartModel = {
  id: 'eagle-standing',
  parts: [
    {
      name: 'tail',
      pivot: { x: 0, y: 92 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-14,86 L-8,108 L0,90 L8,108 L14,86 Q0,92 -14,86 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // folded left wing hanging down the side, feather tips notched
      name: 'wingL',
      pivot: { x: -22, y: 46 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M-22,42 Q-40,52 -34,86 L-28,78 L-24,86 L-20,76 Q-18,58 -20,48 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'wingR',
      pivot: { x: 22, y: 46 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M22,42 Q40,52 34,86 L28,78 L24,86 L20,76 Q18,58 20,48 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // full upright torso, longer than the chibi (head:body closer to real)
      name: 'body',
      pivot: { x: 0, y: 56 },
      z: 2,
      shapes: [
        { kind: 'path', d: 'M0,30 Q24,34 24,62 Q24,86 0,90 Q-24,86 -24,62 Q-24,34 0,30 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // cream breast + feather flecks
        { kind: 'path', d: 'M0,40 Q14,44 14,64 Q14,80 0,84 Q-14,80 -14,64 Q-14,44 0,40 Z', fill: 'point' },
        { kind: 'path', d: 'M-6,52 L-4,58 M4,52 L6,58 M0,60 L0,66', fill: 'none', stroke: 'base', strokeW: 1.6 },
      ],
    },
    {
      // long feathered legs + big taloned feet planted wide
      name: 'legL',
      pivot: { x: -10, y: 88 },
      z: 3,
      shapes: [
        { kind: 'path', d: 'M-12,84 Q-14,92 -11,98 L-7,98 Q-9,92 -8,84 Z', fill: 'base', stroke: 'outline', strokeW: 2 }, // feathered thigh
        { kind: 'line', x1: -10, y1: 98, x2: -10, y2: 104, stroke: 'beak', strokeW: 3.2 },
        { kind: 'path', d: 'M-10,104 L-18,108 L-19,105 M-10,104 L-2,108 L-1,105 M-10,104 L-10,110', fill: 'none', stroke: TALON, strokeW: 2.4 },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 10, y: 88 },
      z: 3,
      shapes: [
        { kind: 'path', d: 'M12,84 Q14,92 11,98 L7,98 Q9,92 8,84 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'line', x1: 10, y1: 98, x2: 10, y2: 104, stroke: 'beak', strokeW: 3.2 },
        { kind: 'path', d: 'M10,104 L18,108 L19,105 M10,104 L2,108 L1,105 M10,104 L10,110', fill: 'none', stroke: TALON, strokeW: 2.4 },
      ],
    },
    {
      // proud head held high on a hint of neck; fierce browed, hooked beak
      name: 'head',
      pivot: { x: 0, y: 22 },
      z: 5,
      shapes: [
        // nape feathers (crest sweeping back)
        { kind: 'path', d: 'M-14,-12 Q-26,-22 -30,-6 Q-20,-8 -12,0 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M14,-12 Q26,-22 30,-6 Q20,-8 12,0 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'circle', cx: 0, cy: 0, r: 20, fill: 'point', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M-20,-3 Q0,-22 20,-3 L12,-8 L0,-11 L-12,-8 Z', fill: 'base', stroke: 'outline', strokeW: 2.4 },
        // heavy angry brows
        { kind: 'path', d: 'M-17,-2 L-3,3 L-5,8 L-16,4 Z', fill: 'crest', stroke: 'outline', strokeW: 1.6 },
        { kind: 'path', d: 'M17,-2 L3,3 L5,8 L16,4 Z', fill: 'crest', stroke: 'outline', strokeW: 1.6 },
        { kind: 'circle', cx: -8, cy: 4, r: 4.5, fill: EYE },
        { kind: 'circle', cx: 8, cy: 4, r: 4.5, fill: EYE },
        { kind: 'circle', cx: -9, cy: 2.5, r: 1.5, fill: HI },
        { kind: 'circle', cx: 7, cy: 2.5, r: 1.5, fill: HI },
        // long hooked beak
        { kind: 'path', d: 'M-7,10 L7,10 L4,19 Q3,25 -2,26 Q2,20 0,17 Q-4,16 -7,10 Z', fill: 'beak', stroke: 'outline', strokeW: 1.8 },
      ],
    },
  ],
  poses: { idle: {}, run: {}, skill: { head: { dy: 3 } }, win: { head: { dy: -4 } }, fall: { head: { rot: 14 } } },
};

/* ───────────────────────────────────────────────────────────────────────────
 * 3) SIDE PROFILE (real bird) — the most anatomical: a side-on eagle facing +x
 *    with a long hooked beak on a sloped head, a streamlined body, a fanned
 *    tail trailing back (-x), one folded wing on the flank, and a long taloned
 *    leg. No front-face chibi cues at all.
 * ─────────────────────────────────────────────────────────────────────────── */
export const eagleProfile: PartModel = {
  id: 'eagle-profile',
  parts: [
    {
      // tail feathers trailing behind (-x)
      name: 'tail',
      pivot: { x: -28, y: 50 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-26,44 L-58,40 L-50,50 L-60,52 L-48,58 L-26,56 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // streamlined side body
      name: 'body',
      pivot: { x: 0, y: 50 },
      z: 2,
      shapes: [
        { kind: 'path', d: 'M-26,50 Q-14,32 18,36 Q40,40 40,54 Q40,70 14,72 Q-16,72 -26,58 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // pale breast at the front/underside
        { kind: 'path', d: 'M14,54 Q34,52 38,58 Q36,68 16,68 Q2,68 0,60 Q4,55 14,54 Z', fill: 'point' },
      ],
    },
    {
      // folded wing on the near flank with notched primary tips
      name: 'wingL',
      pivot: { x: 2, y: 46 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-6,44 Q14,40 30,48 L22,50 L28,54 L18,55 L24,60 L8,58 Q-2,54 -6,50 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // long leg + taloned foot reaching the ground
      name: 'legL',
      pivot: { x: 16, y: 70 },
      z: 1,
      shapes: [
        { kind: 'path', d: 'M14,66 Q12,74 14,80 L19,80 Q18,73 19,66 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'line', x1: 16, y1: 80, x2: 16, y2: 92, stroke: 'beak', strokeW: 3 },
        { kind: 'path', d: 'M16,92 L24,96 L25,93 M16,92 L9,96 L8,93 M16,92 L16,98', fill: 'none', stroke: TALON, strokeW: 2.4 },
      ],
    },
    {
      // far leg (a touch back + darker for depth)
      name: 'legR',
      pivot: { x: 6, y: 70 },
      z: 0,
      shapes: [
        { kind: 'line', x1: 6, y1: 72, x2: 6, y2: 90, stroke: '#B07814', strokeW: 2.6 },
        { kind: 'path', d: 'M6,90 L12,94 M6,90 L1,94 M6,90 L6,96', fill: 'none', stroke: '#B07814', strokeW: 2 },
      ],
    },
    {
      // sloped raptor head facing +x: brow ridge, eye, long hooked beak
      name: 'head',
      pivot: { x: 30, y: 22 },
      z: 5,
      shapes: [
        // crest sweeping back off the nape
        { kind: 'path', d: 'M18,8 Q6,2 0,12 Q12,12 22,18 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M16,22 Q18,2 34,2 Q50,4 52,16 Q52,26 40,30 Q24,32 16,22 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
        // dark crown
        { kind: 'path', d: 'M16,18 Q22,2 36,3 Q30,9 26,18 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        // heavy brow ridge over the eye (the fierce raptor cue)
        { kind: 'path', d: 'M28,12 L44,12 L44,17 L30,18 Z', fill: 'crest' },
        { kind: 'circle', cx: 36, cy: 16, r: 4, fill: EYE },
        { kind: 'circle', cx: 35, cy: 15, r: 1.4, fill: HI },
        // long hooked beak projecting forward (+x), curling to a sharp point
        { kind: 'path', d: 'M48,12 Q66,14 66,20 Q64,26 52,25 Q60,21 58,18 Q54,17 48,18 Z', fill: 'beak', stroke: 'outline', strokeW: 2 },
        // cere nostril dot
        { kind: 'circle', cx: 52, cy: 16, r: 1.4, fill: 'outline' },
      ],
    },
  ],
  poses: { idle: {}, run: {}, skill: { head: { dx: 4 } }, win: { head: { dy: -3 } }, fall: { head: { rot: 14 } } },
};
