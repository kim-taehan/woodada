/**
 * Transient particle effects for skill activations (spec §2.3): big dust bursts
 * (zoomies), a banana that arcs to its target, stars on a hit, feathers on an
 * eagle divebomb, quills flaring on a hedgehog bristle, whiff on a dodge, and speed
 * lines on a burst. Pure visual fluff — spawned from engine events, never feeding
 * back into the simulation.
 */

import { Container, Graphics, Text } from 'pixi.js';

interface Particle {
  g: Container;
  bornAt: number;
  ttl: number;
  // Linear motion:
  vx: number;
  vy: number;
  gravity: number;
  // Or arc tween (banana throw):
  arc?: { fromX: number; fromY: number; toX: number; toY: number; lift: number };
  spin?: number;
  /** Scale growth over life (expanding ring). */
  grow?: number;
  fade: boolean;
  /** Authored alpha at spawn; crowd intensity is multiplied onto this each frame. */
  baseAlpha: number;
}

export class FxLayer {
  readonly root = new Container();
  private particles: Particle[] = [];
  /**
   * Global transient-FX alpha multiplier (1 = full). The renderer lowers it as the
   * field crowds so 16 overlapping bursts (glow pops, sparkles, rings) don't sum
   * into one white blob; it stays 1 for small fields so the look is unchanged. The
   * baseline alpha is captured per particle at spawn (`baseAlpha`) and re-multiplied
   * each frame, so changing intensity mid-life is consistent.
   */
  private intensity = 1;

  /** Crowd-aware transient-FX alpha scale (renderer sets it per race). */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  private push(g: Container, p: Partial<Particle> & { bornAt: number; ttl: number }): void {
    this.root.addChild(g);
    // Capture the glyph's authored alpha so the per-frame fade can re-apply the
    // crowd intensity on top of it without compounding.
    this.particles.push({ g, vx: 0, vy: 0, gravity: 0, fade: true, baseAlpha: g.alpha, ...p });
    g.alpha *= this.intensity;
  }

  dust(x: number, y: number, now: number): void {
    for (let i = 0; i < 14; i++) {
      const r = 6 + (i % 4) * 3;
      const g = new Graphics().circle(0, 0, r).fill({ color: 0xe8d3a8, alpha: 0.95 });
      g.position.set(x, y);
      this.push(g, { bornAt: now, ttl: 0.7, vx: (i - 7) * 34, vy: -18 - i * 5, gravity: 60 });
    }
  }

  speedLines(x: number, y: number, dir: number, now: number): void {
    for (let i = 0; i < 6; i++) {
      const len = 38 + (i % 3) * 10;
      const g = new Graphics().roundRect(0, 0, len, 5, 2.5).fill({ color: 0xffffff, alpha: 0.85 });
      g.position.set(x, y - 18 + i * 7);
      this.push(g, { bornAt: now, ttl: 0.45, vx: -dir * 300, vy: 0 });
    }
  }

  stars(x: number, y: number, now: number): void {
    for (let i = 0; i < 10; i++) {
      const g = new Text({ text: '★', style: { fontSize: 24 + (i % 2) * 6, fill: 0xffd23f } });
      g.anchor.set(0.5);
      g.position.set(x, y - 22);
      const a = (i / 10) * Math.PI * 2;
      this.push(g, { bornAt: now, ttl: 1.0, vx: Math.cos(a) * 64, vy: Math.sin(a) * 64 - 18, gravity: 40, spin: 8 });
    }
  }

  /** Banana thrown along an arc from thrower to target. */
  bananaThrow(fromX: number, fromY: number, toX: number, toY: number, now: number): void {
    const g = new Text({ text: '🍌', style: { fontSize: 34 } });
    g.anchor.set(0.5);
    g.position.set(fromX, fromY);
    this.push(g, {
      bornAt: now,
      ttl: 0.5,
      fade: false,
      spin: 14,
      arc: { fromX, fromY: fromY - 16, toX, toY: toY - 16, lift: 80 },
    });
  }

