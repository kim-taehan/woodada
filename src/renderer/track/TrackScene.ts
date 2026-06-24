/**
 * Draws the stadium look (spec §7) from a data-driven TrackTheme (feat/arenas):
 * outer stands, the track band, lane lines, inner field, decor props, an
 * optional ambient particle hint, and the start/finish line. Purely decorative —
 * built from the same OvalTrack geometry the racers use. The theme only swaps
 * COLORS + background props; it never changes the oval, so it cannot affect the
 * (engine-owned) simulation. Readability first: the surface stays legible on
 * every theme.
 */

import { Container, Graphics } from 'pixi.js';
import { OvalTrack } from './OvalTrack.ts';
import { FINISH_OFFSET_FRAC, START_STAGGER_FRAC } from '../../engine/types.ts';
import { grassland } from '../../data/tracks/grassland.ts';
import type { TrackTheme, DecorSpec, Ambient } from '../../data/tracks/schema.ts';

function stadiumPolygon(track: OvalTrack, off: number, samples = 320): number[] {
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const p = track.pointAt(i / samples, off);
    pts.push(p.x, p.y);
  }
  return pts;
}

/**
 * Vertical sky gradient as a stack of horizontal bands (top→bottom). When
 * skyTop === skyBottom (grassland) it collapses to a single flat fill — a
 * pixel-for-pixel match of the original solid green surround.
 */
function drawSky(width: number, height: number, top: number, bottom: number): Graphics {
  const g = new Graphics();
  if (top === bottom) {
    g.rect(0, 0, width, height).fill(top);
    return g;
  }
  const bands = 24;
  const tr = (top >> 16) & 0xff, tg = (top >> 8) & 0xff, tb = top & 0xff;
  const br = (bottom >> 16) & 0xff, bg = (bottom >> 8) & 0xff, bb = bottom & 0xff;
  const bh = height / bands;
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const r = Math.round(tr + (br - tr) * k);
    const gn = Math.round(tg + (bg - tg) * k);
    const b = Math.round(tb + (bb - tb) * k);
    g.rect(0, i * bh, width, bh + 1).fill((r << 16) | (gn << 8) | b);
  }
  return g;
}

// --- Decor: each kind is a small, cheap, cute Pixi shape drawn at (px,py,s). ---
// Coordinates arrive normalized 0..1 over the scene; the caller maps to pixels.

function decorSun(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: body 0xffd24a, rays 0xffe48a (light), diameter ≈ 0.06 of width.
  const r = 30 * s;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2)
      .lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7)
      .stroke({ color: 0xffe48a, width: 5 * s, alpha: 0.9 });
  }
  g.circle(x, y, r).fill(0xffd24a);
  g.circle(x - r * 0.28, y - r * 0.28, r * 0.5).fill({ color: 0xffe48a, alpha: 0.5 });
}

function decorMoon(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: warm-white 0xf2eedb + soft glow ring (alpha 0.25).
  const r = 26 * s;
  g.circle(x, y, r * 1.7).fill({ color: 0xf2eedb, alpha: 0.25 });
  g.circle(x, y, r).fill(0xf2eedb);
  // Crescent bite + a couple of craters.
  g.circle(x + r * 0.45, y - r * 0.2, r * 0.85).fill(0x1a1e3a);
  g.circle(x - r * 0.3, y + r * 0.25, r * 0.16).fill({ color: 0xddd6c0, alpha: 0.7 });
  g.circle(x - r * 0.05, y - r * 0.35, r * 0.1).fill({ color: 0xddd6c0, alpha: 0.7 });
}

function decorCloud(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: flat, wide white puff (3-4 circles, flat base). alpha 0.92.
  const r = 18 * s;
  g.circle(x - r, y, r * 0.9).fill({ color: 0xffffff, alpha: 0.92 });
  g.circle(x, y - r * 0.45, r * 1.15).fill({ color: 0xffffff, alpha: 0.92 });
  g.circle(x + r, y, r * 0.9).fill({ color: 0xffffff, alpha: 0.92 });
  g.ellipse(x, y + r * 0.3, r * 1.9, r * 0.7).fill({ color: 0xffffff, alpha: 0.92 });
}

