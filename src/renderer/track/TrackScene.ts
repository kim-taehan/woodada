/**
 * Draws the stadium look (spec §7): outer stands, red/orange tatan track band,
 * white lane lines, inner grass field, and the start/finish line. Purely
 * decorative — built from the same OvalTrack geometry the racers use.
 */

import { Container, Graphics } from 'pixi.js';
import { OvalTrack } from './OvalTrack.ts';

function stadiumPolygon(track: OvalTrack, off: number, samples = 160): number[] {
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const p = track.pointAt(i / samples, off);
    pts.push(p.x, p.y);
  }
  return pts;
}

export function buildTrackScene(track: OvalTrack, width: number, height: number): Container {
  const scene = new Container();
  const { laneSpan } = track.geo;
  const half = laneSpan / 2;
  const margin = laneSpan * 0.55;

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

  // Start / finish line across the track at u = 0 (bottom centre).
  const finish = new Graphics();
  const a = track.pointAt(0, half + margin);
  const b = track.pointAt(0, -half - margin * 0.5);
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6;
    const t1 = (i + 0.5) / 6;
    const x0 = a.x + (b.x - a.x) * t0;
    const y0 = a.y + (b.y - a.y) * t0;
    const x1 = a.x + (b.x - a.x) * t1;
    const y1 = a.y + (b.y - a.y) * t1;
    finish.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: 0xffffff, width: 8 });
  }
  scene.addChild(finish);

  return scene;
}
