/**
 * Big, short-lived speech bubbles for skill activations (spec §2.3). A manager
 * stacks simultaneous bubbles so they stay readable when several fire at once
 * (spec §13): newer bubbles sit higher and older ones fade.
 */

import { Container, Graphics, Text } from 'pixi.js';

interface ActiveBubble {
  root: Container;
  bornAt: number;
  ttl: number;
  ownerId: string;
}

const TTL = 1.7; // seconds

function makeBubble(text: string, tint: number): Container {
  const c = new Container();
  const label = new Text({
    text,
    style: { fontFamily: 'sans-serif', fontSize: 19, fontWeight: '800', fill: 0x2e2620, align: 'center' },
  });
  label.anchor.set(0.5);
  const w = label.width + 24;
  const h = label.height + 16;
  const bg = new Graphics().roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: 0xfff7e6, alpha: 0.97 });
  bg.stroke({ color: tint, width: 3.5 });
  // little tail
  bg.moveTo(-8, h / 2).lineTo(0, h / 2 + 10).lineTo(8, h / 2).fill({ color: 0xfff7e6, alpha: 0.97 });
  c.addChild(bg, label);
  return c;
}

export class SpeechBubbleLayer {
  readonly root = new Container();
  private bubbles: ActiveBubble[] = [];
  /**
   * Cap on how many head bubbles may be on screen at once. In a small field
   * (≤6 racers) this is Infinity so the look is unchanged; the renderer lowers it
   * as the field crowds (16-up → only the few newest stay) so a wall of stacked
   * bubbles doesn't mush the screen. Set via `setMaxConcurrent`. A fresh spawn
   * always wins (newest first), evicting the oldest over the cap.
   */
  private maxConcurrent = Infinity;

  /** Crowd-aware cap on simultaneous head bubbles (renderer sets it per race). */
  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n;
  }

  spawn(ownerId: string, text: string, tint: number, x: number, y: number, now: number): void {
    // Replace an existing bubble from the same owner.
    this.bubbles = this.bubbles.filter((b) => {
      if (b.ownerId === ownerId) {
        b.root.destroy();
        return false;
      }
      return true;
    });
    const root = makeBubble(text, tint);
    root.position.set(x, y);
    this.root.addChild(root);
    this.bubbles.push({ root, bornAt: now, ttl: TTL, ownerId });
    // Crowd cap: keep only the newest `maxConcurrent`, evicting the oldest so a
    // burst of activations in a packed field doesn't pile into an unreadable wall.
    while (this.bubbles.length > this.maxConcurrent) {
      this.bubbles.shift()!.root.destroy();
    }
  }

  /** Move a bubble to follow its owner; call each frame with owner positions. */
  follow(ownerId: string, x: number, y: number): void {
    for (const b of this.bubbles) if (b.ownerId === ownerId) b.root.position.set(x, y);
  }

  update(now: number): void {
    // Stack overlapping bubbles by nudging older ones up.
    const live: ActiveBubble[] = [];
    for (const b of this.bubbles) {
      const age = now - b.bornAt;
      if (age > b.ttl) {
        b.root.destroy();
        continue;
      }
      const k = age / b.ttl;
      b.root.alpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      b.root.scale.set(0.7 + Math.min(1, age * 8) * 0.3);
      live.push(b);
    }
    this.bubbles = live;
  }

  clear(): void {
    for (const b of this.bubbles) b.root.destroy();
    this.bubbles = [];
  }
}