function decorCactus(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: muted green 0x5fa05a, rounded caps, arms. Spikes omitted.
  const w = 10 * s, h = 46 * s;
  const GREEN = 0x5fa05a;
  g.roundRect(x - w / 2, y - h, w, h, w / 2).fill(GREEN);
  // Arms.
  g.roundRect(x - w * 1.7, y - h * 0.55, w * 0.8, h * 0.35, w / 2).fill(GREEN);
  g.roundRect(x - w * 1.7, y - h * 0.55, w * 0.8, w, w / 2).fill(GREEN);
  g.roundRect(x + w * 0.9, y - h * 0.7, w * 0.8, h * 0.4, w / 2).fill(GREEN);
  g.roundRect(x + w * 0.9, y - h * 0.7, w * 0.8, w, w / 2).fill(GREEN);
}

function decorPalm(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: stem 0x9a6b3c, fronds 0x4f9e57 (muted green).
  const h = 50 * s;
  g.moveTo(x, y).bezierCurveTo(x + 6 * s, y - h * 0.5, x - 6 * s, y - h * 0.8, x + 2 * s, y - h)
    .stroke({ color: 0x9a6b3c, width: 7 * s });
  const top = { x: x + 2 * s, y: y - h };
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.5 + (i - 2) * 0.62;
    g.moveTo(top.x, top.y)
      .quadraticCurveTo(top.x + Math.cos(a) * 22 * s, top.y + Math.sin(a) * 18 * s, top.x + Math.cos(a) * 40 * s, top.y + Math.sin(a) * 30 * s)
      .stroke({ color: 0x4f9e57, width: 6 * s });
  }
  g.circle(top.x, top.y, 6 * s).fill(0x8a5a32);
}

function decorParasol(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: coral canopy 0xe9603f + white 0xfff4ec wedges, pole 0xccb89a.
  const r = 26 * s;
  g.moveTo(x, y - r * 0.2).lineTo(x, y + r * 1.3).stroke({ color: 0xccb89a, width: 4 * s });
  // Striped half-dome (alternating wedges).
  const wedges = 6;
  for (let i = 0; i < wedges; i++) {
    const a0 = Math.PI + (i / wedges) * Math.PI;
    const a1 = Math.PI + ((i + 1) / wedges) * Math.PI;
    g.moveTo(x, y - r * 0.2)
      .lineTo(x + Math.cos(a0) * r, y - r * 0.2 + Math.sin(a0) * r)
      .lineTo(x + Math.cos(a1) * r, y - r * 0.2 + Math.sin(a1) * r)
      .fill(i % 2 ? 0xe9603f : 0xfff4ec);
  }
}

function decorTube(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: coral ring 0xff6f61 + white quarter pads. alpha 0.95.
  const r = 22 * s;
  g.circle(x, y, r).fill({ color: 0xff6f61, alpha: 0.95 });
  g.circle(x, y, r).stroke({ color: 0xffffff, width: 5 * s });
  g.circle(x, y, r * 0.5).cut();
  // Stripes (four white pads).
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.circle(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.22).fill(0xffffff);
  }
}

function decorBuilding(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: body 0x2b3050 (alpha 0.9), lit windows 0xffd66b (alpha 0.85).
  const w = 40 * s, h = 120 * s;
  g.rect(x - w / 2, y, w, h).fill({ color: 0x2b3050, alpha: 0.9 });
  // Lit windows grid.
  const cols = 3, rows = Math.max(4, Math.floor(h / (14 * s)));
  const ww = w / (cols + 1) * 0.7;
  for (let r0 = 0; r0 < rows; r0++) {
    for (let c = 0; c < cols; c++) {
      const lit = ((r0 * 7 + c * 3) % 5) < 3; // deterministic on/off pattern
      const wx = x - w / 2 + ((c + 0.7) / cols) * w - ww / 2;
      const wy = y + 10 * s + r0 * 14 * s;
      if (lit) g.rect(wx, wy, ww, 8 * s).fill({ color: 0xffd66b, alpha: 0.85 });
    }
  }
}

