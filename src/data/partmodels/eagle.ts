import type { PartModel } from './types.ts';

const EYE = '#2E2620';
const HI = '#FFFFFF';

/**
 * Cute chibi eagle (front-facing), GROUND RUNNER — fierce-but-cute. Stands on two
 * scaly talon feet and runs like the penguin/monkey bipeds: the renderer's 'biped'
 * runStyle cycles `legL`/`legR` and swings the folded wings `armL`/`armR` (held
 * close to the body) like flippers.
 *
 * Deliberately sharpened to read apart from the (round, soft, black-and-white)
 * penguin: a big hooked raptor beak, angular angry brows over the big eyes, a
 * spiky feather crest jutting up/back off the crown, pointed flight-feather wing
 * tips, and clawed talons — all in raptor browns + a sharp golden beak. The
 * baby-schema (oversized head, big eyes) is kept so it stays cute, just fierce.
 * The skill is a "jump headbutt": it springs forward and rams head-first.
 */
export const eagleModel: PartModel = {
  id: 'eagle',
  parts: [
    {
      name: 'tail',
      pivot: { x: 0, y: 96 },
      z: 0,
      // pointed tail feathers (notched fan) poking out below/behind the body
      shapes: [{ kind: 'path', d: 'M-12,90 L-4,106 L0,96 L4,106 L12,90 Q0,94 -12,90 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'legL',
      // scaly yellow talon foot with sharp curved claws, planted on the ground
      pivot: { x: -11, y: 92 },
      z: 1,
      shapes: [
        { kind: 'line', x1: -11, y1: 92, x2: -11, y2: 100, stroke: 'beak', strokeW: 3.4 },
        { kind: 'path', d: 'M-11,100 L-19,104 L-20,101', fill: 'none', stroke: 'beak', strokeW: 2.6 },
        { kind: 'path', d: 'M-11,100 L-3,104 L-2,101', fill: 'none', stroke: 'beak', strokeW: 2.6 },
        { kind: 'path', d: 'M-11,100 L-11,106 L-13,104', fill: 'none', stroke: 'beak', strokeW: 2.6 },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 11, y: 92 },
      z: 1,
      shapes: [
        { kind: 'line', x1: 11, y1: 92, x2: 11, y2: 100, stroke: 'beak', strokeW: 3.4 },
        { kind: 'path', d: 'M11,100 L19,104 L20,101', fill: 'none', stroke: 'beak', strokeW: 2.6 },
        { kind: 'path', d: 'M11,100 L3,104 L2,101', fill: 'none', stroke: 'beak', strokeW: 2.6 },
        { kind: 'path', d: 'M11,100 L11,106 L13,104', fill: 'none', stroke: 'beak', strokeW: 2.6 },
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
      // folded wing held close to the body, tapering to a POINTED flight-feather
      // tip (vs the penguin's rounded flipper). Pivoted at the shoulder so the
      // 'biped' run swings it.
      pivot: { x: -26, y: 54 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-26,50 Q-46,58 -42,86 L-34,76 L-30,84 Q-24,70 -25,56 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'armR',
      pivot: { x: 26, y: 54 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M26,50 Q46,58 42,86 L34,76 L30,84 Q24,70 25,56 Z', fill: 'wing', stroke: 'outline', strokeW: 2.5 }],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 30 },
      z: 5,
      shapes: [
        // crest: pointed feather tufts jutting up/back off the crown (drawn first,
        // so they sit behind the head circle). Angular silhouette the round
        // penguin cap never has; part of the head so it tracks the run bob.
        { kind: 'path', d: 'M-6,-30 L-22,-58 L-2,-40 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M2,-34 L4,-64 L16,-42 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M12,-30 L30,-50 L24,-26 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'circle', cx: 0, cy: 0, r: 36, fill: 'point', stroke: 'outline', strokeW: 2.5 },
        // angular dark feather cap framing the face (jagged lower edge, not the
        // penguin's smooth round cap)
        { kind: 'path', d: 'M-36,-2 Q0,-42 36,-2 L26,-6 L18,-16 L8,-8 L0,-18 L-8,-8 L-18,-16 L-26,-6 Z', fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // sharp angry brows angled down toward the beak (the key fierce cue)
        { kind: 'path', d: 'M-30,-6 L-6,2 L-8,8 L-28,4 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'path', d: 'M30,-6 L6,2 L8,8 L28,4 Z', fill: 'crest', stroke: 'outline', strokeW: 2 },
        { kind: 'ellipse', cx: -23, cy: 12, rx: 5.5, ry: 3.5, fill: 'cheek', opacity: 0.65 },
        { kind: 'ellipse', cx: 23, cy: 12, rx: 5.5, ry: 3.5, fill: 'cheek', opacity: 0.65 },
        // big eyes (kept large for baby-cute) tucked under the angry brows
        { kind: 'circle', cx: -13, cy: 4, r: 8, fill: EYE },
        { kind: 'circle', cx: 13, cy: 4, r: 8, fill: EYE },
        { kind: 'circle', cx: -15, cy: 1, r: 2.6, fill: HI },
        { kind: 'circle', cx: 11, cy: 1, r: 2.6, fill: HI },
        // big hooked raptor beak — long, sharp, curling to a point (vs the
        // penguin's tiny triangle)
        { kind: 'path', d: 'M-9,12 L9,12 L6,20 Q5,28 -1,30 Q3,24 1,21 Q-4,20 -9,12 Z', fill: 'beak', stroke: 'outline', strokeW: 2 },
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
