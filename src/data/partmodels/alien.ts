import type { PartModel } from './types.ts';

const EYE = '#1C2233';
const HI = '#BFE9FF';

/**
 * Cute chibi alien (front-facing), GLIDE (hovers — no leg cycle; legs tuck while
 * airborne, antennae sway). A classic little-green-man: a big round bald head with
 * HUGE black almond eyes (baby-schema) and two bendy antennae topped with glowing
 * bulbs. The antennae are the `earL`/`earR` parts so the renderer auto-sways them.
 * A small round body, two stubby arms (`armL`/`armR`) and two dangly legs
 * (`legL`/`legR`) that the glide style tucks up while it floats. No tail.
 *
 * Distinct from the eagle (the other glide character): no wings, no beak/talons —
 * the alien floats by tech, with the antennae + giant eyes carrying its identity.
 */
export const alienModel: PartModel = {
  id: 'alien',
  parts: [
    // dangly legs (glide tucks them up while floating)
    {
      name: 'legL',
      pivot: { x: -10, y: 86 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M-10,86 Q-12,100 -8,108 L-2,108 L-4,88 Z', fill: 'base', stroke: 'outline', strokeW: 2.4 }],
    },
    {
      name: 'legR',
      pivot: { x: 10, y: 86 },
      z: 1,
      shapes: [{ kind: 'path', d: 'M10,86 Q12,100 8,108 L2,108 L4,88 Z', fill: 'base', stroke: 'outline', strokeW: 2.4 }],
    },
    {
      name: 'body',
      pivot: { x: 0, y: 70 },
      z: 2,
      shapes: [
        { kind: 'ellipse', cx: 0, cy: 70, rx: 22, ry: 24, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        // lighter belly
        { kind: 'ellipse', cx: 0, cy: 74, rx: 12, ry: 15, fill: 'point', opacity: 0.85 },
      ],
    },
    {
      name: 'armL',
      pivot: { x: -20, y: 62 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M-20,60 Q-34,68 -32,82 Q-24,76 -18,66 Z', fill: 'base', stroke: 'outline', strokeW: 2.4 }],
    },
    {
      name: 'armR',
      pivot: { x: 20, y: 62 },
      z: 3,
      shapes: [{ kind: 'path', d: 'M20,60 Q34,68 32,82 Q24,76 18,66 Z', fill: 'base', stroke: 'outline', strokeW: 2.4 }],
    },
    // antennae as ears so the renderer streams a gentle sway
    {
      name: 'earL',
      pivot: { x: -8, y: 8 },
      z: 4,
      shapes: [
        { kind: 'path', d: 'M-8,8 Q-16,-8 -18,-22', fill: undefined, stroke: 'outline', strokeW: 3 },
        { kind: 'circle', cx: -18, cy: -24, r: 5, fill: 'antenna', stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      name: 'earR',
      pivot: { x: 8, y: 8 },
      z: 4,
      shapes: [
        { kind: 'path', d: 'M8,8 Q16,-8 18,-22', fill: undefined, stroke: 'outline', strokeW: 3 },
        { kind: 'circle', cx: 18, cy: -24, r: 5, fill: 'antenna', stroke: 'outline', strokeW: 2 },
      ],
    },
    {
      name: 'head',
      pivot: { x: 0, y: 30 },
      z: 5,
      shapes: [
        // big bald dome (wider at the top, classic gray/green alien)
        { kind: 'ellipse', cx: 0, cy: 28, rx: 32, ry: 30, fill: 'base', stroke: 'outline', strokeW: 2.5 },
        { kind: 'ellipse', cx: -18, cy: 40, rx: 5, ry: 3.5, fill: 'cheek', opacity: 0.65 },
        { kind: 'ellipse', cx: 18, cy: 40, rx: 5, ry: 3.5, fill: 'cheek', opacity: 0.65 },
        // huge black almond eyes, tilted
        { kind: 'ellipse', cx: -12, cy: 28, rx: 9, ry: 13, rotation: -18, fill: EYE },
        { kind: 'ellipse', cx: 12, cy: 28, rx: 9, ry: 13, rotation: 18, fill: EYE },
        { kind: 'circle', cx: -14, cy: 22, r: 3, fill: HI },
        { kind: 'circle', cx: 10, cy: 22, r: 3, fill: HI },
        // tiny mouth
        { kind: 'path', d: 'M-4,46 Q0,49 4,46', fill: undefined, stroke: 'outline', strokeW: 2 },
      ],
    },
  ],
  poses: {
    idle: {},
    // glide hover is procedural (legs tuck, antennae sway).
    run: {},
    // skill: thrust both arms forward in a "scanning" beam gesture, head tips up.
    skill: { armL: { rot: -38, dy: -4 }, armR: { rot: 38, dy: -4 }, head: { dy: -3 } },
    // victory: arms thrown up, little hover-bounce.
    win: { armL: { rot: -32, dy: -4 }, armR: { rot: 32, dy: -4 }, head: { dy: -4 } },
    // fall: tipped, arms flail.
    fall: { head: { rot: 16 }, armL: { rot: 24 }, armR: { rot: -24 } },
  },
};
