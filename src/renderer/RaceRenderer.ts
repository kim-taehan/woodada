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
import { trackCatalog, grassland, pickArena } from '../data/tracks/index.ts';
import type { TrackTheme } from '../data/tracks/schema.ts';
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
  /**
   * Eagle divebomb (jump-headbutt) screen-space action: the clock at which the
   * hop started, or -1 when not active. During the window the sprite springs up
   * off the SCREEN (a low hop), floats briefly, then drops + lunges forward so
   * "hopped up and rammed head-first" reads in the top-down view. Pure visual
   * offset — never touches simulation.
   */
  diveAt: number;
  /**
   * Who this headbutt is lunging onto. During the drop the eagle's body slides
   * from its own track spot to the target's CURRENT spot so it lands ON the
   * front racer (not in place). `null` = a self-botch crash (stays put, the
   * point of the gamble) or no target. Display-only.
   */
  diveTargetId: string | null;
}

export interface RaceRenderer {
  mount(parent: HTMLElement): Promise<void>;
  /**
   * Build the scene for a race. `opts.arenaId` selects the arena theme
   * (feat/arenas):
   *   • undefined  → grassland (classic; NOT seed-derived → e2e goldens stay put)
   *   • 'random'   → pickArena(config.seed) (deterministic per seed, opt-in)
   *   • a known id → that theme (unknown id falls back to grassland)
   * Theme is renderer-only — it never touches the engine RaceConfig contract.
   */
  buildScene(config: RaceConfig, opts?: { arenaId?: string }): void;
  renderFrame(frame: EngineFrame): void;
  showResult(result: RaceResult): void;
  /**
   * Advance only the FX particles (no engine step, no new events) by `seconds`,
   * in small sub-steps, so grow/motion effects develop into a readable state for
   * a deterministic still after a `seek`. Display-only; never touches simulation.
   */
  pumpFx(seconds: number): void;
  setReducedMotion(on: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
  readonly canvas: HTMLCanvasElement | undefined;
}

type Pos = { x: number; y: number; heading: number };

/** Base character scale (multiplied by per-point perspective). */
const CHAR_SCALE = 0.52;

// Eagle divebomb (jump-headbutt) screen-space action timing (seconds from start).
const DIVE_RISE = 0.22; // spring up off the ground (eased out — a quick hop)
const DIVE_HANG = 0.05; // a tiny float at the top of the hop before the lunge
const DIVE_PLUNGE = 0.26; // drop + lunge forward onto the target (eased in)
const DIVE_TOTAL = DIVE_RISE + DIVE_HANG + DIVE_PLUNGE;
const DIVE_LIFT = 46; // peak screen-Y hop height (px) — a low forward pounce, not a soar
const DIVE_POP = 0.16; // slight scale bump at the apex of the hop
// When the divebomb impact FX should land: as the headbutt connects at the bottom.
const IMPACT_DELAY = DIVE_RISE + DIVE_HANG + DIVE_PLUNGE * 0.82;

/**
 * Screen-space hop offset at `age` seconds into the jump-headbutt: how high off
 * the ground the eagle is (`lift`, px upward), a scale bump (`pop`), and `glide`
 * (0→1) — the lunge progress used to slide the body horizontally onto the target.
 * Springs up over its own spot (glide 0), floats briefly, then drops while lunging
 * forward (glide→1) so it rams the target head-first. Returns null once over.
 */
function diveOffset(age: number): { lift: number; pop: number; glide: number } | null {
  if (age < 0 || age > DIVE_TOTAL) return null;
  if (age < DIVE_RISE) {
    const k = age / DIVE_RISE;
    const e = 1 - (1 - k) * (1 - k); // ease-out: quick spring, settling at the top
    return { lift: DIVE_LIFT * e, pop: DIVE_POP * e, glide: 0 };
  }
  if (age < DIVE_RISE + DIVE_HANG) {
    return { lift: DIVE_LIFT, pop: DIVE_POP, glide: 0 }; // float at the top of the hop
  }
  const k = (age - DIVE_RISE - DIVE_HANG) / DIVE_PLUNGE;
  const e = k * k; // ease-in: accelerating drop + forward lunge
  return { lift: DIVE_LIFT * (1 - e), pop: DIVE_POP * (1 - e), glide: e };
}

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

/**
 * True if a racer's one-lap position lies inside an active ice zone (mirrors the
 * engine's `inZone`, wrap-aware). Display-only: it picks the penguin's belly-slide
 * pose; it never changes the simulation (the engine already applied the boost).
 */
function lapPosInZones(progress: number, trackLength: number, zones: EngineFrame['iceZones']): boolean {
  const lapPos = ((progress % trackLength) + trackLength) % trackLength;
  for (const z of zones) {
    const end = z.startProgress + z.length;
    if (end <= trackLength) {
      if (lapPos >= z.startProgress && lapPos < end) return true;
    } else if (lapPos >= z.startProgress || lapPos < end - trackLength) {
      return true;
    }
  }
  return false;
}

/** Bottom-left margin + assumed full (3-row) height of the live TOP-3 HUD. */
const TOP_HUD_MARGIN = 16;
const TOP_HUD_H = 120; // title + 3 rows; pins the card's top so it sits in the corner

function isTeamId(id: string | undefined): id is TeamId {
  return id !== undefined && id in teamPalette;
}

/**
 * Deterministic hash of a racer id → a stable [0,1) value. Used for the
 * post-finish free-scatter offsets so the layout is reproducible (no
 * Math.random) — same (config+seed) yields the same celebration tableau.
 */
function hash01(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mix and fold to [0,1).
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

// --- Post-finish "coast → free scatter → emote" tuning (display-only, #33) ---
// A finished racer keeps gliding past the line, decelerating, then settles into
// a deterministically-scattered spot in the open infield by the finish and
// celebrates/slumps by placement. All driven off (frame - finishedAt), so it is
// reproducible and never touches the simulation.
const COAST_SECS = 0.7; // ease-out glide from the line to the settle spot
const SCATTER_RX = 46; // per-racer horizontal jitter around its rank slot (px)
const SCATTER_RY = 64; // vertical jitter — fans them off the lane line (px)

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c) * (1 - c);
}

