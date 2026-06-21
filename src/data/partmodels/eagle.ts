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
      shapes: [
        // fanned tail feathers with crisp notches between the rectrices
        { kind: 'path', d: 'M-26,44 L-60,38 L-52,48 L-62,50 L-52,55 L-60,60 L-48,60 L-26,57 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 },
        // feather split lines for definition
        { kind: 'path', d: 'M-28,50 L-52,48 M-28,53 L-52,55', fill: 'none', stroke: 'outline', strokeW: 1.2, opacity: 0.5 },
      ],
    },
    {
      // far leg (set back + darker for depth), drawn behind the body
      name: 'legR',
      pivot: { x: 6, y: 70 },
      z: 0,
      shapes: [
        { kind: 'line', x1: 6, y1: 72, x2: 6, y2: 90, stroke: FARLEG, strokeW: 2.6 },
        // matching three-talon foot, darker for depth
        { kind: 'path', d: 'M6,90 Q12,92 14,96 M6,90 Q1,92 -1,96 M6,90 L6,97', fill: 'none', stroke: FARLEG, strokeW: 2.1 },
      ],
    },
    {
      // streamlined side body with a pale breast at the front/underside
      name: 'body',
      pivot: { x: 0, y: 50 },
      z: 2,
      shapes: [
        // streamlined raptor torso: high chest at the front (+x), tapering to the tail
        { kind: 'path', d: 'M-26,50 Q-12,30 20,34 Q42,38 42,54 Q42,70 14,73 Q-16,73 -26,57 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // pale breast patch at the front underside
        { kind: 'path', d: 'M16,52 Q36,50 40,58 Q38,69 16,69 Q3,69 1,60 Q5,53 16,52 Z', fill: 'point' },
      ],
    },
    {
      // near leg + taloned foot reaching the ground
      name: 'legL',
      pivot: { x: 16, y: 70 },
      z: 1,
      shapes: [
        // feathered thigh, then a scaled golden shank ending in three hooked talons
        { kind: 'path', d: 'M13,65 Q11,74 14,81 L20,81 Q19,73 20,65 Z', fill: 'base', stroke: 'outline', strokeW: 2 },
        { kind: 'line', x1: 16, y1: 81, x2: 16, y2: 92, stroke: 'beak', strokeW: 3.2 },
        // splayed taloned foot — three curling claws, clearer hook than before
        { kind: 'path', d: 'M16,92 Q24,94 26,99 M16,92 Q9,94 7,99 M16,92 L16,100', fill: 'none', stroke: TALON, strokeW: 2.6 },
      ],
    },
    {
      // folded near wing — a broad shoulder tapering to clearly notched primary
      // feather tips. NOTE: the pivot sits at the shoulder so the renderer can
      // flap the whole wing about it; base rot is 0 (kept stable for animation).
      name: 'wingL',
      pivot: { x: -4, y: 44 },
      z: 3,
      shapes: [
        // wing mass: rounded shoulder sweeping to layered primary tips trailing back
        { kind: 'path', d: 'M-8,42 Q16,37 34,46 L24,49 L31,53 L19,55 L26,61 L10,60 L14,64 Q-2,60 -8,50 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 },
        // covert feather seam for depth
        { kind: 'path', d: 'M-2,46 Q14,44 28,49', fill: 'none', stroke: 'outline', strokeW: 1.4, opacity: 0.5 },
      ],
    },
    {
      // sloped raptor head facing +x: crest, dark crown, heavy brow ridge, eye,
      // long hooked beak projecting forward to a sharp point
      name: 'head',
      pivot: { x: 30, y: 22 },
      z: 5,
      shapes: [
        // swept-back nape crest — sharper, more raked spikes for a fierce read
        { kind: 'path', d: 'M20,6 Q4,-2 -4,8 Q8,9 18,14 L10,18 Q18,20 24,20 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        // rounded crown / cheek mass (clear contrast against the dark crown above)
        { kind: 'path', d: 'M16,24 Q16,2 34,1 Q52,3 54,17 Q54,28 40,31 Q22,32 16,24 Z', fill: 'point', stroke: 'outline', strokeW: 2.5 },
        // dark crown cap sweeping down the nape
        { kind: 'path', d: 'M15,18 Q20,1 37,2 Q30,9 27,19 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        // heavy angled brow ridge jutting over the eye (the signature fierce cue)
        { kind: 'path', d: 'M26,9 L48,12 L46,18 L30,17 Z', fill: 'crest' },
        // fierce glaring eye tucked under the brow + sharp highlight
        { kind: 'circle', cx: 37, cy: 16, r: 4.2, fill: EYE },
        { kind: 'circle', cx: 35, cy: 14, r: 1.5, fill: HI },
        // long, sharply hooked beak (+x): a straight golden mass curling to a hooked point
        { kind: 'path', d: 'M46,11 L70,17 Q72,21 68,24 Q60,27 52,25 Q62,22 61,18 L52,18 Z', fill: 'beak', stroke: 'outline', strokeW: 2 },
        // gape line under the upper mandible for definition
        { kind: 'path', d: 'M52,19 Q60,20 67,22', fill: 'none', stroke: 'outline', strokeW: 1.4 },
        // cere nostril dot
        { kind: 'circle', cx: 51, cy: 16, r: 1.4, fill: 'outline' },
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