function decorPine(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: muted evergreen 0x3f7a4e, stem 0x6e4a2e, white snow cap.
  const h = 52 * s, w = 30 * s;
  g.rect(x - 4 * s, y - 8 * s, 8 * s, 12 * s).fill(0x6e4a2e);
  for (let i = 0; i < 3; i++) {
    const ty = y - 8 * s - i * h * 0.28;
    const tw = w * (1 - i * 0.22);
    g.moveTo(x - tw / 2, ty).lineTo(x + tw / 2, ty).lineTo(x, ty - h * 0.4).fill(0x3f7a4e);
  }
  // Snow cap.
  g.moveTo(x - w * 0.3, y - 8 * s - h * 0.56).lineTo(x + w * 0.3, y - 8 * s - h * 0.56).lineTo(x, y - 8 * s - h * 0.56 - h * 0.2).fill({ color: 0xffffff, alpha: 0.9 });
}

function decorSnowman(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: near-white body 0xfbfdff, thin outline 0xdfeaf2, nose 0xf08a3c.
  g.circle(x, y, 20 * s).fill(0xfbfdff);
  g.circle(x, y - 24 * s, 14 * s).fill(0xfbfdff);
  g.circle(x, y - 24 * s, 14 * s).stroke({ color: 0xdfeaf2, width: 1.5 });
  g.circle(x, y, 20 * s).stroke({ color: 0xdfeaf2, width: 1.5 });
  // Face + buttons + carrot.
  g.circle(x - 4 * s, y - 27 * s, 1.6 * s).fill(0x333333);
  g.circle(x + 4 * s, y - 27 * s, 1.6 * s).fill(0x333333);
  g.moveTo(x, y - 24 * s).lineTo(x + 10 * s, y - 22 * s).lineTo(x, y - 21 * s).fill(0xf08a3c);
  g.circle(x, y - 2 * s, 1.8 * s).fill(0x333333);
  g.circle(x, y + 6 * s, 1.8 * s).fill(0x333333);
}

function decorLeaf(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: big frond, deep green 0x357a3f, vein 0x2a5f32. Hangs from a corner.
  const w = 42 * s, h = 56 * s;
  g.moveTo(x, y)
    .quadraticCurveTo(x - w, y + h * 0.4, x - w * 0.2, y + h)
    .quadraticCurveTo(x, y + h * 0.5, x + w * 0.2, y + h)
    .quadraticCurveTo(x + w, y + h * 0.4, x, y)
    .fill(0x357a3f);
  g.moveTo(x, y).lineTo(x, y + h * 0.9).stroke({ color: 0x2a5f32, width: 3 * s });
}

function decorVine(g: Graphics, x: number, y: number, s: number): void {
  // Spec t04: dangling vine, stem 0x4a7a3a, leaf dots 0x3f8a46 (alpha 0.9).
  const len = 70 * s;
  g.moveTo(x, y)
    .bezierCurveTo(x + 12 * s, y + len * 0.35, x - 12 * s, y + len * 0.7, x + 6 * s, y + len)
    .stroke({ color: 0x4a7a3a, width: 4 * s, alpha: 0.9 });
  for (let i = 1; i <= 3; i++) {
    const ly = y + (len * i) / 3.5;
    const lx = x + Math.sin(i * 1.7) * 12 * s;
    g.ellipse(lx, ly, 9 * s, 5 * s).fill({ color: 0x3f8a46, alpha: 0.9 });
  }
}

