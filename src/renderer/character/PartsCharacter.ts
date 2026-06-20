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
  /** Penguin only: it is currently inside an active icefield zone → belly-slide. */
  onIce?: boolean;
  /** Cat only: engine says it is hopping clear over an icefield zone → jump pose. */
  iceJumping?: boolean;
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
      case 'dejected':
        // Post-finish slump for the back-markers: a droopy idle (no win pose).
        return 'idle';
      default:
        return 'run';
    }
  }

  update(o: UpdateOpts): void {
    const poseName = this.poseFor(o.phase);
    const delta = this.model.poses[poseName] ?? {};
    const moving = o.phase === 'running' || o.phase === 'blocked' || o.phase === 'straying';
    const celebrating = o.phase === 'celebrate';
    // Post-finish back-marker slump: head down, droopy, a slow dejected sway.
    const dejected = o.phase === 'dejected';
    const amp = o.reducedMotion ? 0 : Math.max(0.4, o.speedNorm);
    // Penguin belly-slide: while inside an active icefield it drops prone and
    // glides on its tummy (flippers swept back), instead of the upright waddle.
    // Only while actually moving on the track (not on the podium / waiting).
    const penguin = this.model.id === 'penguin';
    const sliding = penguin && !o.reducedMotion && !!o.onIce && moving;
    // Cat ice-hop: while the engine says the cat is jumping clear of an icefield
    // zone, it springs into a graceful airborne bound (vs. everyone else slipping).
    // `hop01` arcs 0→1→0 over the cycle for the parabolic jump height.
    const catJumping = this.model.id === 'cat' && !o.reducedMotion && !!o.iceJumping && moving;
    // Eagle glide: a LIGHT airborne feel on top of the biped flow — a small steady
    // lift + gentle bob + a forward tilt (set below). Deliberately not the old
    // vertical hover / wing-flap; just "leaning into a glide". Display-only.
    const eagleGlide = this.model.id === 'eagle' && !o.reducedMotion && moving;
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
    // Cat ice-hop arc: a slow, smooth |sin| bound (own rate so it reads as a
    // deliberate leap, not a leg twitch). 1 at the apex of the jump.
    const catAir = catJumping ? Math.abs(Math.sin(o.clock * 5.5)) : 0;
    // Whole-body vertical lift: a big rabbit hop, the dog's gallop bound, or a
    // cocky victory jump on the podium.
    let lift = air * 30 * amp;
    if (style === 'gallop' && moving) lift = Math.abs(Math.sin(t)) * 7 * amp;
    if (celebrating) lift = Math.abs(Math.sin(t)) * 24 * amp;
    // Cat ice-hop: a big graceful bound floats well above the gallop bob.
    if (catJumping) lift = Math.max(lift, 14 + catAir * 46);
    // Eagle glide: float a little off the ground with a slow, gentle bob. Small on
    // purpose (≈10px + ±4) so it reads as a light glide, not a hover. Uses the
    // smooth `clock` (not the leg-cycle `t`) so the bob is calm.
    if (eagleGlide) lift = 10 + Math.sin(o.clock * 3.2) * 4;
    // Defeated slump sits a touch low — no bounce, head dropped.
    if (dejected) lift = -4;
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

      // Ears + tail stream for everyone (but a defeated slump keeps them limp).
      const earAmp = dejected ? 0 : amp;
      if (name === 'earL' || name === 'tail') rot += Math.sin(t - 0.6) * 22 * earAmp;
      else if (name === 'earR') rot -= Math.sin(t - 0.6) * 22 * earAmp;

      if (dejected) {
        // Defeated slump: head + body droop forward, arms hang limp, a slow,
        // small dejected sway (no leg cycle — it has stopped). (rot is DEGREES.)
        const sway = Math.sin(o.clock * 1.6);
        if (isFrontLeg) scaleX = scaleY = 0;
        else if (name === 'head') {
          dy += 9; // chin sinks toward the chest
          rot += 8 + sway * 3; // hung head, gently nodding
        } else if (name === 'body') {
          dy += 4;
          scaleY *= 0.94; // shoulders sag
          rot += sway * 3;
        } else if (name === 'armL') rot += 6 + sway * 4; // limp, dangling arms
        else if (name === 'armR') rot -= 6 + sway * 4;
        else if (name === 'legL' || name === 'legR') {
          rot += name === 'legL' ? 4 : -4; // feet planted, slightly splayed
        }
      } else if (celebrating) {
        // Cocky victory dance: kick legs, throw arms up, wag/wiggle.
        if (name === 'legL' || name === 'frontLegL') rot += Math.sin(t) * 16 * amp;
        else if (name === 'legR' || name === 'frontLegR') rot -= Math.sin(t) * 16 * amp;
        else if (name === 'armL') rot += 24 + Math.sin(t) * 22 * amp;
        else if (name === 'armR') rot -= 24 + Math.sin(t) * 22 * amp;
      } else if (catJumping) {
        // Cat ice-hop: a graceful leaping bound. Front legs reach forward, rear
        // legs extend back at the apex and gather under on the way down; the body
        // arcs and stretches into the leap. (rot is DEGREES.)
        if (isFrontLeg) {
          rot += (30 - catAir * 50) * amp; // reach out front, tuck on landing
          dy -= catAir * 5 * amp;
        } else if (name === 'legL' || name === 'legR') {
          rot += (-26 - catAir * 26) * amp; // hind legs sweep back as it springs
          dy -= catAir * 5 * amp;
        } else if (name === 'body') {
          scaleX *= (1 + 0.12 * catAir) * stretch; // stretch long mid-leap
          scaleY *= 1 - 0.06 * catAir;
          dy -= catAir * 2;
        } else if (name === 'head') {
          dy -= catAir * 3 * amp; // chin up, looking over the ice
        } else if (name === 'tail') {
          rot += 18 + catAir * 24; // tail lofts up for balance in the air
        }
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
      } else if (penguin) {
        // Penguin: cute *gliding* waddle — small alternating feet, a slidey
        // side-to-side body sway (the root tilt below carries the waddle), and
        // flippers that paddle a touch. On ice it goes prone and belly-slides:
        // feet tuck back, flippers sweep flat behind, the body whooshes flat.
        if (sliding) {
          if (isFrontLeg) scaleX = scaleY = 0;
          else if (name === 'legL' || name === 'legR') {
            // feet swept straight back behind the sliding belly, tucked up
            rot += name === 'legL' ? 30 : -30;
            dy -= 6;
          } else if (name === 'armL') {
            rot += 70 + Math.sin(t) * 6 * amp; // flipper raked back, paddling
          } else if (name === 'armR') {
            rot -= 70 + Math.sin(t) * 6 * amp;
          } else if (name === 'body') {
            scaleX *= 1.18 * stretch; // belly stretched flat along the glide
            scaleY *= 0.9;
            dy += 8; // body drops toward the ice
          } else if (name === 'head') {
            dy += 4; // chin tucked low, looking ahead over the ice
          }
        } else {
          // Gliding waddle: gentle, low-amplitude feet + a slidey paddle so it
          // reads as a smooth penguin shuffle rather than a marching biped.
          if (isFrontLeg) scaleX = scaleY = 0;
          else if (name === 'legL') rot += Math.sin(t) * 18 * amp;
          else if (name === 'legR') rot -= Math.sin(t) * 18 * amp;
          else if (name === 'armL') rot += 8 + Math.sin(t) * 14 * amp; // flippers paddle
          else if (name === 'armR') rot -= 8 + Math.sin(t) * 14 * amp;
          else if (name === 'body' || name === 'head') {
            dy += moving ? -Math.abs(Math.sin(t)) * 5 * amp : 0; // small bob (glidey)
            const sq = moving ? 1 - 0.05 * Math.sin(t * 2) * amp : 1;
            scaleY *= sq;
            scaleX *= (2 - sq) * stretch;
          }
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
    // Side-profile characters (gallop: dog/cat) are drawn looking +x, so mirror
    // them to face the direction of travel — left on the top straight & curves.
    // Front-facing chibis (biped/scamper) always face the viewer, so they must
    // NOT mirror (it would flip their face on the far side).
    this.inner.scale.x = this.runStyle === 'gallop' ? dir : 1;
    if (o.reducedMotion) this.root.rotation = 0;
    else if (dejected) this.root.rotation = Math.sin(o.clock * 1.6) * 0.05; // small defeated sway, slumped
    else if (celebrating) this.root.rotation = Math.sin(t * 0.7) * 0.16 * amp; // cocky sway
    // Skill thrust: a quick forward crouch-and-shove so the activation reads as a
    // deliberate "action" (root.rotation is RADIANS — ~0.22rad ≈ 13° lean).
    else if (skilling) this.root.rotation = dir * (0.2 + Math.abs(Math.sin(t * 0.5)) * 0.1);
    else if (catJumping) this.root.rotation = dir * (0.05 - catAir * 0.16); // nose lifts into the leap (root.rotation is RADIANS)
    else if (o.phase === 'stunned') this.root.rotation = dir * 0.7; // tipped over
    else if (o.phase === 'napping') this.root.rotation = -dir * 0.18; // dozing lean-back
    else if (style === 'gallop') this.root.rotation = dir * (0.05 + o.speedNorm * 0.06); // body already horizontal; slight pitch
    else if (style === 'hop') this.root.rotation = dir * (0.03 + air * 0.18 * amp); // lean into the leap
    else if (style === 'scamper') this.root.rotation = dir * (0.1 + o.speedNorm * 0.1); // eager forward lean
    else if (sliding) this.root.rotation = dir * (0.42 + o.speedNorm * 0.12); // pitched prone onto the belly, whooshing along the ice
    else if (penguin) this.root.rotation = dir * 0.06 + Math.sin(t) * 0.16 * amp; // gliding waddle: side-to-side sway
    // Eagle glide: tip forward into the glide (a touch more than a plain biped
    // lean) with a gentle bob-synced sway. Light — root.rotation is RADIANS, so
    // ~0.2rad ≈ 11° tilt. No banking/flap. (Falls through to default at rest.)
    else if (eagleGlide) this.root.rotation = dir * (0.18 + o.speedNorm * 0.08) + Math.sin(o.clock * 3.2) * 0.03;
    else this.root.rotation = dir * (0.06 + o.speedNorm * 0.12);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
