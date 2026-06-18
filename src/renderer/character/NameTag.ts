/**
 * Always-on name + colour marker that rides above a racer and never squashes,
 * so characters stay identifiable even when overlapping (spec §7).
 */

import { Container, Graphics, Text } from 'pixi.js';

export class NameTag {
  readonly root: Container;

  constructor(name: string, markerColor: number) {
    this.root = new Container();

    const label = new Text({
      text: name,
      style: { fontFamily: 'sans-serif', fontSize: 13, fill: 0x2e2620, fontWeight: '700' },
    });
    label.anchor.set(0.5, 0.5);

    const padX = 7;
    const padY = 3;
    const w = label.width + padX * 2 + 14;
    const h = label.height + padY * 2;

    const bg = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0xffffff, alpha: 0.92 });
    bg.stroke({ color: markerColor, width: 2 });

    const dot = new Graphics().circle(-w / 2 + padX + 4, 0, 4).fill(markerColor);

    label.x = 6;
    this.root.addChild(bg, dot, label);
  }

  setPosition(x: number, y: number): void {
    this.root.position.set(x, y);
  }
}
