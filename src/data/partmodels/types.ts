/**
 * Parts geometry, transcribed once from the reference SVGs (spec §2.6). The SVG
 * files are NOT loaded at runtime; their shapes are captured here as renderer-
 * agnostic primitives. The idle cell is the canonical rig; run/skill/win/fall
 * are stored as per-part transform deltas the renderer blends procedurally.
 *
 * Colors reference palette keys (resolved by the renderer) so a character/skin
 * can be recolored without touching geometry. A literal hex is also allowed for
 * fixed details (e.g. eye black, banana yellow).
 */

/** Either a palette key (e.g. 'base', 'point') or a literal CSS color ('#fff'). */
export type ColorRef = string;

export type PartShape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: ColorRef; stroke?: ColorRef; strokeW?: number; rotation?: number; opacity?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: ColorRef; stroke?: ColorRef; strokeW?: number; opacity?: number }
  | { kind: 'path'; d: string; fill?: ColorRef; stroke?: ColorRef; strokeW?: number; opacity?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: ColorRef; strokeW: number };

export interface Part {
  name: string;
  /** Local pivot for squash/stretch + rotation. */
  pivot: { x: number; y: number };
  /** Layered primitives (idle pose), painted back-to-front. */
  shapes: PartShape[];
  /** Draw order (higher = front). */
  z: number;
}

export interface PartTransform {
  dx?: number;
  dy?: number;
  rot?: number; // degrees
  scaleX?: number;
  scaleY?: number;
}

/** Per-part transform deltas relative to idle. Only moved parts listed. */
export type PoseDelta = Record<string, PartTransform>;

export type PoseName = 'idle' | 'run' | 'skill' | 'win' | 'fall';

export interface PartModel {
  id: string;
  parts: Part[];
  /** idle is the empty baseline; others are deltas. */
  poses: Record<PoseName, PoseDelta>;
}
