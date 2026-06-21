/**
 * Track theme schema — data-driven arena skins (spec: feat/arenas).
 *
 * Themes are PURELY VISUAL. The engine only knows progress + lane; track shape
 * stays the same oval. A theme only swaps colors, the sky backdrop, background
 * props (decor) and an optional ambient particle hint. Nothing here touches
 * simulation/determinism/balance.
 *
 * Colors are numeric hex (0xRRGGBB) so PixiJS Graphics .fill()/.stroke() can use
 * them directly. Readability first: the track SURFACE must always stay clearly
 * legible (characters run on it), even on dark themes.
 */

/**
 * One background prop, described as data so the renderer can place it without
 * per-theme code. Coordinates are normalized 0..1 over the scene (x: left→right,
 * y: top→bottom); the renderer maps them to its canvas. `scale` defaults to 1.
 *
 * `kind` is drawn from a SMALL shared vocabulary the renderer must implement.
 * Active kinds across all themes (keep this list tight — 2~3 per theme):
 *   cloud | sun | moon | cactus | palm | parasol | tube | wave |
 *   building | pine | snowman | leaf | vine
 */
export interface DecorSpec {
  kind: string;
  /** Normalized horizontal position, 0 = left edge, 1 = right edge. */
  x: number;
  /** Normalized vertical position, 0 = top edge, 1 = bottom edge. */
  y: number;
  /** Visual scale multiplier (default 1). */
  scale?: number;
}

/** Light ambient particle hint for the renderer (optional, cheap). */
export type Ambient = 'sand' | 'snow' | 'petals' | 'fireflies' | 'none';

export interface TrackTheme {
  /** Stable id (used by registry + pickArena). */
  id: string;
  /** Korean display name for the setup UI. */
  label: string;
  /** Emoji icon for the setup UI. */
  emoji: string;

  // --- Palette (hex 0xRRGGBB) ---
  /** Track running surface — must stay clearly legible. */
  surface: number;
  /** Optional alternating lane stripe color (subtle banding on the surface). */
  surfaceAlt?: number;
  /** Inner field enclosed by the track. */
  infield: number;
  /** Optional darker inner-field core for a layered look. */
  infieldEdge?: number;
  /** Lane divider lines drawn on the surface. */
  laneLine: number;
  /** Outer kerb / track rim. */
  kerb: number;
  /** Sky / backdrop gradient top color. */
  skyTop: number;
  /** Sky / backdrop gradient bottom color. */
  skyBottom: number;

  /** Background props, placed by normalized coordinates. */
  decor: DecorSpec[];
  /** Ambient particle hint (default treated as 'none' if omitted). */
  ambient?: Ambient;
}
