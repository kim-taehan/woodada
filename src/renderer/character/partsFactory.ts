/**
 * Turns renderer-agnostic PartShape primitives (transcribed from the reference
 * SVGs) into PixiJS Graphics. The idle poses use only M/L/H/V/Q/C/Z path
 * commands (no arcs), so the path parser stays small. Colors resolve against the
 * character palette so a character/skin can be recolored without new geometry.
 */

import { Container, Graphics } from 'pixi.js';
import type { Palette } from '../../data/schema.ts';
import type { Part, PartShape } from '../../data/partmodels/types.ts';

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function resolveColor(ref: string | undefined, palette: Palette): number | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('#')) return hexToNum(ref);
  const v = palette[ref];
  if (v) return hexToNum(v);
  return undefined;
}

interface Cmd {
  op: string;
  args: number[];
}

function tokenizePath(d: string): Cmd[] {
  const cmds: Cmd[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
  let m: RegExpExecArray | null;
  let cur: Cmd | null = null;
  while ((m = re.exec(d))) {
    if (m[1]) {
      cur = { op: m[1], args: [] };
      cmds.push(cur);
    } else if (cur) {
      cur.args.push(parseFloat(m[2]));
    }
  }
  return cmds;
}

/** Trace an SVG path's `d` onto a Graphics (absolute coords). */
function tracePath(g: Graphics, d: string): void {
  const cmds = tokenizePath(d);
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const { op, args } of cmds) {
    const rel = op === op.toLowerCase();
    const bx = rel ? x : 0;
    const by = rel ? y : 0;
    switch (op.toUpperCase()) {
      case 'M':
        x = bx + args[0];
        y = by + args[1];
        g.moveTo(x, y);
        startX = x;
        startY = y;
        for (let i = 2; i + 1 < args.length; i += 2) {
          x = (rel ? x : 0) + args[i];
          y = (rel ? y : 0) + args[i + 1];
          g.lineTo(x, y);
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) {
          x = (rel ? x : 0) + args[i];
          y = (rel ? y : 0) + args[i + 1];
          g.lineTo(x, y);
        }
        break;
      case 'H':
        for (const a of args) {
          x = (rel ? x : 0) + a;
          g.lineTo(x, y);
        }
        break;
      case 'V':
        for (const a of args) {
          y = (rel ? y : 0) + a;
          g.lineTo(x, y);
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < args.length; i += 4) {
          const cx = bx + args[i];
          const cy = by + args[i + 1];
          x = bx + args[i + 2];
          y = by + args[i + 3];
          g.quadraticCurveTo(cx, cy, x, y);
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < args.length; i += 6) {
          const c1x = bx + args[i];
          const c1y = by + args[i + 1];
          const c2x = bx + args[i + 2];
          const c2y = by + args[i + 3];
          x = bx + args[i + 4];
          y = by + args[i + 5];
          g.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
        }
        break;
      case 'Z':
        g.closePath();
        x = startX;
        y = startY;
        break;
      default:
        throw new Error(`unsupported path command: ${op}`);
    }
  }
}

function drawShape(shape: PartShape, palette: Palette): Graphics {
  const g = new Graphics();
  const fill = 'fill' in shape ? resolveColor(shape.fill, palette) : undefined;
  const stroke = 'stroke' in shape ? resolveColor(shape.stroke, palette) : undefined;
  const opacity = 'opacity' in shape ? shape.opacity ?? 1 : 1;

  switch (shape.kind) {
    case 'ellipse':
      g.ellipse(shape.cx, shape.cy, shape.rx, shape.ry);
      if (shape.rotation) {
        g.pivot.set(shape.cx, shape.cy);
        g.position.set(shape.cx, shape.cy);
        g.rotation = (shape.rotation * Math.PI) / 180;
      }
      break;
    case 'circle':
      g.circle(shape.cx, shape.cy, shape.r);
      break;
    case 'path':
      tracePath(g, shape.d);
      break;
    case 'line':
      g.moveTo(shape.x1, shape.y1).lineTo(shape.x2, shape.y2);
      break;
  }

  if (fill !== undefined) g.fill({ color: fill, alpha: opacity });
  if (stroke !== undefined && 'strokeW' in shape && shape.strokeW) {
    g.stroke({ color: stroke, width: shape.strokeW, alpha: opacity, cap: 'round', join: 'round' });
  }
  return g;
}

/** Build one part as a Container pivoted at part.pivot (so it rotates in place). */
export function buildPart(part: Part, palette: Palette): Container {
  const c = new Container();
  c.label = part.name;
  c.pivot.set(part.pivot.x, part.pivot.y);
  c.position.set(part.pivot.x, part.pivot.y);
  for (const shape of part.shapes) c.addChild(drawShape(shape, palette));
  c.zIndex = part.z;
  return c;
}
