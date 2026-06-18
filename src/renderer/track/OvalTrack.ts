/**
 * Maps abstract engine coordinates (progress + lane) onto an oval "stadium"
 * path (spec §7). The engine never sees this — track shape is renderer-only and
 * does NOT affect the simulation. Provides a weak top-down perspective (nearer
 * = larger) and z-order so free-running racers stay readable.
 */

export interface TrackPoint {
  x: number;
  y: number;
  /** Tangent heading in radians (direction of travel). */
  angle: number;
  /** Render scale from weak perspective. */
  scale: number;
  /** Z-order (larger = front). */
  z: number;
}

export interface OvalGeometry {
  cx: number;
  cy: number;
  /** Half-length of each straight. */
  straightHalf: number;
  /** Curve radius (centreline). */
  radius: number;
  /** Pixel gap between inside (lane 0) and outside (lane 1). */
  laneSpan: number;
}

export class OvalTrack {
  constructor(public geo: OvalGeometry) {}

  /** Centreline perimeter for one lap. */
  get perimeter(): number {
    const { straightHalf, radius } = this.geo;
    return 4 * straightHalf + 2 * Math.PI * radius;
  }

  laneOffset(lane: number): number {
    // lane 0 = innermost; positive offset points outward.
    return (lane - 0.5) * this.geo.laneSpan;
  }

  /**
   * Screen-space travel direction (unit-ish) at a point on the track, sampled by
   * finite difference of position so it is geometry-exact regardless of the
   * piecewise tangent formula. `headingX` < 0 means the racer is moving left on
   * screen — side-profile characters mirror to face that way. Used for facing
   * only; never feeds the simulation.
   */
  travelDir(progress: number, trackLength: number, lane: number): { x: number; y: number } {
    const off = this.laneOffset(lane);
    const u = ((((progress % trackLength) + trackLength) % trackLength) / trackLength);
    const eps = 1e-3;
    const a = this.pointAt(u, off);
    const b = this.pointAt((u + eps) % 1, off);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return { x: dx, y: dy };
  }

  /**
   * Map progress along the track. progress is in engine units; trackLength is
   * engine units per lap. Racers travel anticlockwise starting at the bottom
   * straight's LEFT end (u=0 = start/lap line).
   */
  place(progress: number, trackLength: number, lane: number): TrackPoint {
    const u = ((progress % trackLength) + trackLength) % trackLength / trackLength; // 0..1 this lap
    return this.pointAt(u, this.laneOffset(lane));
  }

  /**
   * u in [0,1) along the centreline, offset outward by `off` pixels.
   *
   * Lap layout (stadium): u=0 sits at the LEFT END of the bottom straight (the
   * start / lap line) and runs anticlockwise. From the start it heads RIGHT
   * along the whole bottom straight (left→right), up the right curve, across the
   * top straight (right→left), down the left curve, back to the bottom-left
   * start (u→1). The finish *tape* (FINISH_OFFSET_FRAC≈u=0.12) lands partway
   * along the bottom straight (mid-straight). So laps 1..(N-1) close on the
   * bottom-left start line; the final lap rounds the left curve, crosses the
   * start line, then runs the bottom straight into the mid-straight finish tape
   * — the dramatic "마지막 직선" approach — and finishers coast on past into the
   * straight's empty right half + right curve apron.
   */
  pointAt(u: number, off: number): TrackPoint {
    const { cx, cy, straightHalf: s, radius: r } = this.geo;
    const straight = 2 * s;
    const curve = Math.PI * r;
    const total = 2 * straight + 2 * curve;
    let d = u * total;

    let x: number;
    let y: number;
    let nx: number; // outward normal
    let ny: number;
    let angle: number;

    if (d < straight) {
      // bottom straight, full: LEFT corner (start) -> RIGHT corner. left→right.
      const t = d / straight;
      x = cx - s + t * straight;
      y = cy + r;
      nx = 0;
      ny = 1;
      angle = 0;
    } else if ((d -= straight) < curve) {
      // right curve: bottom -> top, centre (cx+s, cy).
      const a = Math.PI / 2 - (d / curve) * Math.PI;
      x = cx + s + Math.cos(a) * r;
      y = cy + Math.sin(a) * r;
      nx = Math.cos(a);
      ny = Math.sin(a);
      angle = a - Math.PI / 2 + Math.PI; // tangent
    } else if ((d -= curve) < straight) {
      // top straight: right -> left
      const t = d / straight;
      x = cx + s - t * straight;
      y = cy - r;
      nx = 0;
      ny = -1;
      angle = Math.PI;
    } else {
      // left curve: top -> bottom, centre (cx-s, cy). Closes back at the start.
      d -= straight;
      const a = -Math.PI / 2 - (d / curve) * Math.PI;
      x = cx - s + Math.cos(a) * r;
      y = cy + Math.sin(a) * r;
      nx = Math.cos(a);
      ny = Math.sin(a);
      angle = a - Math.PI / 2 + Math.PI;
    }

    x += nx * off;
    y += ny * off;

    // Weak perspective: nearer the bottom (larger y) → bigger + in front.
    const depth = (y - (cy - r)) / (2 * r); // 0 top .. 1 bottom
    const scale = 0.82 + depth * 0.36;
    return { x, y, angle, scale, z: y };
  }
}

/**
 * Derive a sensible oval for a given canvas size. `bandMul` widens the lane
 * band (inside↔outside spread) for crowded fields so racers overlap less; it
 * is 1 for small fields (default look) and grows toward ~1.7 at 16 racers.
 */
export function ovalForCanvas(width: number, height: number, bandMul = 1): OvalGeometry {
  const cx = width / 2;
  const cy = height / 2;
  // Stadium proportions: short, tight curves + LONG straights so each straight
  // visibly out-runs the bend. Radius is pulled in (shorter curve = Math.PI*r)
  // and the straight is stretched wide. At 1280×800 this gives straights ≈ 690px
  // vs curves ≈ 540px — a clear straightaway, with the start/lap line at the
  // LEFT end of the long bottom straight and the finish tape mid-straight
  // (see pointAt).
  const radius = Math.min(height * 0.22, width * 0.135);
  const straightHalf = Math.max(40, width * 0.27);
  const laneSpan = radius * 0.6 * bandMul; // a touch wider band to fill the tighter curve
  return { cx, cy, straightHalf, radius, laneSpan };
}