export function createRaceRenderer(): RaceRenderer {
  const app = new Application();
  let track: OvalTrack;
  let config: RaceConfig | null = null;
  // Arena theme (feat/arenas). Resolved once per race in buildScene from the
  // requested arenaId (or the seed when 'random'/unset). Held so resize/rebuild
  // re-draws the same arena. Defaults to the classic grassland.
  let theme: TrackTheme = grassland;
  let trackLayer = new Container();
  const charLayer = new Container();
  const fx = new FxLayer();
  const bubbles = new SpeechBubbleLayer();
  const boxLayer = new Container();
  const boxSprites = new Map<string, Container>();
  const boxBorn = new Map<string, number>();
  // Penguin icefield: a slick patch drawn on the track from EngineFrame.iceZones.
  // Redrawn each frame (zones are few and short-lived). Sits under the racers.
  const iceLayer = new Container();
  const commentary = new CommentaryBar();
  let namesById: Record<string, string> = {};
  // Character id per racer — lets the renderer recognise a cat shrugging off a
  // disruption (immunity dodge) and flash its "냐옹" shimmer on the cat itself.
  const charIdById = new Map<string, string>();
  let leaderPrev: string | null = null;
  let lastLeadSay = -100;
  // Star-invincibility window per racer (engine frame index until). Refreshed each
  // frame from RacerState.skill.starUntil so playEvent can branch a deflected hit
  // into a "star shield" and renderFrame can draw the ongoing rainbow shimmer.
  const starUntilById = new Map<string, number>();
  let curFrameIdx = 0;
  let scoreboard: Scoreboard | null = null;
  let topHud: TopRankHud | null = null;
  const views = new Map<string, RacerView>();
  // Deferred FX scheduled to fire at a future clock — used to land the eagle's
  // divebomb headbutt impact (feathers/stars/dizzy) at the BOTTOM of its hop
  // rather than at the instant of the event. Drained by renderFrame + pumpFx.
  const pendingFx: { at: number; fn: () => void }[] = [];
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

  /**
   * Draw the penguin's active ice zones onto the track (under the racers, above
   * the red track so it stands out). Each zone is a vivid cyan slick spanning the
   * full lane width — a chilly fill, a bright white rim, a glossy shine streak,
   * and ❄️ glints — so the "slippery patch" reads instantly against the red track.
   * Fades out smoothly in its final frames. Purely visual; never feeds back.
   *
   * A zone may wrap past the start/finish line (start + length > trackLength); we
   * split it into ≤2 lap-space segments so it never smears across the whole oval.
   */
  function drawIce(zones: EngineFrame['iceZones'], trackLength: number, frameIdx: number): void {
    iceLayer.removeChildren();
    if (!zones.length) return;
    const span = track.geo.laneSpan;
    const innerOff = track.laneOffset(0) - span * 0.28; // bleed a touch past lane 0
    const outerOff = track.laneOffset(1) + span * 0.28; // …and past the outer lane
    const FADE_FRAMES = 18; // smooth fade-out over the last ~0.3s
    const ICE = 0x5bc8e8; // penguin palette `water` — chilly cyan

    const drawSeg = (startU: number, lenU: number, alpha: number): void => {
      const g = new Graphics();
      const steps = 16;
      const inner: { x: number; y: number }[] = [];
      const outer: { x: number; y: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const u = (startU + (lenU * i) / steps) % 1;
        inner.push(track.pointAt(u, innerOff));
        outer.push(track.pointAt(u, outerOff));
      }
      g.moveTo(inner[0].x, inner[0].y);
      for (const pt of inner) g.lineTo(pt.x, pt.y);
      for (let i = outer.length - 1; i >= 0; i--) g.lineTo(outer[i].x, outer[i].y);
      g.closePath();
      // Solid-ish chilly fill + a thick bright rim so it pops off the red track.
      g.fill({ color: ICE, alpha: 0.72 * alpha });
      g.stroke({ color: 0xffffff, width: 4, alpha: 0.95 * alpha });
      iceLayer.addChild(g);

      // Glossy shine: a paler ribbon hugging the inner half of the band.
      const shine = new Graphics();
      const sOuter = (innerOff + outerOff) / 2;
      const si: { x: number; y: number }[] = [];
      const so: { x: number; y: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const u = (startU + (lenU * i) / steps) % 1;
        si.push(track.pointAt(u, innerOff + span * 0.08));
        so.push(track.pointAt(u, sOuter));
      }
      shine.moveTo(si[0].x, si[0].y);
      for (const pt of si) shine.lineTo(pt.x, pt.y);
      for (let i = so.length - 1; i >= 0; i--) shine.lineTo(so[i].x, so[i].y);
      shine.closePath();
      shine.fill({ color: 0xeafaff, alpha: 0.45 * alpha });
      iceLayer.addChild(shine);

      // ❄️ glints down the centre.
      for (let i = 2; i < steps; i += 4) {
        const u = (startU + (lenU * i) / steps) % 1;
        const c = track.pointAt(u, (innerOff + outerOff) / 2);
        const flake = new Text({ text: '❄️', style: { fontSize: 20 } });
        flake.anchor.set(0.5);
        flake.position.set(c.x, c.y);
        flake.scale.set(c.scale * 0.9);
        flake.alpha = alpha;
        iceLayer.addChild(flake);
      }
    };

    for (const z of zones) {
      const remain = z.activeUntil - frameIdx;
      const alpha = remain >= FADE_FRAMES ? 1 : Math.max(0, remain / FADE_FRAMES);
      if (alpha <= 0) continue;
      const start = ((z.startProgress % trackLength) + trackLength) % trackLength;
      const end = start + z.length;
      if (end <= trackLength) {
        drawSeg(start / trackLength, z.length / trackLength, alpha);
      } else {
        // Wraps the line: split into [start, trackLength) and [0, overflow).
        drawSeg(start / trackLength, (trackLength - start) / trackLength, alpha);
        drawSeg(0, (end - trackLength) / trackLength, alpha);
      }
    }
  }

  function rebuildTrack(): void {
    track = new OvalTrack(ovalForCanvas(width, height, fieldBand));
    trackLayer.removeFromParent();
    // Team (non-relay) races flank the finish tape with the participating teams'
    // vest colors (first-appearance order, de-duped). Relay keeps its plain
    // lap-boundary checker (its identity comes from the leg-counter banner).
    const teamColors: number[] = [];
    if (config?.teamMode && !config.relay) {
      const seen = new Set<TeamId>();
      for (const p of config.participants) {
        if (isTeamId(p.teamId) && !seen.has(p.teamId)) {
          seen.add(p.teamId);
          teamColors.push(hexNum(teamPalette[p.teamId].fill));
        }
      }
    }
    trackLayer = buildTrackScene(track, width, height, teamColors, theme);
    app.stage.addChildAt(trackLayer, 0);
  }

  /**
   * Resolve a requested arenaId to a concrete theme:
   *   • undefined        → grassland (classic). NOT seed-derived, so omitting an
   *     arena never drifts the look — this keeps the e2e goldens (seed 7/35 etc.)
   *     pinned to the original grassland background.
   *   • 'random'         → deterministic pick from the seed (explicit opt-in only).
   *   • a known id       → that theme.
   *   • an unknown id    → grassland fallback (a bad id never breaks the scene;
   *     pickArena is reserved for an explicit 'random').
   */
  function resolveTheme(arenaId: string | undefined, seed: number): TrackTheme {
    if (arenaId === undefined) return grassland;
    if (arenaId === 'random') return pickArena(seed);
    return trackCatalog[arenaId] ?? grassland;
  }

  /** Queue an FX callback to fire once `clock` reaches `at` (drained each frame). */
  function scheduleFx(at: number, fn: () => void): void {
    pendingFx.push({ at, fn });
  }

  /** Fire any scheduled FX whose time has arrived (in chronological order). */
  function drainPendingFx(): void {
    if (!pendingFx.length) return;
    pendingFx.sort((a, b) => a.at - b.at);
    while (pendingFx.length && pendingFx[0].at <= clock) {
      pendingFx.shift()!.fn();
    }
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
    // Spike colour for an actor (hedgehog bristle quills use palette `base`, the
    // dominant spike brown — not the pale face `point` tint stored on the view).
    const spikeTintOf = (id: string): number => {
      const cid = charIdById.get(id);
      const pal = cid ? characterCatalog[cid]?.palette : undefined;
      return hexNum(pal?.base ?? pal?.point ?? '#9C6B3F');
    };
    // A dodge where the TARGET is currently star-invincible is a "star deflect"
    // (the star no-sold the hit), not a cat catwalk slip. Branch the FX/glow.
    const targetStarred = e.variant === 'dodge' && !!e.targetId && (starUntilById.get(e.targetId) ?? -1) > curFrameIdx;
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
      case 'divebomb:activate':
        // Eagle springs UP off the ground then drops + lunges forward (screen-space
        // action — sets the hop on the actor's view). Speed-lines flick out as it
        // leaps. Target is unknown until the paired hit/dodge event (same frame);
        // reset here so a fresh hop defaults to a self-spot pounce until set below.
        v.diveAt = clock;
        v.diveTargetId = null;
        fx.speedLines(self.x, self.y - 6, dir, clock);
        break;
      case 'divebomb:dodge':
        // Cat slipped the headbutt — the eagle rams empty air over the (escaped)
        // cat. Lunge the body onto the target's spot anyway so the headbutt reads
        // as aimed (the cat just isn't there when it lands).
        v.diveTargetId = e.targetId ?? null;
        // Delay to the bottom of the plunge so the whiff lands as the eagle arrives.
        // If a star racer deflected it, flash a shield there instead of a whiff.
        if (targetStarred && at) {
          scheduleFx(clock + IMPACT_DELAY, () => {
            const a = (e.targetId ? posById.get(e.targetId) : undefined) ?? at;
            fx.starShield(a.x, a.y, clock + IMPACT_DELAY);
          });
        } else {
          scheduleFx(clock + IMPACT_DELAY, () => fx.whiff((at ?? self).x, (at ?? self).y, clock + IMPACT_DELAY));
        }
        break;
      case 'divebomb:hit':
        if (e.targetId === e.racerId) {
          // Gamble LOST — the eagle face-plants ITSELF at the bottom of its hop.
          // Failure cue is deliberately DULL + GREY (no bright stars/gold): a grey
          // dust slump, a drooping 😵 swirl, sweat-bead and a "꽝..." so it reads
          // instantly as a flop. No glide: the body stays over its own spot.
          v.diveTargetId = null;
          scheduleFx(clock + IMPACT_DELAY, () => {
            const p = posById.get(e.racerId) ?? self;
            fx.swoop(p.x - dir * 40, p.y, p.x, p.y, clock + IMPACT_DELAY);
            fx.dustSlump(p.x, p.y, clock + IMPACT_DELAY);
          });
        } else if (at) {
          // Gamble WON — headbutt connects at the bottom of the hop. Success cue is
          // bright + GOLD: a triumphant gold burst + "명중!" pop ON THE EAGLE (who
          // acted), while the TARGET is slammed (head-first impact, feathers, stars,
          // dizzy stun). The gold-on-actor vs grey-self-slump contrast makes win vs
          // flop read at a glance. Lunge the body onto the target's CURRENT spot.
          v.diveTargetId = e.targetId ?? null;
          scheduleFx(clock + IMPACT_DELAY, () => {
            const a = (e.targetId ? posById.get(e.targetId) : undefined) ?? at;
            const eagle = posById.get(e.racerId) ?? self;
            fx.goldBurst(eagle.x, eagle.y, clock + IMPACT_DELAY);
            fx.swoop(self.x, a.y, a.x, a.y, clock + IMPACT_DELAY);
            fx.feathers(a.x, a.y, clock + IMPACT_DELAY);
            fx.stars(a.x, a.y, clock + IMPACT_DELAY);
            fx.dizzy(a.x, a.y, clock + IMPACT_DELAY);
          });
        }
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
          if (targetStarred) fx.starShield(at.x, at.y, clock);
          else fx.whiff(at.x, at.y, clock);
        }
        break;
      case 'item:star':
        // ⭐ Star: a loud rainbow burst on the eater the instant it goes invincible.
        // The ongoing "I'm invincible NOW" shimmer is drawn in renderFrame while the
        // star window stays live (starUntilById).
        fx.starBurst(self.x, self.y, clock);
        break;
      case 'item:lightning':
        // ⚡ Lightning: full-screen flash + a bolt onto the eater. Everyone else
        // is slowed by the engine; visually they simply sag back.
        fx.lightning(self.x, self.y, width, height, clock);
        break;
      case 'item:fart':
        // 💨 Fart cloud trailing behind the eater (those behind get slowed).
        fx.fart(self.x, self.y, dir, clock);
        break;
      case 'item:shell':
        // 🐢 Shell launch toss out in front of the eater (the bonk lands on
        // the shellhit event against the current leader).
        fx.shellThrow(self.x, self.y - 6, self.x + dir * 60, self.y - 30, clock);
        break;
      case 'item:shellhit':
        // 🐢 Shell connects on the current leader (targetId) — bonk + dizzy stun,
        // reusing the roar/divebomb stun read. If the leader ate its own shell,
        // targetId === racerId and it lands on the eater itself.
        if (at) {
          fx.shellThrow(self.x, self.y - 6, at.x, at.y - 6, clock);
          fx.stars(at.x, at.y, clock);
          fx.dizzy(at.x, at.y, clock);
        }
        break;
      case 'roar:activate':
        fx.shockwave(self.x, self.y, clock);
        fx.dust(self.x, self.y + 12, clock);
        break;
      case 'roar:hit':
        // Per-victim stagger from the roar's shockwave: dizzy swirl + impact ring
        // on the struck racer (distinct from a banana's slip). Many fire at once.
        if (at) fx.dizzy(at.x, at.y, clock);
        break;
      case 'bristle:activate': {
        // 🦔 Hedgehog flares its quills: a ring of spikes snapping outward in the
        // spike colour (palette `base`), not the pale face tint. The actor's glow +
        // pop are already raised above; this is the "가시 곤두" punch.
        const spikeTint = spikeTintOf(e.racerId);
        fx.bristle(self.x, self.y, spikeTint, clock);
        break;
      }
      case 'bristle:hit':
        // 🦔 The chaser (just behind) gets bounced BACKWARD off the spines: a sharp
        // impact + quill shards + a dust skid the way it recoils. `at.heading` gives
        // the chaser's travel sign so spikeShove flings it opposite. It is also
        // slowed by the engine; visually it simply sags back.
        if (at) fx.spikeShove(at.x, at.y, spikeTintOf(e.racerId), at.heading >= 0 ? 1 : -1, clock);
        break;
      case 'bristle:dodge':
        // 🦔 The chaser slipped past the spines (catwalk dodge / ⭐ star). The shared
        // dodge handler below raises the star-shield / cat shimmer; add a "헛가시"
        // whiff at the chaser unless a star deflected it (which has its own flash).
        if (at && !targetStarred) fx.whiff(at.x, at.y, clock);
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

    // A shrugged-off disruption surfaces as a `<attacker>:dodge` (targetId = the
    // racer who No-Sold it). Two reasons it can be dodged:
    //  • Star invincibility → flash a ⭐ shield + glow on the (any) star racer.
    //  • Cat catwalk immunity → the cat's "냐옹" shimmer + brief glow.
    // (Commentary is left to the attacker's dodge line so the bar doesn't double up.)
    // The roar dodge has no switch case above, so its shield/shimmer is raised here.
    if (e.variant === 'dodge' && e.targetId && at && v2) {
      if (targetStarred) {
        if (e.type === 'roar') fx.starShield(at.x, at.y, clock); // roar has no case above
        v2.glowUntil = Math.max(v2.glowUntil, clock + 1.0);
      } else if (charIdById.get(e.targetId) === 'cat') {
        fx.sparkle(at.x, at.y, clock);
        v2.glowUntil = Math.max(v2.glowUntil, clock + 0.8);
      }
    }
  }

  /**
   * Place a racer that has already crossed the line (#33). It coasts a short way
   * past the finish (ease-out glide), settles into a deterministically-scattered
   * spot in the open area by the bottom-right finish (NOT a tidy lane line), and
   * then emotes by placement: leaders bounce/cheer with ✨💗, the back-marker
   * slumps with a 💧, the middle just idles. Everything keys off (frame -
   * finishedAt) + an id-hash so the still is reproducible. Display-only.
   */
  function placeFinished(
    r: RacerState,
    v: RacerView,
    fieldCount: number,
    frameIdx: number,
    posById: Map<string, Pos>,
  ): void {
    const rank = r.rank ?? fieldCount;
    // Where it crossed: the live track point at the finish corner.
    const cross = track.place(r.progress, config!.trackLength, r.lane);

    // Scatter target: a loose cloud strewn down the open RIGHT HALF of the
    // bottom straight — the empty space the field coasts into past the centre
    // finish line. Each racer's slot fans out by PLACEMENT (1st furthest right,
    // having coasted on; trailing places nearer the centre line), then a
    // deterministic id-hash jitter so it's a free huddle — never a tidy lane
    // line. Anchored clear of the right curve and the corner HUDs.
    const geo = track.geo;
    // Rank lays the racers out along the straight's right half, 1st furthest
    // right (coasted on), the field trailing back toward the centre finish.
    const rankFrac = fieldCount > 1 ? (rank - 1) / (fieldCount - 1) : 0; // 0=1st .. 1=last
    const anchorX = geo.cx + geo.straightHalf * 0.82 - rankFrac * geo.straightHalf * 0.7;
    const anchorY = geo.cy + geo.radius + geo.laneSpan * 0.12;
    const hx = hash01(r.id, 1) * 2 - 1; // [-1,1)
    const hy = hash01(r.id, 2) * 2 - 1;
    const targetX = anchorX + hx * SCATTER_RX;
    const targetY = anchorY + hy * SCATTER_RY;

    // Coast: ease-out glide from the crossing point to the settle spot.
    const secs = Math.max(0, (frameIdx - r.finishedAt!)) / 60;
    const k = easeOutCubic(secs / COAST_SECS);
    const x = cross.x + (targetX - cross.x) * k;
    const y = cross.y + (targetY - cross.y) * k;

    // Perspective scale tracks the screen-Y of the settle spot (nearer = bigger).
    const depthScale = 0.82 + ((y - (geo.cy - geo.radius)) / (2 * geo.radius)) * 0.36;
    const baseScale = CHAR_SCALE * depthScale * v.size * fieldScale;
    v.character.root.scale.set(baseScale);
    v.character.root.position.set(x, y);
    v.character.root.zIndex = 80000 + y; // celebrating crowd sits above the track

    // Emote tier by placement (only once settled, so the coast reads as a glide,
    // not an instant jig). Top 3 cheer; the very back slumps; the rest idle.
    const settled = k > 0.85;
    let phase: string = 'finished'; // win pose, standing tall while gliding in
    const top3 = rank <= 3;
    const lastish = rank >= fieldCount; // dead last
    if (settled) phase = top3 ? 'celebrate' : lastish ? 'dejected' : 'finished';
    v.character.update({
      phase,
      speedNorm: top3 ? 1 : 0.4,
      clock,
      facing: 0,
      heading: 1,
      reducedMotion,
    });
    v.tag.setPosition(x, y - 66 * depthScale * fieldScale);
    v.tag.root.zIndex = 100000 + y;
    v.glow.visible = false;

    // Celebration sparkle/heart shower for the podium-bound; a sad sweat-drop for
    // the back-marker. Throttled + deterministic-ish via clock phase; suppressed
    // under reduced motion.
    if (settled && !reducedMotion) {
      if (top3) {
        if (Math.sin(clock * 9 + rank) > 0.7) fx.sparkle(x + hx * 18, y - 70 + hy * 8, clock);
        if (Math.sin(clock * 5 + rank * 1.7) > 0.85) fx.heart(x, y - 78, clock);
      } else if (lastish && Math.sin(clock * 3) > 0.9) {
        fx.sweat(x + 14, y - 52, clock);
      }
    }

    posById.set(r.id, { x, y, heading: 1 });
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
      app.stage.addChild(iceLayer, boxLayer, charLayer, bubbles.root, fx.root, commentary.root);
      commentary.root.position.set(width / 2, height - 40);
    },

    buildScene(cfg, opts) {
      config = cfg;
      theme = resolveTheme(opts?.arenaId, cfg.seed);
      clearPodium();
      for (const v of views.values()) v.character.destroy();
      views.clear();
      pendingFx.length = 0;
      charLayer.removeChildren();
      bubbles.clear();
      fx.clear();
      fx.root.visible = true;
      bubbles.root.visible = true;
      for (const s of boxSprites.values()) s.destroy();
      boxSprites.clear();
      boxBorn.clear();
      boxLayer.visible = true;
      iceLayer.removeChildren();
      iceLayer.visible = true;
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
        views.set(p.id, { character, tag, tint, size: char.renderScale ?? 1, glow, glowUntil: 0, diveAt: -1, diveTargetId: null });
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
      curFrameIdx = frame.frame;
      // Refresh star-invincibility windows so playEvent can branch deflected hits
      // into a "star shield" and the loop below can shimmer active star racers.
      starUntilById.clear();
      for (const r of frame.racers) {
        const su = r.skill.starUntil;
        if (su !== undefined) starUntilById.set(r.id, su);
      }

      const posById = new Map<string, Pos>();
      // Live racer states by id so a diving eagle can read its target's CURRENT
      // track spot each frame (the target keeps moving during the plunge).
      const stateById = new Map<string, RacerState>();
      for (const r of frame.racers) stateById.set(r.id, r);
      // Relay: collect waiting teammates so they queue off-track instead of
      // standing on the racing line. Drawn after the main loop, by team.
      const waiting: RacerState[] = [];
      const fieldCount = frame.racers.length;
      for (const r of frame.racers) {
        const v = views.get(r.id);
        if (!v) continue;
        if (config.relay && r.phase === 'waiting') {
          waiting.push(r);
          continue;
        }
        // ── Post-finish: coast past the line → free-scatter → emote by rank (#33).
        // Display-only: positions are interpolated by (frame - finishedAt) and a
        // deterministic id-hash, so the tableau is reproducible and never feeds
        // back into the simulation (relay finals still queue via `waiting` above).
        if (r.phase === 'finished' && r.finishedAt !== undefined && !config.relay) {
          placeFinished(r, v, fieldCount, frame.frame, posById);
          continue;
        }
        const tp = track.place(r.progress, config.trackLength, r.lane);
        // Screen-space travel direction (finite-difference, geometry-exact): its
        // x-sign tells a side-profile character which way to face on the curves.
        const heading = track.travelDir(r.progress, config.trackLength, r.lane).x;
        const baseScale = CHAR_SCALE * tp.scale * v.size * fieldScale;
        // Eagle divebomb (screen-space jump-headbutt): hop it up the screen a touch
        // then drop. Layered on top of the normal bob so it reads as "sprang up,
        // then rammed forward" in the top-down view. During the drop the body also
        // LUNGES onto the target's current spot so it rams the front racer
        // (self-botch / no target → glide 0, drops in place). Ends → diveAt reset.
        let lift = 0;
        let bodyX = tp.x;
        let bodyY = tp.y;
        let diving = false;
        let diveTilt = 0; // forward-lean applied AFTER update() (which sets root.rotation)
        if (v.diveAt >= 0) {
          const d = diveOffset(clock - v.diveAt);
          if (d) {
            lift = d.lift;
            diving = true;
            // Lunge toward the target's live track spot during the drop. If the
            // target vanished (finished/relay-swapped), fall back to a self-spot
            // drop so the headbutt still resolves cleanly.
            const tgt = v.diveTargetId ? stateById.get(v.diveTargetId) : undefined;
            if (tgt && d.glide > 0) {
              const ttp = track.place(tgt.progress, config.trackLength, tgt.lane);
              bodyX = tp.x + (ttp.x - tp.x) * d.glide;
              bodyY = tp.y + (ttp.y - tp.y) * d.glide;
            }
            // Lean head-first into the lunge, tipping toward the target (root.rotation
            // is RADIANS). Applied after update() so it isn't overwritten.
            diveTilt = (bodyX >= tp.x ? 1 : -1) * 0.32 * d.glide;
            v.character.root.scale.set(baseScale * (1 + d.pop));
          } else {
            v.diveAt = -1;
            v.character.root.scale.set(baseScale);
          }
        } else {
          v.character.root.scale.set(baseScale);
        }
        v.character.root.position.set(bodyX, bodyY - lift);
        v.character.root.zIndex = diving ? 90000 + tp.z : tp.z; // dive sits above the field
        // Penguin belly-slide: it goes prone while inside an active icefield zone
        // (matches the engine's species boost). Display-only pose selection.
        const onIce =
          charIdById.get(r.id) === 'penguin' &&
          frame.iceZones.length > 0 &&
          lapPosInZones(r.progress, config.trackLength, frame.iceZones);
        // Cat ice-hop: the engine flags when the nimble cat is bounding clear over
        // an icefield zone (vs. slipping). Renderer plays the jump pose + a sparkle
        // trail so the graceful leap reads at a glance. Display-only.
        const iceJumping = charIdById.get(r.id) === 'cat' && r.skill.iceJumping === true;
        if (iceJumping && !reducedMotion && Math.sin(clock * 11) > 0.6) {
          fx.sparkle(tp.x, tp.y - lift - 18 * tp.scale * fieldScale, clock);
        }
        v.character.update({
          phase: r.phase,
          speedNorm: Math.min(1, r.speed / 3),
          clock,
          facing: r.facing,
          heading,
          reducedMotion,
          onIce,
          iceJumping,
        });
        if (diveTilt !== 0) v.character.root.rotation = diveTilt; // headbutt lunge lean (overrides update's pose)
        v.tag.setPosition(tp.x, tp.y - 66 * tp.scale * fieldScale);
        v.tag.root.zIndex = 100000 + tp.z;

        // ⭐ Star invincibility: while the window is live, force the glow on (it
        // reads as "this racer is invincible RIGHT NOW") and rain a steady ⭐/✨
        // shimmer around them, throttled so it stays sparse and deterministic.
        const starred = (starUntilById.get(r.id) ?? -1) > frame.frame && !reducedMotion;
        if (starred) v.glowUntil = Math.max(v.glowUntil, clock + dt + 0.05);

        // Pulse the skill-use glow.
        const glowing = clock < v.glowUntil && !reducedMotion;
        v.glow.visible = glowing;
        if (glowing) {
          v.glow.alpha = 0.45 + 0.3 * Math.sin(clock * 16);
          const s = (starred ? 1.18 : 1) + 0.12 * Math.sin(clock * 16);
          v.glow.scale.set(s);
        }
        if (starred && Math.sin(clock * 18) > 0.4) {
          fx.starGlint(tp.x, tp.y - lift, clock);
        }
        // 💫 Stun read: while a racer is STUNNED, keep dizzy stars spinning over its
        // head for the WHOLE stun window (not just the impact instant), so "기절 중"
        // is obvious. Throttled (like the star shimmer) so it stays sparse + cheap;
        // the impact-instant fx.dizzy from playEvent still fires and overlaps fine.
        if (r.phase === 'stunned' && !reducedMotion && Math.sin(clock * 14) > 0.3) {
          fx.dizzyGlint(tp.x, tp.y - lift, clock);
        }

        posById.set(r.id, { x: tp.x, y: tp.y, heading });
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

      drawIce(frame.iceZones, config.trackLength, frame.frame);

      for (const e of frame.events) playEvent(e, posById);
      drainPendingFx();

      // Live commentary from skill/item events.
      let saidThisFrame = false;
      for (const e of frame.events) {
        const n = namesById[e.racerId];
        if (!n) continue;
        // Eagle self-botch (lost the divebomb gamble, crashed itself): same
        // event shape as a hit but targetId === racerId, so route it to its own
        // "어이쿠 자폭ㅋㅋ" line pool via a synthetic variant.
        const selfBotch = e.type === 'divebomb' && e.variant === 'hit' && e.targetId === e.racerId;
        const variant = selfBotch ? 'self' : e.variant;
        // Pass the target name for "{n} did it to {t}" lines. Self-botch uses {n}
        // only, so don't feed it the (self) target name; undefined → '상대' fallback.
        const targetName = !selfBotch && e.targetId ? namesById[e.targetId] : undefined;
        const line = eventLine(e.type, variant, n, frame.frame + (e.targetId ? 7 : 0), targetName);
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
      iceLayer.visible = false;
      commentary.hide();
      fx.root.visible = false;
      bubbles.root.visible = false;

      podiumScene = new Container();
      const baseY = height * 0.66;
      podiumScene.addChild(new Graphics().rect(0, 0, width, height).fill(0x4aa3e0));
      podiumScene.addChild(new Graphics().rect(0, baseY, width, height - baseY).fill(0x3f8fd0));
      app.stage.addChildAt(podiumScene, 1); // above track, below characters

      // Podium occupants: top 3 by finish order. For relay each block is a TEAM,
      // so dedupe to one representative (the anchor — first/best-ranked finisher)
      // per team; this also stops a 2-team relay from putting a winning-team member
      // on the 3rd block. Non-relay keeps the plain top-3 racers.
      let top: string[];
      if (config.relay) {
        const seenTeams = new Set<string>();
        top = [];
        for (const id of result.order) {
          const tid = config.participants.find((p) => p.id === id)?.teamId ?? id;
          if (seenTeams.has(tid)) continue;
          seenTeams.add(tid);
          top.push(id);
          if (top.length === 3) break;
        }
      } else {
        top = result.order.slice(0, Math.min(3, result.order.length));
      }
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

      // Relay: the WHOLE winning team celebrates, not just its anchor. The top-3
      // are one anchor per team (only anchors get a rank), so gather the 1st
      // team's other members and cluster them on the ground around the 1st block,
      // all whooping in the celebrate pose. Non-relay races keep the 3-up podium.
      const winnerExtras: string[] = [];
      if (config.relay && top.length > 0) {
        const winId = top[0];
        const winTeam = config.participants.find((p) => p.id === winId)?.teamId;
        if (winTeam !== undefined) {
          for (const p of config.participants) {
            // Same team, not already on a podium block (avoids double-placing a
            // member that landed in the top-3 slice, e.g. a 2-team relay).
            if (p.teamId === winTeam && !top.includes(p.id) && views.has(p.id)) winnerExtras.push(p.id);
          }
        }
        const cx = slotX[0];
        const groundY = baseY + 30; // just in front of the 1st block, on the field
        winnerExtras.forEach((id, i) => {
          const v = views.get(id);
          if (!v) return;
          // Fan them left/right of (and slightly below) the anchor in a tidy huddle.
          const span = winnerExtras.length;
          const t = span > 1 ? i / (span - 1) - 0.5 : 0; // -0.5..0.5
          const px = cx + t * Math.min(150, 70 + span * 24);
          const py = groundY + ((i % 2) * 18);
          v.character.root.visible = true;
          v.character.root.position.set(px, py);
          v.character.root.scale.set(0.6 * v.size);
          v.character.root.zIndex = 990 + i; // behind/around the raised anchor
          v.tag.root.visible = false; // keep the huddle uncluttered (anchor tag shows the team)
          podiumChars.push({ char: v.character, winner: true });
        });
      }

      const shown = new Set([...top, ...winnerExtras]);
      for (const [id, v] of views) {
        if (!shown.has(id)) {
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

    pumpFx(seconds) {
      const step = 1 / 60;
      let t = 0;
      while (t < seconds) {
        clock += step;
        drainPendingFx();
        fx.update(clock, step);
        bubbles.update(clock);
        t += step;
      }
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