function decorBunting(g: Graphics, x: number, y: number, s: number): void {
  // Spec u01 §4.1: festival flag garland. String sags from (x,y) to (x+240s,y);
  // ~8 triangular flags cycling a 4-color sports palette.
  const span = 240 * s;
  const sag = 18 * s;
  const cx = x + span / 2;
  g.moveTo(x, y).quadraticCurveTo(cx, y + sag, x + span, y)
    .stroke({ color: 0x8a6d3a, width: 2 * s, alpha: 0.7 });
  const COLORS = [0xe7574d, 0xf5b13d, 0x4fa3e0, 0x5fbf6a];
  const flags = 8;
  const fw = 16 * s, fh = 20 * s;
  for (let i = 0; i < flags; i++) {
    const t = (i + 0.5) / flags;
    // Point on the sagging quadratic Bézier (B(t) = (1-t)²P0 + 2(1-t)t Pc + t²P2).
    const mt = 1 - t;
    const bx = mt * mt * x + 2 * mt * t * cx + t * t * (x + span);
    const by = mt * mt * y + 2 * mt * t * (y + sag) + t * t * y;
    g.moveTo(bx - fw / 2, by).lineTo(bx + fw / 2, by).lineTo(bx, by + fh)
      .fill({ color: COLORS[i % 4], alpha: 0.92 });
  }
}

function decorFlower(g: Graphics, x: number, y: number, s: number): void {
  // Spec u01 §4.2: a clump of 3-4 small flowers around the anchor (clump base).
  // Deterministic offsets (no RNG) within ±14s.
  const PETAL = [0xff8fb3, 0xfff3a0, 0xe88fe0];
  const spots = [
    { dx: 0, dy: -2 * s, ci: 0 },
    { dx: -12 * s, dy: 4 * s, ci: 1 },
    { dx: 11 * s, dy: 6 * s, ci: 2 },
    { dx: 4 * s, dy: -10 * s, ci: 0 },
  ];
  for (const sp of spots) {
    const fx = x + sp.dx, fy = y + sp.dy;
    // Short green stem/leaf down from the bloom.
    g.moveTo(fx, fy).lineTo(fx, fy + 6 * s).stroke({ color: 0x4f9e57, width: 2 * s });
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      g.circle(fx + Math.cos(a) * 5 * s, fy + Math.sin(a) * 5 * s, 4 * s).fill(PETAL[sp.ci]);
    }
    g.circle(fx, fy, 3 * s).fill(0xffd64a);
  }
}

function decorSeagull(g: Graphics, x: number, y: number, s: number): void {
  // Spec u01 §4.3: minimal "M" gull silhouette, two bezier wings. No body.
  const stroke = { color: 0x55606e, width: 3 * s, alpha: 0.85 } as const;
  g.moveTo(x - 18 * s, y).quadraticCurveTo(x - 9 * s, y - 7 * s, x, y).stroke(stroke);
  g.moveTo(x, y).quadraticCurveTo(x + 9 * s, y - 7 * s, x + 18 * s, y).stroke(stroke);
}

function decorSandcastle(g: Graphics, x: number, y: number, s: number): void {
  // Spec u01 §4.4: trapezoid body + 3 towers w/ coral pennants + arch door.
  const SAND = 0xddb878;
  const bw = 40 * s, tw = 30 * s, bh = 26 * s;
  // Body trapezoid (anchor = base center; sits on the sand).
  g.moveTo(x - bw / 2, y).lineTo(x + bw / 2, y)
    .lineTo(x + tw / 2, y - bh).lineTo(x - tw / 2, y - bh)
    .fill(SAND);
  g.moveTo(x - bw / 2, y).lineTo(x + bw / 2, y)
    .lineTo(x + tw / 2, y - bh).lineTo(x - tw / 2, y - bh).closePath()
    .stroke({ color: 0xc9a06a, width: 1.5 });
  // Three towers rising above the body.
  const towerW = 8 * s, towerRise = 12 * s, top = y - bh;
  const towerX = [-tw / 2 + towerW / 2, 0, tw / 2 - towerW / 2];
  for (const tx of towerX) {
    g.rect(x + tx - towerW / 2, top - towerRise, towerW, towerRise).fill(SAND);
    // Coral pennant on each tower top.
    const fx = x + tx;
    const fy = top - towerRise;
    g.moveTo(fx, fy).lineTo(fx + 7 * s, fy + 3 * s).lineTo(fx, fy + 6 * s).fill(0xff6f61);
  }
  // Arch door (dark sand half-circle) centered on the body base.
  g.moveTo(x - 6 * s, y).arc(x, y, 6 * s, Math.PI, 0).fill(0xbf9a5e);
}

