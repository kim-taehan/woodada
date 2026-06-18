/**
 * Transient particle effects for skill activations (spec §2.3): big dust bursts
 * (zoomies), a banana that arcs to its target, stars on a hit, feathers on an
 * eagle snatch, whiff on a dodge, and speed lines on a burst. Pure visual fluff —
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

  /** Feathers scattering when the eagle's snatch connects — drift down + sideways. */
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

  whiff(x: number, y: number, now: number): void {
    const g = new Text({ text: '휙~', style: { fontSize: 24, fontWeight: '800', fill: 0xb5702e } });
    g.anchor.set(0.5);
    g.position.set(x, y - 16);
    this.push(g, { bornAt: now, ttl: 0.7, vx: 30, vy: -24 });
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
