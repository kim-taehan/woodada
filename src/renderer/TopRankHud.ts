/**
 * Compact live TOP 1–3 ranking HUD, pinned to the BOTTOM-LEFT corner.
 *
 * Sibling to {@link Scoreboard} (which lists the full field on the right). This
 * widget only ever shows the current top three by live progress, each row being
 * `[rank] [team swatch] name`. It is pure presentation — fed the ranked rows by
 * the renderer every frame, never touching the simulation (spec §10).
 *
 * Team races draw the team colour swatch (`teamPalette[teamId].fill`, outlined
 * with `.trim`); individual races use a neutral dot so the layout stays stable.
 */

import { Container, Graphics, Text } from 'pixi.js';

export interface TopRow {
  /** Participant display name. */
  name: string;
  /** Team fill colour (0xRRGGBB) or null for individual races. */
  teamFill: number | null;
  /** Team trim/outline colour (0xRRGGBB) or null. */
  teamTrim: number | null;
}

const MAX_ROWS = 3;
const ROW_H = 26;
const PAD_X = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;
const WIDTH = 188;
const SWATCH_R = 7;
const RANK_COLORS = [0xffd23f, 0xd6dae0, 0xe2a06a]; // gold / silver / bronze

interface RowView {
  container: Container;
  rankText: Text;
  swatch: Graphics;
  nameText: Text;
}

export class TopRankHud {
  readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly title: Text;
  private readonly rows: RowView[] = [];

  constructor() {
    this.root.addChild(this.bg);
    this.title = new Text({
      text: 'LIVE TOP 3',
      style: { fontFamily: 'sans-serif', fontSize: 11, fontWeight: '800', fill: 0xbfe6b0, letterSpacing: 1 },
    });
    this.title.position.set(PAD_X, 6);
    this.root.addChild(this.title);
  }

  /** Replace the displayed rows with the current top-3 (in rank order). */
  update(top: TopRow[]): void {
    const shown = top.slice(0, MAX_ROWS);
    const titleH = 22;
    const h = titleH + PAD_TOP + shown.length * ROW_H + PAD_BOTTOM;
    this.bg
      .clear()
      .roundRect(0, 0, WIDTH, h, 12)
      .fill({ color: 0x1f2a1c, alpha: 0.8 })
      .stroke({ color: 0xffffff, width: 1.5, alpha: 0.12 });

    shown.forEach((data, i) => {
      const row = this.ensureRow(i);
      row.container.visible = true;
      row.container.position.set(0, titleH + PAD_TOP + i * ROW_H);

      row.rankText.text = `${i + 1}`;
      row.rankText.style.fill = RANK_COLORS[i] ?? 0xffffff;

      // Team swatch (dot). Individual races → neutral grey dot.
      const fill = data.teamFill ?? 0x8a948a;
      const trim = data.teamTrim ?? 0x40483f;
      row.swatch
        .clear()
        .circle(0, 0, SWATCH_R)
        .fill({ color: fill })
        .stroke({ color: trim, width: 2 });

      row.nameText.text = data.name;
    });

    for (let i = shown.length; i < this.rows.length; i++) this.rows[i].container.visible = false;
  }

  private ensureRow(i: number): RowView {
    let row = this.rows[i];
    if (row) return row;

    const container = new Container();
    const rankText = new Text({
      style: { fontFamily: 'sans-serif', fontSize: 15, fontWeight: '900', fill: 0xffffff },
    });
    rankText.anchor.set(0.5, 0.5);
    rankText.position.set(PAD_X + 6, ROW_H / 2);

    const swatch = new Graphics();
    swatch.position.set(PAD_X + 24, ROW_H / 2);

    const nameText = new Text({
      style: { fontFamily: 'sans-serif', fontSize: 14, fontWeight: '700', fill: 0xffffff },
    });
    nameText.anchor.set(0, 0.5);
    nameText.position.set(PAD_X + 38, ROW_H / 2);

    container.addChild(rankText, swatch, nameText);
    this.root.addChild(container);
    row = { container, rankText, swatch, nameText };
    this.rows[i] = row;
    return row;
  }
}
