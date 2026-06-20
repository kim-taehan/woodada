import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';
const TALON = '#D9981A'; // deeper gold for the claw detail over the beak yellow
const FARLEG = '#B07814'; // far-side leg, a step darker than the talon for depth

/**
 * Side-profile raptor eagle (a "real bird", faces +x; the renderer flips it via
 * the 'glide' runStyle to match travel direction). Unlike the other front-facing
 * chibis, this is an anatomical side silhouette: a sloped head with a long hooked
 * beak projecting forward, a streamlined body, a fanned tail trailing behind (-x),
 * one folded wing on the near flank, and taloned legs (the far leg drawn darker
 * for depth). Raptor browns + a golden beak/talons; a near-black crown + brow ridge
 * keep it fierce.
 *
 * The 'glide' runStyle mirrors it to face travel + adds a tilt/hover (no leg cycle —
 * it flies, doesn't step). The skill (divebomb = jump headbutt) lunges head-first
 * forward (+x = travel direction in local space) at the racer ahead.
 */
export const eagleModel: PartModel = {
  id: 'eagle',
  parts: [
    {
      // tail feathers trailing behind (-x)
      name: 'tail',
      pivot: { x: -28, y: 50 },
      z: 0,
      shapes: [{ kind: 'path', d: 'M-26,44 L-58,40 L-50,50 L-60,52 L-48,58 L-26,56 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // far leg (set back + darker for depth), drawn behind the body
      name: 'legR',
      pivot: { x: 6, y: 70 },
      z: 0,
      shapes: [
        { kind: 'line', x1: 6, y1: 72, x2: 6, y2: 90, stroke: FARLEG, strokeW: 2.6 },
        { kind: 'path', d: 'M6,90 L12,94 M6,90 L1,94 M6,90 L6,96', fill: 'none', stroke: FARLEG, strokeW: 2 },
      ],
    },
    {
      // streamlined side body with a pale breast at the front/underside
      name: 'body',
      pivot: { x: 0, y: 50 },
      z: 2,
      shapes: [
        { kind: 'path', d: 'M-26,50 Q-14,32 18,36 Q40,40 40,54 Q40,70 14,72 Q-16,72 -26,58 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M14,54 Q34,52 38,58 Q36,68 16,68 Q2,68 0,60 Q4,55 14,54 Z', fill: 'point' },
      ],
    },
    {
      // near leg + taloned foot reaching the ground
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
      // folded wing on the near flank with notched primary tips
      name: 'wingL',
      pivot: { x: 2, y: 46 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-6,44 Q14,40 30,48 L22,50 L28,54 L18,55 L24,60 L8,58 Q-2,54 -6,50 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      // sloped raptor head facing +x: crest, dark crown, heavy brow ridge, eye,
      // long hooked beak projecting forward to a sharp point
      name: 'head',
      pivot: { x: 30, y: 22 },
      z: 5,
      shapes: [
        { kind: 'path', d: 'M18,8 Q6,2 0,12 Q12,12 22,18 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M16,22 Q18,2 34,2 Q50,4 52,16 Q52,26 40,30 Q24,32 16,22 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
        { kind: 'path', d: 'M16,18 Q22,2 36,3 Q30,9 26,18 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        // heavy brow ridge over the eye (the fierce raptor cue)
        { kind: 'path', d: 'M28,12 L44,12 L44,17 L30,18 Z', fill: 'crest' },
        { kind: 'circle', cx: 36, cy: 16, r: 4, fill: EYE },
        { kind: 'circle', cx: 35, cy: 15, r: 1.4, fill: HI },
        // long hooked beak (+x), curling to a sharp point
        { kind: 'path', d: 'M48,12 Q66,14 66,20 Q64,26 52,25 Q60,21 58,18 Q54,17 48,18 Z', fill: 'beak', stroke: 'outline', strokeW: 2 },
        // cere nostril dot
        { kind: 'circle', cx: 52, cy: 16, r: 1.4, fill: 'outline' },
      ],
    },
  ],
  poses: {
    idle: {},
    // 'glide' is procedural in the renderer (side mirror + tilt/hover, no leg cycle).
    run: {},
    // jump headbutt (divebomb): lunges head-first forward (+x = travel) with a
    // little lift, wing swept back for the dive. (rot is DEGREES.)
    skill: { head: { dx: 8, dy: 2 }, body: { dx: 4, dy: -3 }, wingL: { rot: -16 }, tail: { rot: 10 } },
    // victory: head lifted, wing flared up
    win: { head: { dy: -5 }, wingL: { rot: -22 }, tail: { rot: -8 } },
    // crash / tumble: head pitches over, wing flails
    fall: { head: { rot: 18 }, wingL: { rot: 24 }, tail: { rot: 16 } },
  },
};