function decorStarfish(g: Graphics, x: number, y: number, s: number): void {
  // Spec u01 §4.5: 5-point star, coral orange, slight tilt + light dots.
  const outer = 14 * s, inner = 6 * s, tilt = -0.3;
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = tilt - Math.PI / 2 + (i / 10) * Math.PI * 2;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.poly(pts).fill(0xff9f5a);
  g.poly(pts, true).stroke({ color: 0xe07f3a, width: 1.5 });
  // A few light speckles toward the center.
  const dots = [
    { dx: 0, dy: 0 }, { dx: -3 * s, dy: 2 * s },
    { dx: 3 * s, dy: -2 * s }, { dx: 1 * s, dy: 4 * s },
  ];
  for (const d of dots) g.circle(x + d.dx, y + d.dy, 1.5 * s).fill(0xffd0a0);
}

function decorBeachball(g: Graphics, x: number, y: number, s: number): void {
  // Spec u01 §4.6: white ball with 6 alternating color wedges + highlight.
  const r = 16 * s;
  const WEDGE = [0xff5a5a, 0x4fa3e0, 0xffd64a];
  g.circle(x, y, r).fill(0xffffff);
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    g.moveTo(x, y).arc(x, y, r, a0, a1).closePath().fill(WEDGE[i % 3]);
  }
  g.circle(x, y, r).stroke({ color: 0xddddee, width: 1.5 });
  // Top-left specular highlight.
  g.circle(x - r * 0.35, y - r * 0.35, 5 * s).fill({ color: 0xffffff, alpha: 0.6 });
}

const DECOR_DRAW: Record<string, (g: Graphics, x: number, y: number, s: number) => void> = {
  sun: decorSun,
  moon: decorMoon,
  cloud: decorCloud,
  cactus: decorCactus,
  palm: decorPalm,
  parasol: decorParasol,
  tube: decorTube,
  building: decorBuilding,
  pine: decorPine,
  snowman: decorSnowman,
  leaf: decorLeaf,
  vine: decorVine,
  bunting: decorBunting,
  flower: decorFlower,
  seagull: decorSeagull,
  sandcastle: decorSandcastle,
  starfish: decorStarfish,
  beachball: decorBeachball,
};

function buildDecor(specs: DecorSpec[], width: number, height: number): Graphics {
  const g = new Graphics();
  for (const d of specs) {
    const draw = DECOR_DRAW[d.kind];
    if (!draw) continue;
    draw(g, d.x * width, d.y * height, d.scale ?? 1);
  }
  return g;
}

/**
 * A light ambient particle field (display-only — no RNG, no sim feedback). The
 * layout is a fixed deterministic lattice + a per-particle phase so the same
 * theme always looks the same in a still. The renderer does not animate this
 * (TrackScene is a static build); motion would only show in live play, but the
 * static spread already reads as "snow / sand / fireflies" in a screenshot.
 */
function buildAmbient(ambient: Ambient, width: number, height: number): Container {
  const c = new Container();
  if (ambient === 'none') return c;
  const count = ambient === 'fireflies' ? 26 : 60;
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-scatter from the index (no Math.random → determinism).
    const fx = ((i * 73 + 19) % 100) / 100;
    const fy = ((i * 137 + 41) % 100) / 100;
    const px = fx * width;
    const py = fy * height;
    const g = new Graphics();
    if (ambient === 'snow') {
      // Spec t04: round white flakes, 2-4px, alpha 0.7-0.9.
      g.circle(px, py, 2 + (i % 3)).fill({ color: 0xffffff, alpha: 0.8 });
    } else if (ambient === 'sand') {
      // Spec t04: thin horizontal sand streaks, 0xe9cf9b alpha 0.35-0.5.
      g.moveTo(px, py).lineTo(px + 14, py + 4).stroke({ color: 0xe9cf9b, width: 2, alpha: 0.45 });
    } else if (ambient === 'fireflies') {
      // Spec t04: glow dot, core 0xfff3a0, halo 0xd6ff7a alpha 0.4.
      g.circle(px, py, 2).fill({ color: 0xfff3a0, alpha: 0.9 });
      g.circle(px, py, 5).fill({ color: 0xd6ff7a, alpha: 0.4 });
    }
    c.addChild(g);
  }
  c.blendMode = ambient === 'fireflies' ? 'add' : 'normal';
  return c;
}

