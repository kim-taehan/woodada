/**
 * PixiJS renderer (spec §10). Consumes EngineFrame snapshots and draws them; it
 * is stateless with respect to the simulation and never feeds anything back.
 * Maps (progress, lane) onto the oval, drives procedural character animation,
 * and plays skill events as FX + speech bubbles (spec §2.3, §13).
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import type { EngineFrame, RaceConfig, RaceResult, RacerState, SkillEvent } from '../engine/types.ts';
import { characterCatalog } from '../data/characters/index.ts';
import { partModels } from '../data/partmodels/index.ts';
import { OvalTrack, ovalForCanvas } from './track/OvalTrack.ts';
import { buildTrackScene } from './track/TrackScene.ts';
import { PartsCharacter } from './character/PartsCharacter.ts';
import { NameTag } from './character/NameTag.ts';
import { SpeechBubbleLayer } from './fx/SpeechBubble.ts';
import { FxLayer } from './fx/FxLayer.ts';
import { CommentaryBar } from './fx/Commentary.ts';
import { eventLine, leadLine, lastLapLine } from './fx/commentaryLines.ts';
import { Scoreboard } from './Scoreboard.ts';
import { TopRankHud, type TopRow } from './TopRankHud.ts';
import { teamPalette, type TeamId } from '../data/teams.ts';

interface RacerView {
  character: PartsCharacter;
  tag: NameTag;
  tint: number;
  /** Per-character render size multiplier. */
  size: number;
  /** Bright halo shown while this racer is using a skill. */
  glow: Graphics;
  /** clock (seconds) until which the glow stays on. */
  glowUntil: number;
}

