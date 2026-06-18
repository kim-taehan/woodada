/**
 * Builds a character Container from a PartModel and animates it procedurally
 * (squash & stretch, leg cycle, ear/tail jiggle) on top of the static parts,
 * blending in skill/win/fall pose deltas (spec §2.5, §2.6). The renderer feeds
 * it the racer's phase + speed each frame; it owns no simulation state.
 */

import { Container, Graphics } from 'pixi.js';
import type { Palette } from '../../data/schema.ts';
import type { PartModel, PartTransform, PoseName, PartShape } from '../../data/partmodels/types.ts';
import { buildPart } from './partsFactory.ts';
import { teamPalette, type TeamId } from '../../data/teams.ts';

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function isTeamId(id: string | undefined): id is TeamId {
  return id === 'red' || id === 'blue' || id === 'white' || id === 'black';
}

/**
 * Builds the team vest overlay from the torso's base ellipse. It hugs the upper/
 * centre of the torso (chest + back), leaving the belly and the body's own
 * outline visible at the edges so the silhouette stays cute. The trim stroke is
 * always drawn so white/black vests never melt into the background or outline.
 */
function buildVest(bodyShapes: PartShape[], team: { fill: string; trim: string }): Graphics | null {
  const base = bodyShapes.find((s): s is Extract<PartShape, { kind: 'ellipse' }> => s.kind === 'ellipse');
  if (!base) return null;
  const cx = base.cx;
  const cy = base.cy - base.ry * 0.16; // sit a touch high on the chest/back
  const rx = base.rx * 0.82;
  const ry = base.ry * 0.7;
  const g = new Graphics();
  g.ellipse(cx, cy, rx, ry).fill({ color: hexToNum(team.fill) });
  g.stroke({ color: hexToNum(team.trim), width: 3, alpha: 1, join: 'round' });
  return g;
}

const DEG = Math.PI / 180;

interface UpdateOpts {
  phase: string;
  /** 0..1 speed amplitude. */
  speedNorm: number;
  /** seconds accumulated. */
  clock: number;
  facing: number;
  /** +1 = travelling right, -1 = travelling left (used to face/lean). */
  heading: number;
  reducedMotion: boolean;
}

interface PartView {
  container: Container;
  base: { x: number; y: number };
  cur: Required<PartTransform>;
}

const ZERO: Required<PartTransform> = { dx: 0, dy: 0, rot: 0, scaleX: 1, scaleY: 1 };

export class PartsCharacter {
  readonly root: Container;
  private readonly inner: Container;
  private readonly model: PartModel;
  private readonly runStyle: string;
  private readonly parts = new Map<string, PartView>();

  constructor(model: PartModel, palette: Palette, runStyle = 'biped', scale = 0.36, teamId?: string) {
    this.model = model;
    this.runStyle = runStyle;
    this.root = new Container();
    this.root.scale.set(scale);

    this.inner = new Container();
    this.inner.sortableChildren = true;
    this.inner.y = -55; // centre the visual mass on the placement point
    this.root.addChild(this.inner);

    for (const part of model.parts) {
      const c = buildPart(part, palette);
      this.inner.addChild(c);
      this.parts.set(part.name, {
        container: c,
        base: { x: part.pivot.x, y: part.pivot.y },
        cur: { ...ZERO },
      });
      // Team vest: a coloured overlay layered onto the torso only. Lives inside
      // the body part container so it swings + squashes with the torso. Face,
      // eyes, ears, legs, tail keep their own colours (chibi cuteness preserved).
      if (part.name === 'body' && isTeamId(teamId)) {
        const vest = buildVest(part.shapes, teamPalette[teamId]);
        if (vest) c.addChild(vest);
      }
    }
  }

  private poseFor(phase: string): PoseName {
    switch (phase) {
      case 'finished':
        return 'win';
      case 'stunned':
        return 'fall';
      case 'straying':
        return 'skill';
      case 'celebrate':
        return 'win';
      default:
        return 'run';
    }
  }

