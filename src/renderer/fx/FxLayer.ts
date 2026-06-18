/**
 * Transient particle effects for skill activations (spec §2.3): big dust bursts
 * (zoomies), a banana that arcs to its target, stars on a hit, feathers on an
 * eagle divebomb, whiff on a dodge, and speed lines on a burst. Pure visual fluff —
 * spawned from engine events, never feeding back into the simulation.
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
}

export class FxLayer {
  readonly root = new Container();
  private particles: Particle[] = [];

  private push(g: Container, p: Partial<Particle> & { bornAt: number; ttl: number }): void {
    this.root.addChild(g);
    this.particles.push({ g, vx: 0, vy: 0, gravity: 0, fade: true, ...p });
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

  /** Feathers scattering when the eagle's divebomb connects — drift down + sideways. */
  feathers(x: number, y: number, now: number): void {
    for (let i = 0; i < 8; i++) {
      const g = new Text({ text: '🪶', style: { fontSize: 15 + (i % 3) * 3 } });
      g.anchor.set(0.5);
      g.position.set(x, y - 18);
      const a = (i / 8) * Math.PI * 2;
      this.push(g, { bornAt: now, ttl: 1.0, vx: Math.cos(a) * 50, vy: Math.sin(a) * 36 - 30, gravity: 70, spin: (i % 2 ? 3 : -3) });
    }
  }

  /** Eagle dive streak: a diagonal swoop line from above toward the strike point. */
  swoop(fromX: number, fromY: number, toX: number, toY: number, now: number): void {
    const g = new Text({ text: '💨', style: { fontSize: 22 } });
    g.anchor.set(0.5);
    g.position.set(fromX, fromY);
    this.push(g, { bornAt: now, ttl: 0.35, fade: true, arc: { fromX, fromY, toX, toY, lift: 18 } });
    for (let i = 0; i < 3; i++) {
      const line = new Graphics().roundRect(0, 0, 30, 3, 1.5).fill({ color: 0xffffff, alpha: 0.6 });
      line.position.set(fromX + i * 6, fromY + i * 6);
      const dx = toX - fromX, dy = toY - fromY;
      const len = Math.hypot(dx, dy) || 1;
      this.push(line, { bornAt: now, ttl: 0.3, vx: (dx / len) * 260, vy: (dy / len) * 260 });
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
      if (p.fade) p.g.alpha = 1 - k;
      live.push(p);
    }
    this.particles = live;
  }

  clear(): void {
    for (const p of this.particles) p.g.destroy();
    this.particles = [];
  }
}