export interface RaceRenderer {
  mount(parent: HTMLElement): Promise<void>;
  buildScene(config: RaceConfig): void;
  renderFrame(frame: EngineFrame): void;
  showResult(result: RaceResult): void;
  setReducedMotion(on: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
  readonly canvas: HTMLCanvasElement | undefined;
}

type Pos = { x: number; y: number; heading: number };

/** Base character scale (multiplied by per-point perspective). */
const CHAR_SCALE = 0.52;

/**
 * Field-size auto-scaling. The "field" is how many racers share the track AT
 * ONCE — for a relay that is the active team count (one runner per team), not
 * the headcount. Small fields keep today's look exactly; crowded fields shrink
 * the characters and widen the lane band so they overlap less and name tags
 * stay legible.
 */
const FIELD_MIN = 6; // ≤ this → unchanged (regression-safe)
const FIELD_MAX = 16; // fully crowded
const SIZE_FLOOR = 0.62; // smallest character multiplier (legibility clamp)
const BAND_CEIL = 1.5; // widest lane band multiplier

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** 0 at FIELD_MIN, 1 at FIELD_MAX, eased. */
function crowding(fieldSize: number): number {
  return smoothstep((fieldSize - FIELD_MIN) / (FIELD_MAX - FIELD_MIN));
}

/** Global character-size multiplier for a field size (1 → SIZE_FLOOR). */
function fieldSizeScale(fieldSize: number): number {
  return 1 - (1 - SIZE_FLOOR) * crowding(fieldSize);
}

/** Lane-band widening multiplier for a field size (1 → BAND_CEIL). */
function fieldBandMul(fieldSize: number): number {
  return 1 + (BAND_CEIL - 1) * crowding(fieldSize);
}

/** Racers sharing the track at once: relay → active team count; else headcount. */
function fieldSizeOf(cfg: RaceConfig): number {
  if (cfg.relay) {
    const teams = new Set<string>();
    for (const p of cfg.participants) teams.add(p.teamId ?? p.id);
    return teams.size;
  }
  return cfg.participants.length;
}

function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Bottom-left margin + assumed full (3-row) height of the live TOP-3 HUD. */
const TOP_HUD_MARGIN = 16;
const TOP_HUD_H = 120; // title + 3 rows; pins the card's top so it sits in the corner

function isTeamId(id: string | undefined): id is TeamId {
  return id !== undefined && id in teamPalette;
}

export function createRaceRenderer(): RaceRenderer {
  const app = new Application();
  let track: OvalTrack;
  let config: RaceConfig | null = null;
  let trackLayer = new Container();
  const charLayer = new Container();
  const fx = new FxLayer();
  const bubbles = new SpeechBubbleLayer();
  const boxLayer = new Container();
  const boxSprites = new Map<string, Container>();
  const boxBorn = new Map<string, number>();
  const commentary = new CommentaryBar();
  let namesById: Record<string, string> = {};
  // Character id per racer — lets the renderer recognise a cat shrugging off a
  // disruption (immunity dodge) and flash its "냐옹" shimmer on the cat itself.
  const charIdById = new Map<string, string>();
  let leaderPrev: string | null = null;
  let lastLeadSay = -100;
  let scoreboard: Scoreboard | null = null;
  let topHud: TopRankHud | null = null;
  const views = new Map<string, RacerView>();
  let reducedMotion = false;
  let clock = 0;
  let lastTime = 0;
  let width = 800;
  let height = 600;

  // Victory podium state.
  let podiumScene: Container | null = null;
  let podiumChars: { char: PartsCharacter; winner: boolean }[] = [];
  let podiumClock = 0;
  let podiumTick: ((ticker: { deltaMS: number }) => void) | null = null;

  // Lap counter + final-lap emphasis.
  let lapText: Text | null = null;
  let lastLapTriggered = false;
  let banner: Container | null = null;
  let bannerBornAt = 0;
  let audioCtx: AudioContext | null = null;

  // Relay: total legs per team (max team size); 0 when not a relay.
  let relayLegTotal = 0;

  // Field-size auto-scale: computed once per race (buildScene) and held fixed
  // for the whole race so racers don't pop-resize as they finish/queue.
  let fieldScale = 1; // global character-size multiplier
  let fieldBand = 1; // lane-band widening multiplier

  charLayer.sortableChildren = true;

  function playBell(): void {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioCtx = audioCtx ?? new Ctor();
      const ctx = audioCtx;
      const t = ctx.currentTime;
      [988, 1319].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = t + i * 0.16;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
        osc.start(t0);
        osc.stop(t0 + 0.42);
      });
    } catch {
      /* audio unavailable (e.g. headless) — ignore */
    }
  }

  function triggerLastLap(): void {
    if (!reducedMotion) playBell();
    if (banner) banner.destroy();
    banner = new Container();
    const txt = new Text({
      text: config?.relay ? '🔔 마지막 주자!' : '🔔 마지막 바퀴!',
      style: { fontFamily: 'sans-serif', fontSize: 52, fontWeight: '900', fill: 0xffe24d, stroke: { color: 0x7a3b10, width: 8 }, align: 'center' },
    });
    txt.anchor.set(0.5);
    banner.addChild(txt);
    banner.position.set(width / 2, height * 0.32);
    app.stage.addChild(banner);
    bannerBornAt = clock;
    commentary.say(lastLapLine(Math.round(clock * 10)), clock);
  }

  function clearPodium(): void {
    if (podiumTick) {
      app.ticker.remove(podiumTick);
      podiumTick = null;
    }
    podiumChars = [];
    if (podiumScene) {
      podiumScene.destroy({ children: true });
      podiumScene = null;
    }
  }

  function makeBoxSprite(): Container {
    const c = new Container();
    const g = new Graphics().roundRect(-13, -13, 26, 26, 6).fill({ color: 0xffd23f });
    g.stroke({ color: 0xffffff, width: 2.5 });
    const q = new Text({ text: '?', style: { fontSize: 20, fontWeight: '900', fill: 0x7a3b10 } });
    q.anchor.set(0.5);
    c.addChild(g, q);
    return c;
  }

  function rebuildTrack(): void {
    track = new OvalTrack(ovalForCanvas(width, height, fieldBand));
    trackLayer.removeFromParent();
    trackLayer = buildTrackScene(track, width, height);
    app.stage.addChildAt(trackLayer, 0);
  }

  function playEvent(e: SkillEvent, posById: Map<string, Pos>): void {
    const self = posById.get(e.racerId);
    const v = views.get(e.racerId);
    if (!v || !self) return;
    const at = e.targetId ? posById.get(e.targetId) : undefined;
    const v2 = e.targetId ? views.get(e.targetId) : undefined;
    if (e.line) bubbles.spawn(e.racerId, e.line, v.tint, self.x, self.y - 64, clock);
    // Highlight WHO is using the skill: glow halo + sparkles + an activation pop
    // on the actor. Hold the glow a touch longer so the eye has time to land on
    // who acted. Catwalk (cat immunity) glows for its whole immune window.
    v.glowUntil = clock + (e.type === 'catwalk' ? 2.0 : 1.6);
    if (!reducedMotion) {
      fx.sparkle(self.x, self.y, clock);
      // Snappy core+ring flash, but only on the firing beat (not hit/dodge
      // follow-ups) so the actor isn't double-popped.
      if (e.variant === 'activate') fx.pop(self.x, self.y, v.tint, clock);
    }
    if (reducedMotion) return;

    const dir = self.heading >= 0 ? 1 : -1;
    switch (`${e.type}:${e.variant}`) {
      case 'zoomies:activate':
        fx.dust(self.x, self.y + 14, clock);
        fx.speedLines(self.x, self.y - 6, dir, clock);
        break;
      case 'catwalk:activate':
        // Sashay: a shimmer of sparkles + smooth slip streak (the actor glows).
        fx.sparkle(self.x, self.y, clock);
        fx.speedLines(self.x, self.y - 6, dir, clock);
        break;
      case 'catwalk:dodge':
        // "냐옹" immunity flash the instant a disruption is shrugged off.
        fx.sparkle(self.x, self.y, clock);
        fx.whiff(self.x, self.y, clock);
        break;
      case 'snatch:activate':
        // Eagle dives — a swoop streak from above the actor toward the target
        // (or straight ahead if the strike point isn't known yet).
        fx.swoop(self.x, self.y - 60, (at ?? self).x, (at ?? self).y, clock);
        fx.speedLines(self.x, self.y - 6, dir, clock);
        break;
      case 'snatch:hit':
        // Target is yanked up and dragged back: feathers scatter + stars on it.
        if (at) {
          fx.feathers(at.x, at.y, clock);
          fx.stars(at.x, at.y, clock);
        }
        break;
      case 'snatch:dodge':
        // Whiffed grab — talons close on empty air over the (escaped) target.
        fx.whiff((at ?? self).x, (at ?? self).y, clock);
        break;
      case 'banana:hit':
        if (at) {
          fx.bananaThrow(self.x, self.y - 6, at.x, at.y, clock);
          fx.stars(at.x, at.y, clock);
        }
        break;
      case 'banana:dodge':
        if (at) {
          fx.bananaThrow(self.x, self.y - 6, at.x + 30, at.y - 20, clock);
          fx.whiff(at.x, at.y, clock);
        }
        break;
      case 'item:boost':
        fx.dust(self.x, self.y + 14, clock);
        fx.speedLines(self.x, self.y - 6, dir, clock);
        break;
      case 'item:slip':
        fx.stars(self.x, self.y, clock);
        break;
      case 'roar:activate':
        fx.shockwave(self.x, self.y, clock);
        fx.dust(self.x, self.y + 12, clock);
        break;
      case 'relay:handoff': {
        // Baton from the finisher to the outgoing teammate, near the line.
        // Self-handoff (1-member team / cycle wrap, targetId === racerId): the
        // same runner takes the next leg. A zero-length baton just bobs in place,
        // so hop it forward into a tidy "one more loop!" toss + glow the actor.
        const selfHandoff = !at || e.targetId === e.racerId;
        const dst = selfHandoff ? { x: self.x + dir * 40, y: self.y - 6 } : { x: at!.x, y: at!.y - 6 };
        fx.baton(self.x, self.y - 6, dst.x, dst.y, clock);
        fx.dust(dst.x, dst.y + 20, clock);
        const v2g = selfHandoff ? v : v2;
        if (v2g) v2g.glowUntil = clock + 1.6;
        break;
      }
    }

    // Catwalk immunity "냐옹" flash: any disruption (banana/roar/snatch) that is
    // shrugged off surfaces as a `<attacker>:dodge` whose target is the cat. Flash
    // a shimmer + brief glow on the cat itself so it's clear who No-Sold the hit.
    // (Commentary is left to the attacker's dodge line so the bar doesn't double up.)
    if (e.variant === 'dodge' && e.targetId && at && v2 && charIdById.get(e.targetId) === 'cat') {
      fx.sparkle(at.x, at.y, clock);
      v2.glowUntil = Math.max(v2.glowUntil, clock + 0.8);
    }
  }

  const renderer: RaceRenderer = {
    get canvas() {
      return app.canvas as HTMLCanvasElement | undefined;
    },

    async mount(parent) {
      width = parent.clientWidth || 800;
      height = parent.clientHeight || 600;
      await app.init({
        width,
        height,
        background: 0x88c98a,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      });
      parent.appendChild(app.canvas);
      app.stage.addChild(boxLayer, charLayer, bubbles.root, fx.root, commentary.root);
      commentary.root.position.set(width / 2, height - 40);
    },

    buildScene(cfg) {
      config = cfg;
      clearPodium();
      for (const v of views.values()) v.character.destroy();
      views.clear();
      charLayer.removeChildren();
      bubbles.clear();
      fx.clear();
      fx.root.visible = true;
      bubbles.root.visible = true;
      for (const s of boxSprites.values()) s.destroy();
      boxSprites.clear();
      boxBorn.clear();
      boxLayer.visible = true;
      commentary.hide();
      leaderPrev = null;
      lastLeadSay = -100;
      clock = 0;
      lastTime = 0;

      // Field-size auto-scale (fixed for the whole race). Relay's field is its
      // active team count, so a 16-runner relay still feels like a 4-up race.
      const fieldSize = fieldSizeOf(cfg);
      fieldScale = fieldSizeScale(fieldSize);
      fieldBand = fieldBandMul(fieldSize);

      rebuildTrack();

      const names: Record<string, string> = {};
      charIdById.clear();
      for (const p of cfg.participants) {
        charIdById.set(p.id, p.characterId);
        const char = characterCatalog[p.characterId];
        const model = partModels[char.partModelId ?? p.characterId];
        const character = new PartsCharacter(model, char.palette, char.runStyle, undefined, p.teamId);
        const tint = hexNum(char.palette.point ?? char.palette.base);
        // Skill-use halo. Larger + brighter than the body so "who acted" reads
        // instantly even in a crowd against the bright field: a wide soft amber
        // outer wash, a hot white core, and a bold ring to crisp the edge.
        const glow = new Graphics();
        glow.circle(0, -16, 88).fill({ color: 0xffd23f, alpha: 0.55 });
        glow.circle(0, -16, 64).fill({ color: 0xfff0a0, alpha: 0.95 });
        glow.circle(0, -16, 44).fill({ color: 0xffffff, alpha: 0.95 });
        glow.circle(0, -16, 90).stroke({ color: 0xffe24d, width: 7, alpha: 1 });
        glow.blendMode = 'add';
        glow.visible = false;
        character.root.addChildAt(glow, 0); // behind the body
        const tag = new NameTag(p.name, tint);
        charLayer.addChild(character.root, tag.root);
        views.set(p.id, { character, tag, tint, size: char.renderScale ?? 1, glow, glowUntil: 0 });
        names[p.id] = p.name;
      }
      namesById = names;

      scoreboard = new Scoreboard(names);
      scoreboard.root.position.set(width - 144, 12);
      app.stage.addChild(scoreboard.root);

      // Live TOP-3 HUD, bottom-left corner (clear of the centre commentary bar
      // and the right-hand scoreboard).
      topHud = new TopRankHud();
      topHud.root.position.set(TOP_HUD_MARGIN, height - TOP_HUD_H - TOP_HUD_MARGIN);
      app.stage.addChild(topHud.root);

      // Counter HUD: lap counter (multi-lap) or relay leg counter.
      if (lapText) lapText.destroy();
      lapText = null;
      lastLapTriggered = false;
      if (banner) {
        banner.destroy();
        banner = null;
      }
      // Relay: legs per team = chosen laps (members cycle members[i % size]).
      // Drives the "n / laps 주자" counter. (Was max team size — now leg=laps.)
      relayLegTotal = cfg.relay ? Math.max(1, cfg.laps) : 0;
      if (cfg.relay || cfg.laps > 1) {
        lapText = new Text({
          text: cfg.relay ? `🏃 1 / ${relayLegTotal} 주자` : `🏁 1 / ${cfg.laps} 바퀴`,
          style: { fontFamily: 'sans-serif', fontSize: 20, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x1f2a1c, width: 4 } },
        });
        lapText.anchor.set(0.5, 0);
        lapText.position.set(width / 2, 10);
        app.stage.addChild(lapText);
      }
    },

    renderFrame(frame) {
      if (!config) return;
      const dt = lastTime ? (frame.time - lastTime) / 1000 : 1 / 60;
      lastTime = frame.time;
      clock += dt;

      const posById = new Map<string, Pos>();
      // Relay: collect waiting teammates so they queue off-track instead of
      // standing on the racing line. Drawn after the main loop, by team.
      const waiting: RacerState[] = [];
      for (const r of frame.racers) {
        const v = views.get(r.id);
        if (!v) continue;
        if (config.relay && r.phase === 'waiting') {
          waiting.push(r);
          continue;
        }
        const tp = track.place(r.progress, config.trackLength, r.lane);
        v.character.root.position.set(tp.x, tp.y);
        v.character.root.zIndex = tp.z;
        v.character.root.scale.set(CHAR_SCALE * tp.scale * v.size * fieldScale);
        v.character.update({
          phase: r.phase,
          speedNorm: Math.min(1, r.speed / 3),
          clock,
          facing: r.facing,
          heading: Math.cos(tp.angle),
          reducedMotion,
        });
        v.tag.setPosition(tp.x, tp.y - 66 * tp.scale * fieldScale);
        v.tag.root.zIndex = 100000 + tp.z;

        // Pulse the skill-use glow.
        const glowing = clock < v.glowUntil && !reducedMotion;
        v.glow.visible = glowing;
        if (glowing) {
          v.glow.alpha = 0.45 + 0.3 * Math.sin(clock * 16);
          const s = 1 + 0.12 * Math.sin(clock * 16);
          v.glow.scale.set(s);
        }

        posById.set(r.id, { x: tp.x, y: tp.y, heading: Math.cos(tp.angle) });
      }

      // Relay waiting queue: park each team's not-yet-running members in the
      // infield by the start/finish line, stacked next-up first. Vests make it
      // obvious whose turn is coming. They never touch the racing line.
      if (config.relay && waiting.length) {
        const byTeam = new Map<string, RacerState[]>();
        for (const r of waiting) {
          const key = r.teamId ?? r.id;
          (byTeam.get(key) ?? byTeam.set(key, []).get(key)!).push(r);
        }
        // Sort each team's queue by leg so the next runner sits at the front.
        for (const list of byTeam.values()) list.sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
        const teams = [...byTeam.keys()];
        const baseY = track.geo.cy + track.geo.radius * 0.42; // inside the bottom straight
        const colGap = Math.min(96, (track.geo.straightHalf * 1.6) / Math.max(1, teams.length));
        const x0 = track.geo.cx - (colGap * (teams.length - 1)) / 2;
        teams.forEach((teamKey, ci) => {
          const col = byTeam.get(teamKey)!;
          col.forEach((r, ri) => {
            const v = views.get(r.id);
            if (!v) return;
            const x = x0 + ci * colGap;
            const y = baseY + ri * 30;
            v.character.root.position.set(x, y);
            v.character.root.zIndex = 50 + ri; // behind active racers
            v.character.root.scale.set(CHAR_SCALE * 0.62 * v.size * fieldScale);
            v.character.update({
              phase: 'waiting',
              speedNorm: 0,
              clock,
              facing: 0,
              heading: 1,
              reducedMotion,
            });
            v.glow.visible = false;
            v.tag.setPosition(x, y - 40);
            v.tag.root.zIndex = 90000 + ri;
          });
        });
      }

      // Item boxes (spawned dynamically): drop sprites whose box is gone, pop in new.
      const present = new Set(frame.boxes.map((b) => b.id));
      for (const [id, sprite] of [...boxSprites]) {
        if (!present.has(id)) {
          sprite.destroy();
          boxSprites.delete(id);
          boxBorn.delete(id);
        }
      }
      frame.boxes.forEach((box, i) => {
        let sprite = boxSprites.get(box.id);
        if (!sprite) {
          sprite = makeBoxSprite();
          boxSprites.set(box.id, sprite);
          boxBorn.set(box.id, clock);
          boxLayer.addChild(sprite);
        }
        const tp = track.pointAt(box.progress / config!.trackLength, track.laneOffset(box.lane));
        sprite.position.set(tp.x, tp.y - 4 - Math.sin(clock * 4 + i) * 4);
        sprite.rotation = Math.sin(clock * 3 + i) * 0.25;
        const pop = Math.min(1, (clock - (boxBorn.get(box.id) ?? clock)) * 7);
        sprite.scale.set(tp.scale * (0.3 + pop * 0.7));
      });

      for (const e of frame.events) playEvent(e, posById);

      // Live commentary from skill/item events.
      let saidThisFrame = false;
      for (const e of frame.events) {
        const n = namesById[e.racerId];
        if (!n) continue;
        const line = eventLine(e.type, e.variant, n, frame.frame + (e.targetId ? 7 : 0));
        if (line) {
          commentary.say(line, clock);
          saidThisFrame = true;
        }
      }

      // Finished racers rank by crossing order; the rest by live progress.
      const order = [...frame.racers]
        .sort((a, b) => {
          const af = a.rank !== undefined;
          const bf = b.rank !== undefined;
          if (af && bf) return a.rank! - b.rank!;
          if (af !== bf) return af ? -1 : 1;
          return b.progress - a.progress;
        })
        .map((r) => r.id);
      scoreboard?.update(order);

      // Live TOP-3 HUD: top three of the same live order, with team colours.
      if (topHud) {
        const teamById = new Map<string, string | undefined>();
        for (const r of frame.racers) teamById.set(r.id, r.teamId);
        const rows: TopRow[] = order.slice(0, 3).map((id) => {
          const teamId = teamById.get(id);
          const pal = isTeamId(teamId) ? teamPalette[teamId] : null;
          return {
            name: namesById[id] ?? id,
            teamFill: pal ? hexNum(pal.fill) : null,
            teamTrim: pal ? hexNum(pal.trim) : null,
          };
        });
        topHud.update(rows);
      }

      // Lead-change commentary (throttled, only once the race is underway).
      const leader = order[0];
      if (leader && leaderPrev && leader !== leaderPrev && frame.frame > 40 && !saidThisFrame && clock - lastLeadSay > 2.8) {
        commentary.say(leadLine(namesById[leader] ?? leader, frame.frame), clock);
        lastLeadSay = clock;
      }
      if (leader) leaderPrev = leader;

      // Leg counter (relay) or lap counter (multi-lap) + final-leg/lap trigger.
      if (lapText && config.relay && relayLegTotal > 0) {
        const legs = frame.racers.filter((r) => r.phase === 'running' && r.leg !== undefined).map((r) => r.leg!);
        const leg = legs.length ? Math.min(relayLegTotal, Math.max(...legs) + 1) : 1;
        lapText.text = `🏃 ${leg} / ${relayLegTotal} 주자`;
        if (!lastLapTriggered && leg >= relayLegTotal) {
          lastLapTriggered = true;
          triggerLastLap();
        }
      } else if (lapText && config.laps > 1) {
        const maxP = Math.max(...frame.racers.map((r) => r.progress));
        const lap = Math.min(config.laps, Math.floor(maxP / config.trackLength) + 1);
        lapText.text = `🏁 ${lap} / ${config.laps} 바퀴`;
        if (!lastLapTriggered && lap >= config.laps) {
          lastLapTriggered = true;
          triggerLastLap();
        }
      }

      if (banner) {
        const age = clock - bannerBornAt;
        if (age > 1.8) {
          banner.destroy();
          banner = null;
        } else {
          const pop = Math.min(1, age * 6);
          banner.scale.set(0.6 + pop * 0.4 + Math.sin(clock * 18) * 0.02);
          banner.alpha = age < 1.3 ? 1 : Math.max(0, 1 - (age - 1.3) / 0.5);
        }
      }

      fx.update(clock, dt);
      bubbles.update(clock);
      commentary.update(clock);
      for (const [id, p] of posById) bubbles.follow(id, p.x, p.y - 64);
    },

    showResult(result) {
      if (!config) return;
      clearPodium();
      // Switch to a blue victory field; hide the track + HUD.
      trackLayer.visible = false;
      if (scoreboard) scoreboard.root.visible = false;
      if (topHud) topHud.root.visible = false;
      if (lapText) lapText.visible = false;
      if (banner) {
        banner.destroy();
        banner = null;
      }
      boxLayer.visible = false;
      commentary.hide();
      fx.root.visible = false;
      bubbles.root.visible = false;

      podiumScene = new Container();
      const baseY = height * 0.66;
      podiumScene.addChild(new Graphics().rect(0, 0, width, height).fill(0x4aa3e0));
      podiumScene.addChild(new Graphics().rect(0, baseY, width, height - baseY).fill(0x3f8fd0));
      app.stage.addChildAt(podiumScene, 1); // above track, below characters

      const top = result.order.slice(0, Math.min(3, result.order.length));
      const slotX = [width / 2, width / 2 - 160, width / 2 + 160]; // 1st centre, 2nd left, 3rd right
      const blockH = [150, 108, 80];
      const blockColor = [0xffd23f, 0xc8cbd0, 0xcd8b53];
      const bw = 120;

      top.forEach((id, rank) => {
        const x = slotX[rank];
        const h = blockH[rank];
        const block = new Graphics().roundRect(x - bw / 2, baseY - h, bw, h, 8).fill(blockColor[rank]);
        block.stroke({ color: 0xffffff, width: 3, alpha: 0.65 });
        const num = new Text({ text: `${rank + 1}`, style: { fontSize: 46, fontWeight: '900', fill: 0xffffff } });
        num.anchor.set(0.5);
        num.position.set(x, baseY - h / 2);
        podiumScene!.addChild(block, num);

        const v = views.get(id);
        if (!v) return;
        v.character.root.visible = true;
        v.character.root.position.set(x, baseY - h - 14);
        v.character.root.scale.set((rank === 0 ? 0.85 : 0.72) * v.size);
        v.character.root.zIndex = 1000 + (3 - rank);
        v.tag.root.visible = true;
        v.tag.setPosition(x, baseY - h - 92);
        v.tag.root.zIndex = 200000;
        podiumChars.push({ char: v.character, winner: rank === 0 });
      });

      for (const [id, v] of views) {
        if (!top.includes(id)) {
          v.character.root.visible = false;
          v.tag.root.visible = false;
        }
      }

      podiumClock = 0;
      podiumTick = (ticker) => {
        podiumClock += ticker.deltaMS / 1000;
        for (const pc of podiumChars) {
          pc.char.update({
            phase: 'celebrate',
            speedNorm: pc.winner ? 1 : 0.5,
            clock: podiumClock,
            facing: 0,
            heading: 1,
            reducedMotion,
          });
        }
      };
      app.ticker.add(podiumTick);
    },

    setReducedMotion(on) {
      reducedMotion = on;
    },

    resize(w, h) {
      width = w;
      height = h;
      app.renderer?.resize(w, h);
      if (config) rebuildTrack();
      if (scoreboard) scoreboard.root.position.set(width - 144, 12);
      if (topHud) topHud.root.position.set(TOP_HUD_MARGIN, height - TOP_HUD_H - TOP_HUD_MARGIN);
      commentary.root.position.set(width / 2, height - 40);
      if (lapText) lapText.position.set(width / 2, 10);
    },

    destroy() {
      clearPodium();
      for (const v of views.values()) v.character.destroy();
      views.clear();
      app.destroy(true, { children: true });
    },
  };

  return renderer;
}
