/**
 * Live ranking overlay (spec §7 전광판). Shows current standings by progress.
 */

import { Container, Graphics, Text } from 'pixi.js';

export class Scoreboard {
  readonly root = new Container();
  private readonly rows: Text[] = [];
  private readonly bg: Graphics;

  constructor(private names: Record<string, string>) {
    this.bg = new Graphics();
    this.root.addChild(this.bg);
  }

  update(orderIds: string[]): void {
    const lineH = 18;
    const w = 132;
    const h = 14 + orderIds.length * lineH;
    this.bg.clear().roundRect(0, 0, w, h, 8).fill({ color: 0x1f2a1c, alpha: 0.78 });

    orderIds.forEach((id, i) => {
      let row = this.rows[i];
      if (!row) {
        row = new Text({ style: { fontFamily: 'sans-serif', fontSize: 12, fill: 0xffffff } });
        row.position.set(10, 8 + i * lineH);
        this.rows[i] = row;
        this.root.addChild(row);
      }
      row.text = `${i + 1}. ${this.names[id] ?? id}`;
      row.style.fill = i === 0 ? 0xffd23f : 0xffffff;
      row.visible = true;
    });
    for (let i = orderIds.length; i < this.rows.length; i++) this.rows[i].visible = false;
  }
}