  update(o: UpdateOpts): void {
    const poseName = this.poseFor(o.phase);
    const delta = this.model.poses[poseName] ?? {};
    const moving = o.phase === 'running' || o.phase === 'blocked' || o.phase === 'straying';
    const celebrating = o.phase === 'celebrate';
    const amp = o.reducedMotion ? 0 : Math.max(0.4, o.speedNorm);
    const style = o.reducedMotion ? 'biped' : this.runStyle;

    // Cycle clock; rate per locomotion style. Rabbit hops with a longer term.
    const rate = celebrating ? 9 : style === 'gallop' ? 14 + o.speedNorm * 8 : style === 'hop' ? 4 + o.speedNorm * 2.5 : 8 + o.speedNorm * 12;
    const t = o.clock * rate;
    // Bursting forward (zoomies / nap-dash) stretches the body ahead.
    const skilling = o.phase === 'straying';
    const stretch = skilling ? 1.26 : 1;
    // Punch up the authored skill pose so the activation "action" reads at a
    // glance: amplify the pose delta and snap toward it faster than the gentle
    // run-cycle blend. (rot deltas are DEGREES, so a 1.8× of a -34° wing swing
    // is still well within range.)
    const poseAmp = skilling ? 1.8 : 1;
    const blend = skilling ? 0.4 : 0.25;

    // How airborne the rabbit is this frame (1 at the top of the hop).
    const air = style === 'hop' && moving ? Math.abs(Math.sin(t)) : 0;
    // Whole-body vertical lift: a big rabbit hop, the dog's gallop bound, or a
    // cocky victory jump on the podium.
    let lift = air * 30 * amp;
    if (style === 'gallop' && moving) lift = Math.abs(Math.sin(t)) * 7 * amp;
    if (celebrating) lift = Math.abs(Math.sin(t)) * 24 * amp;
    // Flyer (eagle): floats above the track line — a constant hover offset plus a
    // gentle vertical bob. No ground contact, so the lift applies whenever it's
    // airborne (idle hover too), not just while "moving".
    if (style === 'fly' && !celebrating) {
      const bob = Math.sin(o.clock * 3.4) * 6; // slow, smooth bob (clock, not cycle t)
      lift = 26 + bob; // hover height above the line
    }
    this.inner.y = -55 - lift;

    for (const [name, view] of this.parts) {
      // Smoothly blend the stored transform toward the pose delta. The skill
      // pose is amplified + snapped in faster so the action punches through.
      const target = delta[name] ?? {};
      view.cur.dx += ((target.dx ?? 0) * poseAmp - view.cur.dx) * blend;
      view.cur.dy += ((target.dy ?? 0) * poseAmp - view.cur.dy) * blend;
      view.cur.rot += ((target.rot ?? 0) * poseAmp - view.cur.rot) * blend;
      view.cur.scaleX += ((target.scaleX ?? 1) - view.cur.scaleX) * blend;
      view.cur.scaleY += ((target.scaleY ?? 1) - view.cur.scaleY) * blend;

      let { dx, dy, rot, scaleX, scaleY } = view.cur;
      // NOTE: `rot` is in DEGREES (converted via *DEG below), so swing amplitudes
      // are tens of degrees, not radians.
      const isFrontLeg = name === 'frontLegL' || name === 'frontLegR';

      // Ears + tail stream for everyone.
      if (name === 'earL' || name === 'tail') rot += Math.sin(t - 0.6) * 22 * amp;
      else if (name === 'earR') rot -= Math.sin(t - 0.6) * 22 * amp;

      if (celebrating) {
        // Cocky victory dance: kick legs, throw arms up, wag/wiggle.
        if (name === 'legL' || name === 'frontLegL') rot += Math.sin(t) * 16 * amp;
        else if (name === 'legR' || name === 'frontLegR') rot -= Math.sin(t) * 16 * amp;
        else if (name === 'armL') rot += 24 + Math.sin(t) * 22 * amp;
        else if (name === 'armR') rot -= 24 + Math.sin(t) * 22 * amp;
      } else if (style === 'gallop') {
        // Dog side-profile gallop: front pair reaches forward while the rear pair
        // pushes back, then both gather under the body. Far legs lag slightly.
        const far = name === 'legR' || name === 'frontLegR';
        const swing = moving ? Math.sin(t + (far ? 0.5 : 0)) : 0;
        if (isFrontLeg) {
          rot += swing * 42 * amp; // reach forward / tuck under
        } else if (name === 'legL' || name === 'legR') {
          rot += -swing * 42 * amp; // push back / tuck under
        } else if (name === 'body') {
          const ext = moving ? Math.sin(t) : 0;
          scaleX *= (1 + 0.08 * ext * amp) * stretch; // lengthen on extension
          scaleY *= 1 - 0.05 * ext * amp;
        } else if (name === 'head') {
          dy += moving ? Math.sin(t) * 2 * amp : 0; // gentle head bob
        }
      } else if (style === 'scamper') {
        // Monkey: cheeky troublemaker scamper — quick feet, big flailing arms,
        // eager bounce. (Tail already sways via the stream above.)
        if (isFrontLeg) {
          scaleX = scaleY = 0;
        } else if (name === 'legL') {
          rot += Math.sin(t) * 32 * amp;
        } else if (name === 'legR') {
          rot -= Math.sin(t) * 32 * amp;
        } else if (name === 'armL') {
          rot += -30 + Math.sin(t) * 55 * amp; // big alternating flail
        } else if (name === 'armR') {
          rot += 30 - Math.sin(t) * 55 * amp;
        } else if (name === 'body' || name === 'head') {
          dy += moving ? -Math.abs(Math.sin(t)) * 13 * amp : 0;
          const sq = moving ? 1 - 0.12 * Math.sin(t * 2) * amp : 1;
          scaleY *= sq;
          scaleX *= (2 - sq) * stretch;
        }
      } else if (style === 'hop') {
        // Rabbit: tuck legs + stretch forward at the apex, splay + squash on landing.
        const land = moving ? 1 - air : 0; // 1 on the ground
        if (isFrontLeg) scaleX = scaleY = 0;
        else if (name === 'legL' || name === 'legR') {
          dy -= air * 7 * amp; // legs lift toward the body in flight
          rot += (name === 'legL' ? 1 : -1) * air * 28 * amp;
        } else if (name === 'body' || name === 'head') {
          scaleY *= 1 - 0.16 * land * amp; // squash on landing
          scaleX *= (1 + 0.1 * land * amp + 0.08 * air * amp) * stretch; // stretch forward mid-leap
        }
      } else if (style === 'fly') {
        // Eagle: airborne hover — wings flap up/down (the main silhouette), the
        // little talons stay tucked (no stepping), the body breathes gently.
        // `rot` is DEGREES; a strong flap is tens of degrees.
        const flap = Math.sin(t * 0.5); // slower than a leg cycle so wings read
        if (name === 'wingL') {
          rot += -flap * 30 * (0.6 + amp * 0.4); // negative raises the left wing
          dy += -Math.abs(flap) * 3;
        } else if (name === 'wingR') {
          rot += flap * 30 * (0.6 + amp * 0.4); // positive raises the right wing
          dy += -Math.abs(flap) * 3;
        } else if (name === 'legL' || name === 'legR') {
          // tucked talons sway a touch with the bob; never step
          rot += Math.sin(t * 0.5) * 4;
        } else if (name === 'body') {
          const breathe = Math.sin(t * 0.5);
          scaleY *= 1 + 0.04 * breathe;
          scaleX *= (1 - 0.03 * breathe) * stretch;
        } else if (name === 'head') {
          dy += Math.sin(o.clock * 3.4 + 0.4) * 1.5; // tiny head bob in sync with hover
        }
      } else {
        // Biped / swing (monkey, fallback): alternating legs + arm swing.
        if (isFrontLeg) scaleX = scaleY = 0;
        else if (name === 'legL') rot += Math.sin(t) * 36 * amp;
        else if (name === 'legR') rot -= Math.sin(t) * 36 * amp;
        else if (name === 'armL') rot += Math.sin(t) * 30 * amp;
        else if (name === 'armR') rot -= Math.sin(t) * 30 * amp;
        else if (name === 'body' || name === 'head') {
          dy += moving ? -Math.abs(Math.sin(t)) * 11 * amp : 0;
          const sq = moving ? 1 - 0.1 * Math.sin(t * 2) * amp : 1;
          scaleY *= sq;
          scaleX *= (2 - sq) * stretch;
        }
      }

      view.container.position.set(view.base.x + dx, view.base.y + dy);
      view.container.rotation = rot * DEG;
      view.container.scale.set(scaleX, scaleY);
    }

    // Whole-body pose: face the running direction, lean, tumble when knocked.
    const dir = o.heading >= 0 ? 1 : -1;
    this.inner.scale.x = dir;
    if (o.reducedMotion) this.root.rotation = 0;
    else if (celebrating) this.root.rotation = Math.sin(t * 0.7) * 0.16 * amp; // cocky sway
    // Skill thrust: a quick forward crouch-and-shove so the activation reads as a
    // deliberate "action" (root.rotation is RADIANS — ~0.22rad ≈ 13° lean).
    else if (skilling && style !== 'fly') this.root.rotation = dir * (0.2 + Math.abs(Math.sin(t * 0.5)) * 0.1);
    else if (o.phase === 'stunned') this.root.rotation = dir * 0.7; // tipped over
    else if (o.phase === 'napping') this.root.rotation = -dir * 0.18; // dozing lean-back
    else if (style === 'gallop') this.root.rotation = dir * (0.05 + o.speedNorm * 0.06); // body already horizontal; slight pitch
    else if (style === 'hop') this.root.rotation = dir * (0.03 + air * 0.18 * amp); // lean into the leap
    else if (style === 'fly') this.root.rotation = dir * 0.04 + Math.sin(o.clock * 3.4) * 0.03; // float level, slight bank with the bob
    else if (style === 'scamper') this.root.rotation = dir * (0.1 + o.speedNorm * 0.1); // eager forward lean
    else this.root.rotation = dir * (0.06 + o.speedNorm * 0.12);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
