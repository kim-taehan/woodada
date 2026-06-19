/**
 * Draws the stadium look (spec §7): outer stands, red/orange tatan track band,
 * white lane lines, inner grass field, and the start/finish line. Purely
 * decorative — built from the same OvalTrack geometry the racers use.
 */

import { Container, Graphics } from 'pixi.js';
import { OvalTrack } from './OvalTrack.ts';
import { FINISH_OFFSET_FRAC } from '../../engine/types.ts';

function stadiumPolygon(track: OvalTrack, off: number, samples = 320): number[] {
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const p = track.pointAt(i / samples, off);
    pts.push(p.x, p.y);
  }
  return pts;
}

export function buildTrackScene(
  track: OvalTrack,
  width: number,
  height: number,
  relay = false,
  /**
   * Distinct team vest colors (hex 0xRRGGBB) when this is a team race. When
   * present, the finish tape is flanked by team-colored edge stripes so a team
   * race's finish line reads differently from a plain individual race. Empty /
   * undefined for individual races → classic black/white checker only.
   */
  teamColors: number[] = [],
): Container {
  const scene = new Container();
  const { laneSpan } = track.geo;
  const half = laneSpan / 2;
  const margin = laneSpan * 0.55;
  const outerOff = half + margin;
  const innerOff = -half - margin * 0.5;

  // Background / grass surround.
  const bg = new Graphics().rect(0, 0, width, height).fill(0x6fae6a);
  scene.addChild(bg);

  // Stands ring (outer).
  const stands = new Graphics().poly(stadiumPolygon(track, half + margin * 2.1)).fill(0x9aa3b2);
  scene.addChild(stands);

  // Track band: tatan outer fill, then infield grass punched on top.
  const trackBand = new Graphics().poly(stadiumPolygon(track, half + margin)).fill(0xd2452f);
  scene.addChild(trackBand);
  const innerEdge = new Graphics().poly(stadiumPolygon(track, -half - margin * 0.5)).fill(0xe8923c);
  scene.addChild(innerEdge);
  const infield = new Graphics().poly(stadiumPolygon(track, -half - margin * 0.5 - 6)).fill(0x7ec46f);
  scene.addChild(infield);
  const infieldInner = new Graphics().poly(stadiumPolygon(track, -half - margin * 1.4)).fill(0x68b25b);
  scene.addChild(infieldInner);

  // Lane lines (3 lanes → 3 lines; visual only, racers move continuously).
  for (let l = 0; l <= 2; l++) {
    const off = -half + (l / 2) * laneSpan;
    const line = new Graphics();
    const poly = stadiumPolygon(track, off);
    line.poly(poly, true).stroke({ color: 0xffffff, width: 1.5, alpha: 0.55 });
    scene.addChild(line);
  }

  // Finish position: relay finishes on the lap boundary (u=0, same as the start
  // line), so we only draw the checker tape there. Individual/team races finish
  // FINISH_OFFSET_FRAC into the lap (mid bottom-straight) — drawn separately from
  // the plain start/lap line at u=0.
  const finishU = relay ? 0 : FINISH_OFFSET_FRAC;

  // Start / lap line across the track at u = 0 (bottom straight LEFT end). Plain
  // dashed white line — visually distinct from the checker finish tape. Skipped
  // for relay (the finish tape sits on top of it at u=0).
  if (!relay) {
    const start = new Graphics();
    const sa = track.pointAt(0, outerOff);
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
