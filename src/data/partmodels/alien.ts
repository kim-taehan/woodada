import type { PartModel } from './types.ts';

const EYE = '#1C2233';
const HI = '#BFE9FF';

/**
 * Sleek neon glow-rim flying saucer (techy / cool) — the alien rides a UFO.
 * Cute chibi alien (front-facing) piloting a sleek dark saucer ringed with a
 * bright neon glow, GLIDE runStyle (the disc hovers — no leg cycle; the underglow
 * beams tuck while airborne, the antennae sway). A dark teal low-profile hull with
 * a luminous neon-cyan rim band and a row of glowing portholes; the alien sits in
 * a tinted canopy bubble, big eyes glowing through. `legL`/`legR` are the two
 * downward underglow beams (glide tucks them up while floating). `body` is the
 * hull (glide breathe rocks the craft); `armL`/`armR` are hands on the canopy rim.
 *
 * Distinct from the eagle (the other glide character): no wings/beak — a sleek
 * tech disc carries it, neon rim + big alien eyes keep a cool alien identity.
 */
export const alienModel: PartModel = {
  id: 'alien',
  parts: [
    // downward underglow beams (glide tucks them up while floating)
    {
      name: 'legL',
      pivot: { x: -24, y: 92 },
      z: 0,
      shapes: [
        { kind: 'path', d: 'M-30,92 L-18,92 L-22,112 L-26,112 Z', fill: 'rim', stroke: undefined, opacity: 0.45 },
        { kind: 'circle', cx: -24, cy: 92, r: 4, fill: 'rim', stroke: 'outline', strokeW: 1.4 },
      ],
    },
    {
      name: 'legR',
      pivot: { x: 24, y: 92 },
      z: 0,
      shapes: [
        { kind: 'path', d: 'M30,92 L18,92 L22,112 L26,112 Z', fill: 'rim', stroke: undefined, opacity: 0.45 },
        { kind: 'circle', cx: 24, cy: 92, r: 4, fill: 'rim', stroke: 'outline', strokeW: 1.4 },
      ],
    },
    // sleek dark hull with a luminous neon rim band (the `body` so glide rocks it)
    {
      name: 'body',
      pivot: { x: 0, y: 84 },
      z: 2,
      shapes: [
        // glow halo behind the rim (soft neon spill)
        { kind: 'ellipse', cx: 0, cy: 86, rx: 62, ry: 22, fill: 'rim', opacity: 0.3 },
        // dark low-profile hull
        { kind: 'ellipse', cx: 0, cy: 84, rx: 56, ry: 18, fill: 'hull', stroke: 'outline', strokeW: 2.6 },
        // luminous neon rim band
        { kind: 'ellipse', cx: 0, cy: 88, rx: 50, ry: 9, fill: 'rim', stroke: 'outline', strokeW: 1.6, opacity: 0.95 },
        // raised cockpit base
        { kind: 'ellipse', cx: 0, cy: 78, rx: 34, ry: 12, fill: 'hullTop', stroke: 'outline', strokeW: 2.2 },
        // glowing portholes along the rim
        { kind: 'circle', cx: -34, cy: 86, r: 3.5, fill: 'antenna', stroke: 'outline', strokeW: 1.2 },
        { kind: 'circle', cx: -12, cy: 90, r: 3.5, fill: 'antenna', stroke: 'outline', strokeW: 1.2 },
        { kind: 'circle', cx: 12, cy: 90, r: 3.5, fill: 'antenna', stroke: 'outline', strokeW: 1.2 },
        { kind: 'circle', cx: 34, cy: 86, r: 3.5, fill: 'antenna', stroke: 'outline', strokeW: 1.2 },
      ],
    },
    // hands gripping the canopy rim
    {
      name: 'armL',
      pivot: { x: -24, y: 60 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-24,58 Q-32,64 -28,72 Q-22,68 -18,62 Z', fill: 'base', stroke: 'outline', strokeW: 2.2 }],
    },
    {
      name: 'armR',
      pivot: { x: 24, y: 60 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M24,58 Q32,64 28,72 Q22,68 18,62 Z', fill: 'base', stroke: 'outline', strokeW: 2.2 }],
    },
    // antennae as ears so the renderer streams a gentle sway (above the canopy)
    {
      name: 'earL',
      pivot: { x: -8, y: 6 },
      z: 4,
      shapes: [
        { kind: 'path', d: 'M-8,6 Q-16,-10 -18,-24', fill: undefined, stroke: 'outline', strokeW: 3 },
        { kind: 'circle', cx: -18, cy: -26, r: 5, fill: 'rim', stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      name: 'earR',
      pivot: { x: 8, y: 6 },
      z: 4,
      shapes: [
        { kind: 'path', d: 'M8,6 Q16,-10 18,-24', fill: undefined, stroke: 'outline', strokeW: 3 },
        { kind: 'circle', cx: 18, cy: -26, r: 5, fill: 'rim', stroke: 'outline', strokeW: 2 },
      ],
    },
    // tinted canopy + alien head glowing through (glide head-bob)
    {
      name: 'head',
      pivot: { x: 0, y: 34 },
      z: 5,
      shapes: [
        // tinted canopy bubble
        { kind: 'ellipse', cx: 0, cy: 40, rx: 38, ry: 36, fill: 'dome', stroke: 'rim', strokeW: 2.6, opacity: 0.5 },
        // canopy glint
        { kind: 'ellipse', cx: -13, cy: 26, rx: 8, ry: 13, rotation: -22, fill: '#FFFFFF', opacity: 0.35 },
        // alien head inside
        { kind: 'ellipse', cx: 0, cy: 34, rx: 27, ry: 26, fill: 'base', stroke: 'outline', strokeW: 2.4 },
        { kind: 'ellipse', cx: -16, cy: 44, rx: 4.5, ry: 3, fill: 'cheek', opacity: 0.6 },
        { kind: 'ellipse', cx: 16, cy: 44, rx: 4.5, ry: 3, fill: 'cheek', opacity: 0.6 },
        // huge black almond eyes, tilted
        { kind: 'ellipse', cx: -11, cy: 33, rx: 8, ry: 12, rotation: -18, fill: EYE },
        { kind: 'ellipse', cx: 11, cy: 33, rx: 8, ry: 12, rotation: 18, fill: EYE },
        { kind: 'circle', cx: -13, cy: 27, r: 2.6, fill: HI },
        { kind: 'circle', cx: 9, cy: 27, r: 2.6, fill: HI },
        // tiny mouth
        { kind: 'path', d: 'M-4,50 Q0,53 4,50', fill: undefined, stroke: 'outline', strokeW: 2 },
      ],
    },
  ],
  poses: {
    idle: {},
    // glide hover is procedural (underglow tucks, antennae sway, hull breathes).
    run: {},
    // skill: hands thrust up gripping the rim, head tips up (scanning beam gesture).
    skill: { armL: { rot: -34, dy: -4 }, armR: { rot: 34, dy: -4 }, head: { dy: -3 } },
    // victory: hands thrown up, little hover-bounce.
    win: { armL: { rot: -30, dy: -4 }, armR: { rot: 30, dy: -4 }, head: { dy: -4 } },
    // fall: craft tipped, alien lurches, hands flail.
    fall: { head: { rot: 14 }, armL: { rot: 22 }, armR: { rot: -22 } },
  },
};