  sparkle(x: number, y: number, now: number): void {
    for (let i = 0; i < 9; i++) {
      const g = new Text({ text: '✨', style: { fontSize: 20 + (i % 3) * 6 } });
      g.anchor.set(0.5);
      const a = (i / 9) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 40, y - 18 + Math.sin(a) * 38);
      this.push(g, { bornAt: now, ttl: 1.0, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16 - 8, spin: 2 });
    }
  }

  /**
   * Post-finish celebration: a 💗 floats up off a cheering podium-bound racer.
   * Decorative; spawned by the finish-line scatter (#33). Reduced-motion skips.
   */
  heart(x: number, y: number, now: number): void {
    const g = new Text({ text: '💗', style: { fontSize: 26 } });
    g.anchor.set(0.5);
    g.position.set(x + (((now * 60) | 0) % 3) * 6 - 6, y);
    this.push(g, { bornAt: now, ttl: 1.1, vx: 0, vy: -42, spin: 0 });
  }

  /**
   * Post-finish dejection: a 💧 sweat-drop slides down off a slumped back-marker
   * (#33). Decorative; reduced-motion skips it.
   */
  sweat(x: number, y: number, now: number): void {
    const g = new Text({ text: '💧', style: { fontSize: 22 } });
    g.anchor.set(0.5);
    g.position.set(x, y);
    this.push(g, { bornAt: now, ttl: 0.9, vx: 6, vy: 34, gravity: 30 });
  }

  /**
   * Punchy activation pop on the actor: a bright white core flash + a snappy
   * expanding ring in the actor's accent tint. Drawn at the instant a skill
   * fires so the eye is pulled straight to WHO acted. Decorative only.
   */
  pop(x: number, y: number, tint: number, now: number): void {
    const core = new Graphics().circle(0, 0, 18).fill({ color: 0xffffff, alpha: 0.85 });
    core.position.set(x, y - 16);
    core.blendMode = 'add';
    this.push(core, { bornAt: now, ttl: 0.24, grow: 1.1 });

    const ring = new Graphics().circle(0, 0, 20).stroke({ color: tint, width: 8, alpha: 1 });
    ring.position.set(x, y - 16);
    this.push(ring, { bornAt: now, ttl: 0.5, grow: 3.0 });
  }

  /**
   * Relay baton hand-off: a baton glyph that dashes from the finisher to the
   * outgoing teammate, a burst of sparkles, and a small pop ring at the line.
   */
  baton(fromX: number, fromY: number, toX: number, toY: number, now: number): void {
    const ring = new Graphics().circle(0, 0, 18).stroke({ color: 0xffe24d, width: 7, alpha: 1 });
    ring.position.set(toX, toY - 8);
    this.push(ring, { bornAt: now, ttl: 0.5, grow: 7 });

    const g = new Graphics().roundRect(-13, -4, 26, 8, 4).fill({ color: 0xffd23f }).stroke({ color: 0x7a3b10, width: 2 });
    g.position.set(fromX, fromY);
    this.push(g, {
      bornAt: now,
      ttl: 0.45,
      fade: false,
      spin: 10,
      arc: { fromX, fromY: fromY - 14, toX, toY: toY - 14, lift: 46 },
    });

    for (let i = 0; i < 7; i++) {
      const s = new Text({ text: '✨', style: { fontSize: 16 + (i % 2) * 4 } });
      s.anchor.set(0.5);
      const a = (i / 7) * Math.PI * 2;
      s.position.set(toX + Math.cos(a) * 24, toY - 16 + Math.sin(a) * 22);
      this.push(s, { bornAt: now, ttl: 0.7, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18 - 8, spin: 2 });
    }
  }

  /** Expanding shockwave ring (bear roar) — wide AOE, scaled to the roar's reach. */
  shockwave(x: number, y: number, now: number): void {
    // Bright leading ring (thick, opaque) + a trailing inner ring so the blast
    // reads as a punchy double pulse rather than one faint hoop.
    const ring = new Graphics().circle(0, 0, 34).stroke({ color: 0xfff0c0, width: 18, alpha: 1 });
    ring.position.set(x, y - 8);
    this.push(ring, { bornAt: now, ttl: 0.7, grow: 12 });

    const inner = new Graphics().circle(0, 0, 24).stroke({ color: 0xffffff, width: 8, alpha: 0.95 });
    inner.position.set(x, y - 8);
    inner.blendMode = 'add';
    this.push(inner, { bornAt: now, ttl: 0.5, grow: 9 });
  }

  /** Feathers scattering when the eagle's headbutt connects — drift down + sideways. */
  feathers(x: number, y: number, now: number): void {
    for (let i = 0; i < 8; i++) {
      const g = new Text({ text: '🪶', style: { fontSize: 15 + (i % 3) * 3 } });
      g.anchor.set(0.5);
      g.position.set(x, y - 18);
      const a = (i / 8) * Math.PI * 2;
      this.push(g, { bornAt: now, ttl: 1.0, vx: Math.cos(a) * 50, vy: Math.sin(a) * 36 - 30, gravity: 70, spin: (i % 2 ? 3 : -3) });
    }
  }

  /**
   * Eagle headbutt impact: a 💥 burst at the strike point plus a few short shock
   * lines flung outward from it, reading as a head-first "쿵". `from→to` carries
   * the lunge direction so the lines flare along the way the eagle rammed in.
   */
  swoop(fromX: number, fromY: number, toX: number, toY: number, now: number): void {
    const g = new Text({ text: '💥', style: { fontSize: 30 } });
    g.anchor.set(0.5);
    g.position.set(toX, toY - 16);
    this.push(g, { bornAt: now, ttl: 0.35, fade: true, grow: 0.6 });
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    for (let i = 0; i < 3; i++) {
      const line = new Graphics().roundRect(0, 0, 26, 3, 1.5).fill({ color: 0xffffff, alpha: 0.7 });
      line.position.set(toX, toY - 16 + (i - 1) * 8);
      this.push(line, { bornAt: now, ttl: 0.28, vx: ux * 240, vy: uy * 240 });
    }
  }

  /**
   * Roar stagger on a victim — distinct from a banana's slip. A ring of dizzy
   * 💫 swirling tightly over the head + a sharp little impact ring slamming into
   * the victim, so a roar reads as "got shaken by the shockwave", not "stepped on
   * a banana". Plays on each victim (the roar emits one `hit` per racer).
   */
  dizzy(x: number, y: number, now: number): void {
    // Tight swirl of dizzy stars orbiting the head (spin in place, slow drift up).
    for (let i = 0; i < 6; i++) {
      const g = new Text({ text: i % 2 ? '💫' : '⭐', style: { fontSize: 18 + (i % 2) * 4 } });
      g.anchor.set(0.5);
      const a = (i / 6) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 18, y - 34 + Math.sin(a) * 8);
      this.push(g, { bornAt: now, ttl: 0.9, vx: Math.cos(a) * 10, vy: -14, spin: i % 2 ? 7 : -7 });
    }
    // Sharp impact ring slamming into the victim (the shockwave reaching them).
    const ring = new Graphics().circle(0, 0, 14).stroke({ color: 0xfff0c0, width: 7, alpha: 1 });
    ring.position.set(x, y - 14);
    this.push(ring, { bornAt: now, ttl: 0.35, grow: 2.4 });
  }

  whiff(x: number, y: number, now: number): void {
    const g = new Text({ text: '휙~', style: { fontSize: 24, fontWeight: '800', fill: 0xb5702e } });
    g.anchor.set(0.5);
    g.position.set(x, y - 16);
    this.push(g, { bornAt: now, ttl: 0.7, vx: 30, vy: -24 });
  }

  /**
   * Divebomb SUCCESS cue on the eagle (the gamble paid off): a triumphant GOLD
   * burst — a bright golden core flash, a fat gold ring, radiating gold spark
   * rays, and a "명중!" pop. Warm/bright so a clean hit reads instantly as a WIN,
   * contrasting the dull-grey self-botch slump below.
   */
  goldBurst(x: number, y: number, now: number): void {
    // Bright golden core flash + a fat expanding gold ring.
    const core = new Graphics().circle(0, 0, 22).fill({ color: 0xfff3b0, alpha: 0.95 });
    core.position.set(x, y - 16);
    core.blendMode = 'add';
    this.push(core, { bornAt: now, ttl: 0.3, grow: 1.4 });

    const ring = new Graphics().circle(0, 0, 22).stroke({ color: 0xffc629, width: 9, alpha: 1 });
    ring.position.set(x, y - 16);
    ring.blendMode = 'add';
    this.push(ring, { bornAt: now, ttl: 0.5, grow: 3.4 });

    // Radiating gold spark rays flung outward — celebratory "did it!" sunburst.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ray = new Graphics().roundRect(0, 0, 24, 4, 2).fill({ color: 0xffd23f, alpha: 0.95 });
      ray.position.set(x, y - 16);
      ray.rotation = a;
      ray.blendMode = 'add';
      this.push(ray, { bornAt: now, ttl: 0.4, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200 });
    }

    const tag = new Text({ text: '명중!', style: { fontSize: 26, fontWeight: '900', fill: 0xffb300, stroke: { color: 0xffffff, width: 4 } } });
    tag.anchor.set(0.5);
    tag.position.set(x, y - 40);
    this.push(tag, { bornAt: now, ttl: 0.8, vx: 0, vy: -36 });
  }

  /**
   * Divebomb FAILURE cue on the eagle (gamble lost, face-planted itself): a dull,
   * deflated GREY slump — a grey dust puff billowing low, drooping grey dizzy
   * swirl over the head, a sweat-bead and a "꽝..." pop. Cold/muted so a self-botch
   * reads instantly as a flop, the opposite of the bright-gold hit.
   */
  dustSlump(x: number, y: number, now: number): void {
    // Low billow of dull grey dust (heavier + greyer than the warm `dust`).
    for (let i = 0; i < 12; i++) {
      const r = 7 + (i % 4) * 3;
      const shade = i % 2 ? 0x9a9a9a : 0xbdbdbd;
      const g = new Graphics().circle(0, 0, r).fill({ color: shade, alpha: 0.85 });
      g.position.set(x, y + 8);
      this.push(g, { bornAt: now, ttl: 0.8, vx: (i - 6) * 30, vy: -10 - (i % 3) * 6, gravity: 50 });
    }
    // Drooping grey dizzy swirl — same orbit idea as `dizzy` but muted grey so the
    // failure reads "dazed in a sad grey cloud", not the bright stars of a victim hit.
    for (let i = 0; i < 5; i++) {
      const g = new Text({ text: i % 2 ? '💫' : '😵', style: { fontSize: 18 + (i % 2) * 3 } });
      g.anchor.set(0.5);
      const a = (i / 5) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 16, y - 30 + Math.sin(a) * 7);
      // grey-tint the swirl glyphs so even the emoji read as drained/cold.
      g.tint = 0xb8b8c0;
      this.push(g, { bornAt: now, ttl: 0.9, vx: Math.cos(a) * 8, vy: -8, spin: i % 2 ? 5 : -5 });
    }
    // A sad sweat-bead sliding off the slumped head.
    const drop = new Text({ text: '💧', style: { fontSize: 20 } });
    drop.anchor.set(0.5);
    drop.position.set(x + 14, y - 28);
    this.push(drop, { bornAt: now, ttl: 0.8, vx: 8, vy: 28, gravity: 24 });

    const tag = new Text({ text: '꽝...', style: { fontSize: 24, fontWeight: '900', fill: 0x8a8a8a, stroke: { color: 0xffffff, width: 3 } } });
    tag.anchor.set(0.5);
    tag.position.set(x, y - 44);
    this.push(tag, { bornAt: now, ttl: 0.9, vx: 0, vy: 8, gravity: 18 });
  }

  /**
   * ⚡ Lightning strike: a full-screen white flash plus a jagged bolt + sparks
   * raining over the racer who ate the box. Big and punchy so "everyone else got
   * zapped" reads instantly. `w`/`h` size the flash to the whole canvas.
   */
  lightning(x: number, y: number, w: number, h: number, now: number): void {
    // Screen flash: a wide white sheet that snaps bright then fades fast.
    const flash = new Graphics().rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.85 });
    flash.blendMode = 'add';
    this.push(flash, { bornAt: now, ttl: 0.32 });

    // Jagged bolt down onto the eater (deterministic zig-zag).
    const bolt = new Graphics();
    let bx = 0;
    let by = -150;
    bolt.moveTo(bx, by);
    for (let i = 0; i < 6; i++) {
      bx += (i % 2 ? 16 : -16);
      by += 26;
      bolt.lineTo(bx, by);
    }
    bolt.stroke({ color: 0xfff36b, width: 7, alpha: 1 });
    bolt.position.set(x, y);
    bolt.blendMode = 'add';
    this.push(bolt, { bornAt: now, ttl: 0.4 });

    // ⚡ spark glyphs bursting off the eater.
    for (let i = 0; i < 7; i++) {
      const g = new Text({ text: '⚡', style: { fontSize: 22 + (i % 2) * 8 } });
      g.anchor.set(0.5);
      const a = (i / 7) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 12, y - 18 + Math.sin(a) * 12);
      this.push(g, { bornAt: now, ttl: 0.6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 20, spin: i % 2 ? 5 : -5 });
    }
  }

  /**
   * 💨 Fart cloud trailing behind the racer who let one rip: a puff of expanding
   * greenish clouds + 💨 glyphs drifting back so "the racers behind got gassed"
   * reads. `dir` is the racer's screen-x travel sign (cloud drifts backward).
   */
  fart(x: number, y: number, dir: number, now: number): void {
    for (let i = 0; i < 6; i++) {
      const r = 12 + (i % 3) * 6;
      const g = new Graphics().circle(0, 0, r).fill({ color: 0xb6cf6a, alpha: 0.5 });
      g.position.set(x - dir * (10 + i * 6), y + 6 - (i % 2) * 8);
      g.blendMode = 'normal';
      this.push(g, { bornAt: now, ttl: 1.1, vx: -dir * (40 + i * 8), vy: -10 - i * 2, grow: 1.4 });
    }
    for (let i = 0; i < 4; i++) {
      const g = new Text({ text: '💨', style: { fontSize: 22 + (i % 2) * 8 } });
      g.anchor.set(0.5);
      g.position.set(x - dir * 8, y);
      this.push(g, { bornAt: now, ttl: 1.0, vx: -dir * (70 + i * 18), vy: -16 - i * 6, spin: i % 2 ? 2 : -2 });
    }
  }

  /** 🐢 Shell launched from the eater toward the leader, along an arc. */
  shellThrow(fromX: number, fromY: number, toX: number, toY: number, now: number): void {
    const g = new Text({ text: '🐢', style: { fontSize: 34 } });
    g.anchor.set(0.5);
    g.position.set(fromX, fromY);
    this.push(g, {
      bornAt: now,
      ttl: 0.55,
      fade: false,
      spin: 12,
      arc: { fromX, fromY: fromY - 16, toX, toY: toY - 16, lift: 70 },
    });
  }

  /**
   * ⭐ Star-invincibility burst on the eater the instant the star pops: a rainbow
   * ring + a shower of ✨/⭐ so the moment of going invincible is loud. The ongoing
   * "I'm invincible right now" shimmer is drawn separately by the renderer.
   */
  starBurst(x: number, y: number, now: number): void {
    const RAINBOW = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93];
    RAINBOW.forEach((color, i) => {
      const ring = new Graphics().circle(0, 0, 16 + i * 6).stroke({ color, width: 6, alpha: 1 });
      ring.position.set(x, y - 16);
      ring.blendMode = 'add';
      this.push(ring, { bornAt: now, ttl: 0.6 + i * 0.04, grow: 3.2 });
    });
    for (let i = 0; i < 12; i++) {
      const g = new Text({ text: i % 2 ? '⭐' : '✨', style: { fontSize: 20 + (i % 3) * 6 } });
      g.anchor.set(0.5);
      const a = (i / 12) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 20, y - 16 + Math.sin(a) * 20);
      this.push(g, { bornAt: now, ttl: 1.0, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 16, spin: i % 2 ? 6 : -6 });
    }
  }

  /**
   * ⭐ Per-frame star shimmer: a couple of ⭐/✨ glints popping around a racer who
   * is currently invincible. Called each frame (throttled by the caller) so the
   * rainbow glow has a continuous sparkle while the star window is live.
   */
  starGlint(x: number, y: number, now: number): void {
    const g = new Text({ text: Math.sin(now * 30) > 0 ? '⭐' : '✨', style: { fontSize: 18 } });
    g.anchor.set(0.5);
    const a = now * 7;
    g.position.set(x + Math.cos(a) * 26, y - 18 + Math.sin(a) * 22);
    this.push(g, { bornAt: now, ttl: 0.45, vx: 0, vy: -20, spin: 4 });
  }

  /**
   * 💫 Per-frame stun glint: a single dizzy star orbiting tightly over a STUNNED
   * racer's head. Called each frame (throttled by the caller) so "기절 중" reads for
   * the whole stun window, not just the impact instant. Lighter than `dizzy` (which
   * is the one-shot impact burst). Orbits in place + spins; barely drifts.
   */
  dizzyGlint(x: number, y: number, now: number): void {
    const g = new Text({ text: Math.sin(now * 20) > 0 ? '💫' : '⭐', style: { fontSize: 18 } });
    g.anchor.set(0.5);
    const a = now * 9; // tight, quick orbit over the head
    g.position.set(x + Math.cos(a) * 16, y - 34 + Math.sin(a) * 7);
    this.push(g, { bornAt: now, ttl: 0.5, vx: 0, vy: -6, spin: 6 });
  }

  /** Star-shield deflect: a bright ring + ⭐ flash when a star racer no-sells a hit. */
  starShield(x: number, y: number, now: number): void {
    const ring = new Graphics().circle(0, -16, 30).stroke({ color: 0xffe24d, width: 8, alpha: 1 });
    ring.position.set(x, y);
    ring.blendMode = 'add';
    this.push(ring, { bornAt: now, ttl: 0.5, grow: 2.0 });
    for (let i = 0; i < 6; i++) {
      const g = new Text({ text: '⭐', style: { fontSize: 18 + (i % 2) * 6 } });
      g.anchor.set(0.5);
      const a = (i / 6) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 16, y - 16 + Math.sin(a) * 16);
      this.push(g, { bornAt: now, ttl: 0.6, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50 - 12, spin: 5 });
    }
  }

  /**
   * 🦔 Hedgehog bristle: a ring of sharp triangular quills snapping OUTWARD off the
   * hedgehog as it flares its spines, plus a quick flash. `tint` is the spike colour
   * so it reads as the hedgehog's own quills. Decorative; spawned on bristle:activate.
   */
  bristle(x: number, y: number, tint: number, now: number): void {
    const flash = new Graphics().circle(0, 0, 16).fill({ color: 0xffffff, alpha: 0.8 });
    flash.position.set(x, y - 14);
    flash.blendMode = 'add';
    this.push(flash, { bornAt: now, ttl: 0.22, grow: 1.4 });
    // Triangular quills flung radially outward (drawn pointing along their heading).
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = new Graphics().poly([0, -9, 3, 4, -3, 4]).fill({ color: tint }).stroke({ color: 0x4a3320, width: 1.5 });
      q.position.set(x + Math.cos(a) * 10, y - 14 + Math.sin(a) * 10);
      q.rotation = a + Math.PI / 2; // tip points outward
      this.push(q, { bornAt: now, ttl: 0.5, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130 - 8, gravity: 60 });
    }
  }

  /**
   * 🦔 Bristle counter-shove: the chaser gets bounced BACKWARD off the spines. A
   * sharp impact ring at the contact point + a few quill shards + dust streaking the
   * way it was flung. `dir` is the chaser's travel sign; it recoils opposite (-dir).
   */
  spikeShove(x: number, y: number, tint: number, dir: number, now: number): void {
    const ring = new Graphics().circle(0, 0, 14).stroke({ color: 0xfff0c0, width: 7, alpha: 1 });
    ring.position.set(x, y - 14);
    this.push(ring, { bornAt: now, ttl: 0.32, grow: 2.4 });
    // Quill shards spraying back off the contact (biased opposite the chaser's travel).
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * 0.5;
      const ang = Math.PI + spread; // mostly leftward in local terms; mirrored by -dir
      const vx = -dir * Math.cos(spread) * 150;
      const vy = Math.sin(spread) * 90 - 20;
      const q = new Graphics().poly([0, -8, 3, 4, -3, 4]).fill({ color: tint }).stroke({ color: 0x4a3320, width: 1.4 });
      q.position.set(x, y - 14);
      q.rotation = ang;
      this.push(q, { bornAt: now, ttl: 0.5, vx, vy, gravity: 80, spin: i % 2 ? 4 : -4 });
    }
    // A puff of dust kicked up as it skids back.
    for (let i = 0; i < 5; i++) {
      const r = 6 + (i % 3) * 3;
      const g = new Graphics().circle(0, 0, r).fill({ color: 0xe8d3a8, alpha: 0.9 });
      g.position.set(x - dir * 6, y + 8);
      this.push(g, { bornAt: now, ttl: 0.55, vx: -dir * (60 + i * 14), vy: -14 - i * 3, gravity: 70 });
    }
  }

  /**
   * 🕸️ Spider web abduct: a sticky silk line snaps from the spider to the target
   * AHEAD, then the target is dragged BACK behind the spider. `web` is the silk
   * colour. The line is drawn from spider→target and quickly retracts toward the
   * spider (a yank), trailing a couple of 🕸️ glyphs back along the pull so "the
   * leader got reeled in behind me" reads. Decorative only.
   */
  webPull(spiderX: number, spiderY: number, targetX: number, targetY: number, web: number, now: number): void {
    const sy = spiderY - 18;
    const ty = targetY - 16;
    // The silk strand: a slightly wavy line spider→target that retracts (the yank).
    // Drawn once; we animate the retract via an arc tween on a thin sprite below,
    // but the strand itself reads best as a static streak that fades fast.
    const strand = new Graphics();
    const midx = (spiderX + targetX) / 2;
    const midy = (sy + ty) / 2 - 14; // a little sag/whip in the silk
    strand.moveTo(spiderX, sy).quadraticCurveTo(midx, midy, targetX, ty);
    strand.stroke({ color: web, width: 3, alpha: 0.95 });
    strand.position.set(0, 0);
    this.push(strand, { bornAt: now, ttl: 0.4, grow: 0 });

    // A second, ghost strand snapping closed toward the spider (the retract).
    const snap = new Graphics();
    snap.moveTo(spiderX, sy).lineTo(targetX, ty);
    snap.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
    snap.blendMode = 'add';
    this.push(snap, { bornAt: now, ttl: 0.22 });

    // 🕸️ glyph riding the strand from the target back toward the spider (the yank).
    const web1 = new Text({ text: '🕸️', style: { fontSize: 30 } });
    web1.anchor.set(0.5);
    web1.position.set(targetX, ty);
    this.push(web1, {
      bornAt: now,
      ttl: 0.42,
      fade: false,
      spin: 6,
      arc: { fromX: targetX, fromY: ty, toX: spiderX, toY: sy, lift: 26 },
    });
    // A puff of motion dust where the target was, streaking the way it's pulled.
    const pullDir = Math.sign(spiderX - targetX) || -1;
    for (let i = 0; i < 4; i++) {
      const g = new Graphics().roundRect(0, 0, 22, 3, 1.5).fill({ color: 0xffffff, alpha: 0.6 });
      g.position.set(targetX, ty - 6 + i * 6);
      this.push(g, { bornAt: now, ttl: 0.3, vx: pullDir * 260, vy: 0 });
    }
  }

  /**
   * 🕸️ Web tangle on the yanked target: a knot of sticky silk wrapping it for the
   * tangle window — a couple of 🕸️ glyphs clinging on + a quick sticky ring, so
   * "stuck in web, slowed" reads distinctly from a stun's dizzy stars. `web` tints
   * a soft silk ring. Decorative only.
   */
  webTangle(x: number, y: number, web: number, now: number): void {
    const ring = new Graphics().circle(0, 0, 16).stroke({ color: web, width: 5, alpha: 0.95 });
    ring.position.set(x, y - 16);
    this.push(ring, { bornAt: now, ttl: 0.5, grow: 1.4 });
    for (let i = 0; i < 5; i++) {
      const g = new Text({ text: '🕸️', style: { fontSize: 16 + (i % 2) * 6 } });
      g.anchor.set(0.5);
      const a = (i / 5) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 14, y - 16 + Math.sin(a) * 14);
      this.push(g, { bornAt: now, ttl: 0.85, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8 - 6, spin: i % 2 ? 2 : -2 });
    }
  }

  /**
   * 🛸 Alien mimic scan: a tech "scanning + copying" read on the alien at the
   * instant it copies a nearby racer's skill. A holographic green scan ring sweeps
   * out, a bright ✨ shimmer, and a "복사!" tag pops so "the alien scanned & cloned"
   * reads BEFORE the copied skill's own FX plays. The copied skill keeps its own
   * visuals; this is the extra scan cue layered on the alien. `tint` is the alien's
   * accent (antenna glow). Decorative only.
   */
  scanCopy(x: number, y: number, tint: number, now: number): void {
    // Holographic scan rings — two concentric green hoops sweeping outward (a
    // "ping" pulse), additive so they read as a tech beam, not a shockwave.
    for (let i = 0; i < 2; i++) {
      const ring = new Graphics().circle(0, 0, 16 + i * 8).stroke({ color: i ? 0xc8f2ce : tint, width: 4, alpha: 0.95 });
      ring.position.set(x, y - 16);
      ring.blendMode = 'add';
      this.push(ring, { bornAt: now, ttl: 0.5 + i * 0.06, grow: 3.0 });
    }
    // A scanline sweep — a thin bright bar passing across the alien (the scan).
    const bar = new Graphics().roundRect(-26, -2, 52, 4, 2).fill({ color: 0xc8f2ce, alpha: 0.9 });
    bar.position.set(x, y - 36);
    bar.blendMode = 'add';
    this.push(bar, { bornAt: now, ttl: 0.4, vx: 0, vy: 52 });
    // ✨ data shimmer + a "복사!" pop so the copy moment is unmistakable.
    for (let i = 0; i < 6; i++) {
      const g = new Text({ text: '✨', style: { fontSize: 16 + (i % 2) * 6 } });
      g.anchor.set(0.5);
      const a = (i / 6) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 18, y - 16 + Math.sin(a) * 18);
      this.push(g, { bornAt: now, ttl: 0.7, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 10, spin: 3 });
    }
    const tag = new Text({ text: '복사!', style: { fontSize: 24, fontWeight: '900', fill: 0x2bd24f, stroke: { color: 0xffffff, width: 4 } } });
    tag.anchor.set(0.5);
    tag.position.set(x, y - 46);
    this.push(tag, { bornAt: now, ttl: 0.8, vx: 0, vy: -30 });
  }

  /**
   * 🦊 Gumiho conjure smoke: a puff of pale purple-grey smoke billowing up off a
   * spot, so a decoy "poofing into being" (clone spawn) and the owner's teleport
   * arrival ("스르르…퐁!") both read as a magical poof. A few ⭐ glints ride the
   * smoke so it feels fox-magic, not just dust. `tint` accents the magic glow.
   * Decorative only.
   */
  smoke(x: number, y: number, tint: number, now: number): void {
    // A bright magic flash at the source.
    const flash = new Graphics().circle(0, 0, 18).fill({ color: 0xffffff, alpha: 0.85 });
    flash.position.set(x, y - 14);
    flash.blendMode = 'add';
    this.push(flash, { bornAt: now, ttl: 0.28, grow: 1.6 });
    // Billowing smoke puffs drifting up + out (pale lavender-grey).
    for (let i = 0; i < 9; i++) {
      const r = 10 + (i % 4) * 5;
      const shade = i % 2 ? 0xc9b8e0 : 0xe2d6f2;
      const g = new Graphics().circle(0, 0, r).fill({ color: shade, alpha: 0.7 });
      g.position.set(x + (i - 4) * 6, y - 4);
      this.push(g, { bornAt: now, ttl: 0.8, vx: (i - 4) * 26, vy: -40 - (i % 3) * 14, grow: 1.6 });
    }
    // ⭐ magic glints riding the poof so it reads as fox illusion, not dust.
    for (let i = 0; i < 6; i++) {
      const g = new Text({ text: i % 2 ? '⭐' : '✨', style: { fontSize: 18 + (i % 2) * 6 } });
      g.anchor.set(0.5);
      const a = (i / 6) * Math.PI * 2;
      g.position.set(x + Math.cos(a) * 18, y - 14 + Math.sin(a) * 16);
      g.tint = tint;
      this.push(g, { bornAt: now, ttl: 0.8, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 24, spin: i % 2 ? 5 : -5 });
    }
  }

  /**
   * 🦊 Decoy pop: a quick "퐁!" burst when a clone absorbs a disruption (clonepop)
   * or is consumed. A small lavender ring snapping out + a couple of smoke wisps +
   * a "퐁!" tag, so the decoy vanishing reads as a soft magical pop (distinct from
   * a stun's dizzy stars). Decorative only.
   */
  cloudPop(x: number, y: number, tint: number, now: number): void {
    const ring = new Graphics().circle(0, 0, 14).stroke({ color: tint, width: 7, alpha: 1 });
    ring.position.set(x, y - 16);
    ring.blendMode = 'add';
    this.push(ring, { bornAt: now, ttl: 0.4, grow: 2.6 });
    for (let i = 0; i < 6; i++) {
      const r = 7 + (i % 3) * 4;
      const g = new Graphics().circle(0, 0, r).fill({ color: 0xddd0ef, alpha: 0.7 });
      g.position.set(x, y - 12);
      const a = (i / 6) * Math.PI * 2;
      this.push(g, { bornAt: now, ttl: 0.5, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 18, grow: 1.2 });
    }
    const tag = new Text({ text: '퐁!', style: { fontSize: 24, fontWeight: '900', fill: 0xb07bd6, stroke: { color: 0xffffff, width: 4 } } });
    tag.anchor.set(0.5);
    tag.position.set(x, y - 40);
    this.push(tag, { bornAt: now, ttl: 0.7, vx: 0, vy: -28 });
  }

  update(now: number, dt: number): void {
    const live: Particle[] = [];
    for (const p of this.particles) {
      const age = now - p.bornAt;
      if (age > p.ttl) {
        p.g.destroy();
        continue;
      }
      const k = age / p.ttl;
      if (p.arc) {
        const { fromX, fromY, toX, toY, lift } = p.arc;
        p.g.x = fromX + (toX - fromX) * k;
        p.g.y = fromY + (toY - fromY) * k - Math.sin(k * Math.PI) * lift;
      } else {
        p.vy += p.gravity * dt;
        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;
      }
      if (p.spin) p.g.rotation += p.spin * dt;
      if (p.grow) p.g.scale.set(1 + k * p.grow);
      // Fading particles fade 1→0 over life (matching the original look at full
      // intensity); non-fading hold their authored alpha. Either way the crowd
      // intensity is re-applied each frame so a packed field stays legible.
      if (p.fade) p.g.alpha = (1 - k) * this.intensity;
      else p.g.alpha = p.baseAlpha * this.intensity;
      live.push(p);
    }
    this.particles = live;
  }

  clear(): void {
    for (const p of this.particles) p.g.destroy();
    this.particles = [];
  }
}