export function buildTrackScene(
  track: OvalTrack,
  width: number,
  height: number,
  /**
   * Distinct team vest colors (hex 0xRRGGBB) when this is a team race. When
   * present, the finish tape is flanked by team-colored edge stripes so a team
   * race's finish line reads differently from a plain individual race. Empty /
   * undefined for individual races → classic black/white checker only.
   */
  teamColors: number[] = [],
  /** Arena theme (palette + decor + ambient). Defaults to grassland (classic). */
  theme: TrackTheme = grassland,
): Container {
  const scene = new Container();
  const { laneSpan } = track.geo;
  const half = laneSpan / 2;
  const margin = laneSpan * 0.55;
  const outerOff = half + margin;
  const innerOff = -half - margin * 0.5;

  // Sky / backdrop (flat for grassland, vertical gradient otherwise).
  scene.addChild(drawSky(width, height, theme.skyTop, theme.skyBottom));

  // Stands ring (outer) — renderer-internal neutral, not themed.
  const stands = new Graphics().poly(stadiumPolygon(track, half + margin * 2.1)).fill(0x9aa3b2);
  scene.addChild(stands);

  // Track band: themed surface outer fill, then inner field punched on top.
  const trackBand = new Graphics().poly(stadiumPolygon(track, half + margin)).fill(theme.surface);
  scene.addChild(trackBand);
  // Subtle alternating lane band on the surface (skipped if no surfaceAlt).
  if (theme.surfaceAlt !== undefined) {
    const altBand = new Graphics().poly(stadiumPolygon(track, (half + innerOff) / 2)).fill({ color: theme.surfaceAlt, alpha: 0.5 });
    scene.addChild(altBand);
  }
  const innerEdge = new Graphics().poly(stadiumPolygon(track, -half - margin * 0.5)).fill(theme.kerb);
  scene.addChild(innerEdge);
  const infield = new Graphics().poly(stadiumPolygon(track, -half - margin * 0.5 - 6)).fill(theme.infield);
  scene.addChild(infield);
  if (theme.infieldEdge !== undefined) {
    const infieldInner = new Graphics().poly(stadiumPolygon(track, -half - margin * 1.4)).fill(theme.infieldEdge);
    scene.addChild(infieldInner);
  }

  // Decor props + ambient sit OVER the infield/backdrop (the oval covers most of
  // the canvas, so props on the open infield read clearly) but UNDER the lane
  // lines + finish tape so the running surface stays crisp. Behind racers (the
  // whole trackLayer is at stage index 0). decor coords target sky/field areas.
  scene.addChild(buildDecor(theme.decor, width, height));
  scene.addChild(buildAmbient(theme.ambient ?? 'none', width, height));

  // Lane lines (3 lanes → 3 lines; visual only, racers move continuously).
  for (let l = 0; l <= 2; l++) {
    const off = -half + (l / 2) * laneSpan;
    const line = new Graphics();
    const poly = stadiumPolygon(track, off);
    line.poly(poly, true).stroke({ color: theme.laneLine, width: 1.5, alpha: 0.55 });
    scene.addChild(line);
  }

  // Finish position: every race (incl. relay) finishes FINISH_OFFSET_FRAC into the
  // lap (≈3/4 along the bottom straight) — the relay anchor now runs the extra
  // 0.21 past the baton/lap line too (engine: relayAnchorGoal = trackLength ×
  // (1 + FINISH_OFFSET_FRAC)). The checker tape is drawn there; the plain start/
  // lap line stays at u=0, so start ≠ finish for relay as well.
  const finishU = FINISH_OFFSET_FRAC;

  // Two lines at the start position (u=0):
  //   1. Relay exchange line — straight across (u=0 outer → u=0 inner).
  //   2. Start line — diagonal (outer at u=0, inner pushed to u=DIAG).
  // Both are always drawn on every track.
  {
    const DIAG = START_STAGGER_FRAC;

    // 1. Relay exchange line: straight, thinner.
    const exchange = new Graphics();
    const ea = track.pointAt(0, outerOff);
    const eb = track.pointAt(0, innerOff);
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const t1 = (i + 0.5) / 6;
      exchange
        .moveTo(ea.x + (eb.x - ea.x) * t0, ea.y + (eb.y - ea.y) * t0)
        .lineTo(ea.x + (eb.x - ea.x) * t1, ea.y + (eb.y - ea.y) * t1)
        .stroke({ color: 0xffffff, width: 4, alpha: 0.65 });
    }
    scene.addChild(exchange);

    // 2. Start line: diagonal, bolder. Outer lane leads (staggered-start direction).
    const start = new Graphics();
    const sa = track.pointAt(DIAG, outerOff);
    const sb = track.pointAt(0, innerOff);
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const t1 = (i + 0.5) / 6;
      start
        .moveTo(sa.x + (sb.x - sa.x) * t0, sa.y + (sb.y - sa.y) * t0)
        .lineTo(sa.x + (sb.x - sa.x) * t1, sa.y + (sb.y - sa.y) * t1)
        .stroke({ color: 0xffffff, width: 7, alpha: 0.92 });
    }
    scene.addChild(start);
  }

  // Finish tape: a checkered band across the track at `finishU`. Two staggered
  // rows of black/white squares so it reads as a chequered flag, clearly
  // different from the plain start line.
  const finish = new Graphics();
  const fa = track.pointAt(finishU, outerOff);
  const fb = track.pointAt(finishU, innerOff);
  const cells = 10;
  const rows = 2;
  // Across-track direction (a→b) split into `cells`; along-track thickness from
  // the local tangent so the band is perpendicular-ish to travel.
  const tp = track.pointAt(finishU, 0);
  const along = { x: Math.cos(tp.angle), y: Math.sin(tp.angle) };
  const bandDepth = laneSpan * 0.16; // total thickness of the tape
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cells; c++) {
      const dark = (row + c) % 2 === 0;
      const t0 = c / cells;
      const t1 = (c + 1) / cells;
      const r0 = row / rows;
      const r1 = (row + 1) / rows;
      const corner = (tx: number, ry: number) => {
        const baseX = fa.x + (fb.x - fa.x) * tx;
        const baseY = fa.y + (fb.y - fa.y) * tx;
        return {
          x: baseX + along.x * (ry - 0.5) * bandDepth,
          y: baseY + along.y * (ry - 0.5) * bandDepth,
        };
      };
      const p0 = corner(t0, r0);
      const p1 = corner(t1, r0);
      const p2 = corner(t1, r1);
      const p3 = corner(t0, r1);
      finish
        .poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y])
        .fill(dark ? 0x222222 : 0xffffff);
    }
  }

  // Team race: flank the checker tape with team-colored stripes (one per team,
  // split evenly across the width) on both the leading and trailing edge. Gives
  // the team finish line its own identity vs. the plain individual checker.
  if (teamColors.length) {
    const stripeDepth = bandDepth * 0.42;
    for (const edge of [-1, 1] as const) {
      for (let c = 0; c < teamColors.length; c++) {
        const t0 = c / teamColors.length;
        const t1 = (c + 1) / teamColors.length;
        // Outer face of the band on this edge → outward by stripeDepth.
        const r0 = edge < 0 ? -0.5 : 0.5;
        const r1 = edge < 0 ? -0.5 - stripeDepth / bandDepth : 0.5 + stripeDepth / bandDepth;
        const corner = (tx: number, ry: number) => {
          const baseX = fa.x + (fb.x - fa.x) * tx;
          const baseY = fa.y + (fb.y - fa.y) * tx;
          return {
            x: baseX + along.x * ry * bandDepth,
            y: baseY + along.y * ry * bandDepth,
          };
        };
        const p0 = corner(t0, r0);
        const p1 = corner(t1, r0);
        const p2 = corner(t1, r1);
        const p3 = corner(t0, r1);
        finish
          .poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y])
          .fill(teamColors[c]);
      }
    }
  }

  scene.addChild(finish);

  return scene;
}
