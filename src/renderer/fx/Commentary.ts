/**
 * Live play-by-play caption bar (귀여움 × 병맛 톤). Shows one short line at a
 * time at the bottom of the screen, reacting to skills, items, lead changes and
 * the final lap. Purely cosmetic.
 */

import { Container, Graphics, Text } from 'pixi.js';

const TTL = 2.6;

export class CommentaryBar {
  readonly root = new Container();
  private readonly bg: Graphics;
  private readonly label: Text;
  private bornAt = -100;

  constructor() {
    this.bg = new Graphics();
    this.label = new Text({
      style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x1f2a1c, width: 4 }, align: 'center' },
    });
    this.label.anchor.set(0.5);
    this.root.addChild(this.bg, this.label);
    this.root.visible = false;
  }

  say(text: string, now: number): void {
    this.label.text = text;
    const w = this.label.width + 28;
    const h = this.label.height + 14;
    this.bg.clear().roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: 0x1f2a1c, alpha: 0.66 });
    this.bornAt = now;
    this.root.visible = true;
  }

  update(now: number): void {
    if (!this.root.visible) return;
    const age = now - this.bornAt;
    if (age > TTL) {
      this.root.visible = false;
      return;
    }
    const pop = Math.min(1, age * 8);
    this.root.scale.set(0.85 + pop * 0.15);
    this.root.alpha = age < TTL - 0.5 ? 1 : Math.max(0, 1 - (age - (TTL - 0.5)) / 0.5);
  }

  hide(): void {
    this.root.visible = false;
  }
}
