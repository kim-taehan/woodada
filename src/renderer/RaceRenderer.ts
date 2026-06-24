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
import { eventLine, leadLine, lastLapLine, mimicLine, catDodgeLine, eliminationLine } from './fx/commentaryLines.ts';
import { Scoreboard } from './Scoreboard.ts';
import { TopRankHud, type TopRow } from './TopRankHud.ts';
import { teamPalette, type TeamId } from '../data/teams.ts';
import { FINISH_OFFSET_FRAC } from '../engine/types.ts';
import {
  diveOffset,
  REEL_SECS,
  crowding,
  fieldSizeScale,
  fieldBandMul,
  speciesLabel,
  fieldSizeOf,
  hexNum,
  lapPosInZones,
  isTeamId,
  hash01,
  easeOutCubic,
} from './renderUtils.ts';
import { dispatchSkillEvent } from './skillEventHandlers.ts';

export interface RacerView {
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
  /**
   * Spider abduct (web reel-in) screen-space catch-up: when this racer is yanked,
   * the engine demotes its `progress` in ONE frame (a backward teleport). To make
   * "reeled in on the silk" read, we hold the racer's screen spot from JUST BEFORE
   * the yank here and, over REEL_SECS, lerp it (easeOut) toward its live engine
   * spot — so the body slides back behind the spider instead of snapping. Pure
   * visual offset; never touches simulation. `null` = not being reeled.
   */
  reelFrom: { x: number; y: number } | null;
  /** clock (seconds) at which the reel-in tween started. */
  reelStart: number;
  /**
   * Death-match (선두탈락 only) rank badge ("1 등"/"2 등"…) shown above this racer
   * once it's knocked out and lined up in the centre row. Lazily created in
   * placeEliminated (so non-elimination races never make one); dropped with the
   * view on the next buildScene (charLayer.removeChildren + views.clear). null
   * until first shown / in 꼴찌탈락 (last) mode, which shows no badge.
   */
  rankBadge: Text | null;
  /**
   * Relay waiting runner: when this runner should move from the infield queue to
   * the start line. `null` = still in queue; number = clock (seconds) when the
   * move started. The runner lerps from queue spot to its start-line lane over
   * RELAY_WALK_SECS.
   */
  relayWalkStart: number | null;
  /** Target start-line position for relay walk (set when walk begins). */
  relayWalkTarget: Pos | null;
  /**
   * Relay handoff: when this runner just finished a leg and should move from
   * the finish line back to the waiting queue. `null` = not transitioning;
   * number = clock (seconds) when the return started. The runner lerps from
   * current spot to its queue position over RELAY_RETURN_SECS.
   */
  relayReturnStart: number | null;
  /** Target queue position for relay return (set when return begins). */
  relayReturnTarget: { x: number; y: number } | null;
  /**
   * True while this relay runner was in `running` phase in the previous frame.
   * Set by the main render loop; cleared when return animation is triggered.
   * When the runner transitions running→waiting (finished a leg), this flag fires
   * the return animation regardless of whether the engine updated r.leg (which it
   * doesn't when ownNext >= config.laps, causing the old leg-compare approach to fail).
   */
  relayWasRunning: boolean;
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
  /**
   * Lane-intro ("athlete introduction") reel: a renderer-only spotlight tour over
   * the start-line scene shown BEFORE the race plays. Dims the field, then lifts
   * each racer in turn (participants order = start slots) under a spotlight with a
   * popped name banner + a wave, ~0.8s each. Calls `onDone` once the last racer is
   * introduced and the dim/spotlight are cleared. Never touches the simulation —
   * the caller (shell) must already have laid the frame-0 start scene.
   */
  playLaneIntro(onDone: () => void): void;
  /**
   * Immediately tear down any in-progress lane intro (dim/spotlight/banner/pose)
   * and, if `onDone` hasn't fired yet, fire it once. Idempotent.
   */
  skipLaneIntro(): void;
  setReducedMotion(on: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
  readonly canvas: HTMLCanvasElement | undefined;
}

export type Pos = { x: number; y: number; heading: number };

/** Base character scale (multiplied by per-point perspective). */
const CHAR_SCALE = 0.52;

// Relay waiting runner walk to start line: duration and trigger point.
const RELAY_WALK_SECS = 1.2; // smooth walk animation duration
const RELAY_RETURN_SECS = 1.5; // finished runner returns to waiting queue
const RELAY_WALK_TRIGGER = 0.75; // first racer progress (u) to trigger 2nd runner walk (entering left curve)

/** Bottom-left margin + assumed full (3-row) height of the live TOP-3 HUD. */
const TOP_HUD_MARGIN = 16;
const TOP_HUD_H = 120; // title + 3 rows; pins the card's top so it sits in the corner

// --- Post-finish "coast → free scatter → emote" tuning (display-only, #33) ---
// A finished racer keeps gliding past the line, decelerating, then settles into
// a deterministically-scattered spot in the open infield by the finish and
// celebrates/slumps by placement. All driven off (frame - finishedAt), so it is
// reproducible and never touches the simulation.
const COAST_SECS = 0.7; // ease-out glide from the line to the settle spot
const SCATTER_RX = 46; // per-racer horizontal jitter around its rank slot (px)
const SCATTER_RY = 64; // vertical jitter — fans them off the lane line (px)

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
  // Gumiho illusionClone decoys (분신): translucent ghost chibis drawn from
  // EngineFrame.decoys. They use the SAME PartsCharacter as the owning fox so the
  // run animation matches, wrapped in a half-alpha container so they read as
  // see-through illusions. Built/destroyed per decoy id (decoys come and go).
  const decoyLayer = new Container();
  decoyLayer.sortableChildren = true;
  const decoyViews = new Map<string, { char: PartsCharacter }>();
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
  // Live decoys for the CURRENT frame (set at the top of renderFrame), so playEvent
  // can find an owner's freshly-spawned decoys to poof on an illusionClone:clone.
  let curDecoys: EngineFrame['decoys'] = [];
  let scoreboard: Scoreboard | null = null;
  let topHud: TopRankHud | null = null;
  const views = new Map<string, RacerView>();
  // Each racer's body screen position from the PREVIOUS frame, so an abduct:hit
  // (processed after the current frame's main draw loop, which already moves the
  // target to its engine-demoted spot) can seed the reel-in tween from where the
  // target was JUST BEFORE the yank — otherwise it would snap to the new spot.
  const prevScreenPos = new Map<string, { x: number; y: number }>();
  // Scratch for the CURRENT frame's body positions; swapped into prevScreenPos at
  // the next frame's start so prevScreenPos always lags by exactly one frame.
  let curScreenPos = new Map<string, { x: number; y: number }>();
  // Deferred FX scheduled to fire at a future clock — used to land the eagle's
  // divebomb headbutt impact (feathers/stars/dizzy) at the BOTTOM of its hop
  // rather than at the instant of the event. Drained by renderFrame + pumpFx.
  const pendingFx: { at: number; fn: () => void }[] = [];
  let reducedMotion = false;
  let clock = 0;
  let lastTime = 0;
  let width = 800;
  let height = 600;

  // Lane-intro ("athlete introduction") state. Renderer-only spotlight reel that
  // runs BEFORE the race plays (no engine step). A full-screen dim overlay drops
  // the field into shadow; each racer in turn is lifted above it under a bright
  // spotlight, its name banner popped, and it waves (PartsCharacter.greet). All
  // driven by introTick off the Pixi ticker; idempotent teardown via cleanup.
  let introActive = false;
  let introTick: ((ticker: { deltaMS: number }) => void) | null = null;
  let introDone: (() => void) | null = null; // onDone, fired exactly once
  let introDim: Graphics | null = null; // full-screen shadow
  let introSpot: Graphics | null = null; // bright spotlight under the current racer
  let introBanner: Container | null = null; // popped name banner for the current racer

  // Victory podium state.
  let podiumScene: Container | null = null;
  // Each podium occupant carries the pose it should hold and `winner` (the bigger
  // bounce for the 1st-place team / block). `phase`: 'celebrate' = 깝치기(1등팀 only),
  // 'finished' = neutral win-stance (2·3등팀 + individual non-jig), 'dejected' =
  // slump for teams that didn't make the podium (4등팀↓, team mode only).
  let podiumChars: { char: PartsCharacter; winner: boolean; phase: 'celebrate' | 'finished' | 'dejected' }[] = [];
  let podiumClock = 0;
  let podiumTick: ((ticker: { deltaMS: number }) => void) | null = null;

  // Lap counter + final-lap emphasis.
  let lapText: Text | null = null;
  // Death-match survivor counter ("남은 N명"), under the lap counter.
  let survivorText: Text | null = null;
  let lastLapTriggered = false;
  let banner: Container | null = null;
  let bannerBornAt = 0;
  let lanePopup: Container | null = null;
  let lanePopupBornAt = 0;
  let laneChangeShown = false;
  let audioCtx: AudioContext | null = null;

  // Relay: total legs per team (max team size); 0 when not a relay.
  let relayLegTotal = 0;

  // Field-size auto-scale: computed once per race (buildScene) and held fixed
  // for the whole race so racers don't pop-resize as they finish/queue.
  let fieldScale = 1; // global character-size multiplier
  let fieldBand = 1; // lane-band widening multiplier
  // Crowding 0→1 (0 at ≤FIELD_MIN, 1 at FIELD_MAX). Drives readability dampers in
  // a packed field — FX/glow alpha shrink and the head-bubble cap tightens — so 16
  // simultaneous activations don't mush into one bright blob. 0 ⇒ small fields are
  // byte-for-byte unchanged. Held fixed for the race (set in buildScene).
  let crowdEase = 0;

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
    commentary.say(lastLapLine(Math.round(clock * 10)), clock, true); // priority: bypass the hold
  }

  function triggerLaneChange(): void {
    laneChangeShown = true;
    if (lanePopup) lanePopup.destroy();
    lanePopup = new Container();
    const bg = new Graphics();
    bg.roundRect(-110, -22, 220, 44, 14);
    bg.fill({ color: 0x1a3a2a, alpha: 0.82 });
    lanePopup.addChild(bg);
    const txt = new Text({
      text: '🏁 라인 이동 가능',
      style: { fontFamily: 'sans-serif', fontSize: 22, fontWeight: '800', fill: 0x7effb2, stroke: { color: 0x0a1f14, width: 4 } },
    });
    txt.anchor.set(0.5);
    lanePopup.addChild(txt);
    lanePopup.position.set(width / 2, height * 0.48);
    app.stage.addChild(lanePopup);
    lanePopupBornAt = clock;
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

  /**
   * 🦊 Gumiho illusionClone decoys (분신): draw each live decoy from
   * EngineFrame.decoys as a translucent ghost of the owning fox. Each decoy gets
   * its OWN PartsCharacter (same model/palette as the owner) so the run cycle
   * matches the body; the whole thing is wrapped in a half-alpha container with a
   * faint blue tint so it reads as a see-through illusion next to the opaque
   * original. The decoy moves with `progress`/`lane` like a racer (placed on the
   * oval, faces its travel direction, bobs with the run pose). Built/destroyed by
   * id as decoys spawn/expire. Display-only — never touches the simulation.
   */
  function drawDecoys(decoys: EngineFrame['decoys'], posById: Map<string, Pos>): void {
    if (!config) return;
    const present = new Set(decoys.map((d) => d.id));
    // Drop ghosts whose decoy is gone (expired / popped).
    for (const [id, dv] of [...decoyViews]) {
      if (!present.has(id)) {
        dv.char.destroy();
        decoyViews.delete(id);
      }
    }
    for (const d of decoys) {
      const ownerCid = charIdById.get(d.ownerId);
      const ownerView = views.get(d.ownerId);
      if (!ownerCid || !ownerView) continue; // owner not in this scene — skip
      let dv = decoyViews.get(d.id);
      if (!dv) {
        const char = characterCatalog[ownerCid];
        const model = partModels[char.partModelId ?? ownerCid];
        const ghost = new PartsCharacter(model, char.palette, char.runStyle);
        // Half-alpha so the illusion reads as see-through next to the opaque body
        // (co-fox 인계 메모: container.alpha ≈ 0.4). A slow flicker is layered
        // per-frame below to make it shimmer like a ghost.
        ghost.root.alpha = 0.4;
        decoyLayer.addChild(ghost.root);
        dv = { char: ghost };
        decoyViews.set(d.id, dv);
      }
      const tp = track.place(d.progress, config.trackLength, d.lane);
      const heading = track.travelDir(d.progress, config.trackLength, d.lane).x;
      const baseScale = CHAR_SCALE * tp.scale * ownerView.size * fieldScale;
      dv.char.root.scale.set(baseScale);
      dv.char.root.position.set(tp.x, tp.y);
      dv.char.root.zIndex = tp.z - 1; // sit just behind the real field at the same depth
      // Subtle ghostly flicker (0.30..0.46) so the illusion shimmers; reduced
      // motion holds a steady half-alpha.
      dv.char.root.alpha = reducedMotion ? 0.4 : 0.38 + 0.08 * Math.sin(clock * 6 + d.progress * 0.02);
      dv.char.update({
        phase: 'running',
        speedNorm: 0.8,
        clock,
        facing: 0,
        heading,
        reducedMotion,
      });
      posById.set(d.id, { x: tp.x, y: tp.y, heading });
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

  // Spike colour for an actor (hedgehog bristle quills use palette `base`, the
  // dominant spike brown — not the pale face `point` tint stored on the view).
  function spikeTintOf(id: string): number {
    const cid = charIdById.get(id);
    const pal = cid ? characterCatalog[cid]?.palette : undefined;
    return hexNum(pal?.base ?? pal?.point ?? '#9C6B3F');
  }
  // Spider silk colour for the web-abduct strand/tangle (palette `web`).
  function webTintOf(id: string): number {
    const cid = charIdById.get(id);
    const pal = cid ? characterCatalog[cid]?.palette : undefined;
    return hexNum(pal?.web ?? '#E8ECF2');
  }

  function playEvent(e: SkillEvent, posById: Map<string, Pos>): void {
    if (!config) return;
    dispatchSkillEvent({
      e, posById, views, fx, bubbles, clock, curFrameIdx, config,
      charIdById, characterCatalog, scheduleFx, track,
      spikeTintOf, webTintOf, reducedMotion, curDecoys, starUntilById,
      width, height,
    });
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
    winningTeamId?: string,
  ): void {
    const rank = r.rank ?? fieldCount;
    // Team mode: only the WINNING team is allowed to be happy. A non-winning team
    // member still coasts + settles but stays neutral (no celebrate pose, no
    // hearts/jump) regardless of its individual rank. Individual mode (no
    // winningTeamId) keeps every placement's own emote. `teamGated` = "in team
    // mode AND not on the winning team" → suppress the happy tier.
    const teamGated = winningTeamId !== undefined && r.teamId !== winningTeamId;
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
    // In team mode the celebrate tier is reserved for the WINNING team — a
    // non-winning member (teamGated) never jumps for joy, it just stands neutral
    // ('finished' win-stance, no bounce). Individual mode is unchanged.
    const settled = k > 0.85;
    const celebrates = (rank <= 3) && !teamGated; // happy tier (winning team only in team mode)
    let phase: string = 'finished'; // win pose, standing tall while gliding in
    const lastish = rank >= fieldCount; // dead last
    // A team-gated (non-winning) member stays neutral 'finished' even if last —
    // no dejected slump piling onto the "your team lost" read; keep it tidy.
    if (settled) phase = celebrates ? 'celebrate' : (lastish && !teamGated) ? 'dejected' : 'finished';
    v.character.update({
      phase,
      speedNorm: celebrates ? 1 : 0.4,
      clock,
      facing: 0,
      heading: 1,
      reducedMotion,
    });
    v.tag.setPosition(x, y - 66 * depthScale * fieldScale);
    v.tag.root.zIndex = 100000 + y;
    v.glow.visible = false;

    // Celebration sparkle/heart shower for the happy tier; a sad sweat-drop for
    // the back-marker. Throttled + deterministic-ish via clock phase; suppressed
    // under reduced motion. In team mode only the winning team (celebrates) gets
    // the hearts/sparkles; a non-winning member shows neither cheer nor sweat.
    if (settled && !reducedMotion) {
      if (celebrates) {
        if (Math.sin(clock * 9 + rank) > 0.7) fx.sparkle(x + hx * 18, y - 70 + hy * 8, clock);
        if (Math.sin(clock * 5 + rank * 1.7) > 0.85) fx.heart(x, y - 78, clock);
      } else if (lastish && !teamGated && Math.sin(clock * 3) > 0.9) {
        fx.sweat(x + 14, y - 52, clock);
      }
    }

    posById.set(r.id, { x, y, heading: 1 });
  }

  /**
   * Death-match: stage a KNOCKED-OUT racer (phase==='eliminated') in a tidy
   * HORIZONTAL row across the track centre, ordered left→right by
   * `eliminationOrder` (1 = first out, sits leftmost). Mirrors placeFinished's
   * coast-then-emote shape but lays the field along the infield's X axis instead
   * of scattering it. Emotion branches on the death-match flavour:
   *   • 'first' (선두탈락) → being out is GOOD: 'celebrate' pose + sparkle/heart.
   *   • 'last'  (꼴찌탈락) → being out is a BUMMER: 'dejected' pose + sweat.
   * Display-only — positions key off (frame - eliminatedAt) + eliminationOrder so
   * the tableau is reproducible and never feeds back into the simulation.
   */
  function placeEliminated(
    r: RacerState,
    v: RacerView,
    elimTotal: number,
    frameIdx: number,
    posById: Map<string, Pos>,
  ): void {
    const mode = config!.elimination === 'first' ? 'first' : 'last';
    const order = r.eliminationOrder ?? 1; // 1-based; 1 = first out
    const geo = track.geo;
    // Where it was when knocked out: the live track point at its last spot. The
    // body slides IN from there to its centre slot (slide-in feel).
    const cross = track.place(r.progress, config!.trackLength, r.lane);

    // Centre horizontal row: fan the eliminated across the infield's X span,
    // ordered by eliminationOrder (1 = leftmost). Width grows with how many are
    // out but stays clear of the curves. Two staggered Y rows so a long row of
    // knocked-out racers doesn't fully overlap.
    const slots = Math.max(1, elimTotal);
    const rowSpan = Math.min(geo.straightHalf * 1.5, slots * 86);
    const frac = slots > 1 ? (order - 1) / (slots - 1) : 0.5; // 0..1 across the row
    const targetX = geo.cx - rowSpan / 2 + frac * rowSpan;
    const targetY = geo.cy - 8 + (order % 2) * 22; // gentle two-row stagger about centre

    // Coast: ease-out glide from the knock-out spot to the centre slot.
    const secs = Math.max(0, frameIdx - (r.eliminatedAt ?? frameIdx)) / 60;
    const k = easeOutCubic(secs / COAST_SECS);
    const x = cross.x + (targetX - cross.x) * k;
    const y = cross.y + (targetY - cross.y) * k;

    // Perspective scale tracks screen-Y (nearer the front = bigger), like the
    // finished tableau, so the centre cluster sits naturally in depth.
    const depthScale = 0.82 + ((y - (geo.cy - geo.radius)) / (2 * geo.radius)) * 0.36;
    const baseScale = CHAR_SCALE * depthScale * v.size * fieldScale;
    v.character.root.scale.set(baseScale);
    v.character.root.position.set(x, y);
    v.character.root.zIndex = 70000 + y; // above the track, below the live finish crowd

    // Emote only once settled, so the slide-in reads as a glide. first→환호,
    // last→좌절. Keep the feeling held every frame at the centre.
    const settled = k > 0.85;
    const happy = mode === 'first';
    const phase: string = settled ? (happy ? 'celebrate' : 'dejected') : 'finished';
    v.character.update({
      phase,
      speedNorm: happy ? 1 : 0.3,
      clock,
      facing: 0,
      heading: 1,
      reducedMotion,
    });
    v.tag.setPosition(x, y - 66 * depthScale * fieldScale);
    v.tag.root.zIndex = 100000 + y;
    v.glow.visible = false;

    // Held emotion FX at the centre: first→sparkle/heart shower (환호),
    // last→occasional sweat-drop (시무룩). Throttled + deterministic-ish via clock
    // phase + order so it stays sparse; suppressed under reduced motion.
    if (settled && !reducedMotion) {
      const hx = hash01(r.id, 1) * 2 - 1;
      const hy = hash01(r.id, 2) * 2 - 1;
      if (happy) {
        if (Math.sin(clock * 9 + order) > 0.7) fx.sparkle(x + hx * 18, y - 70 + hy * 8, clock);
        if (Math.sin(clock * 5 + order * 1.7) > 0.85) fx.heart(x, y - 78, clock);
      } else if (Math.sin(clock * 3 + order) > 0.9) {
        fx.sweat(x + 14, y - 52, clock);
      }
    }

    // 선두탈락(first) 순위 배지: 먼저 빠질수록 상위라 first 모드의 rank = eliminationOrder
    // (1=가장 먼저 탈락=1등). 중앙 줄에 선 탈락자 머리 위에 "N등" 라벨을 띄운다(왼쪽=1등,
    // eliminationOrder 순으로 이미 정렬됨). settled 후에만 보여 슬라이드인 중엔 안 뜬다.
    // 꼴찌탈락(last)은 배지 없음 — 혹시 모드가 섞여도 last에선 무조건 숨긴다.
    if (happy && settled) {
      if (!v.rankBadge) {
        v.rankBadge = new Text({
          text: `${order}등`,
          style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: '900', fill: 0xffd23f, stroke: { color: 0x6b4a10, width: 4 } },
        });
        v.rankBadge.anchor.set(0.5, 1);
        charLayer.addChild(v.rankBadge);
      }
      v.rankBadge.visible = true;
      v.rankBadge.position.set(x, y - 96 * depthScale * fieldScale); // 이름표(−66) 위로 띄워 겹침 회피
      v.rankBadge.scale.set(depthScale * fieldScale);
      v.rankBadge.zIndex = 110000 + y; // 이름표(100000)보다 위
    } else if (v.rankBadge) {
      v.rankBadge.visible = false; // last 모드 / 슬라이드인 중엔 숨김
    }

    posById.set(r.id, { x, y, heading: 1 });
  }

  // ── Lane-intro (athlete-introduction) reel ──────────────────────────────────
  // Renderer-only spotlight tour over the start line, run BEFORE the race plays.
  // Per-racer beat timing (seconds): a spotlight slide-in, a hold while the racer
  // waves, then move on. introLayer sits above charLayer so the lifted racer + its
  // spotlight draw over the dim shadow. Tweak these two to retune the pacing — the
  // entrance ease, card pop, and dim ramp all key off INTRO_IN. Beat is ~1.35s
  // (a touch leisurely so each racer registers; the skip button covers impatience).
  const INTRO_IN = 0.3; // spotlight/card ease-in for each racer (entrance not too snappy)
  const INTRO_HOLD = 1.05; // hold (racer waves)
  const INTRO_BEAT = INTRO_IN + INTRO_HOLD; // total per racer ≈ 1.35s
  const introLayer = new Container();
  introLayer.sortableChildren = true;
  // Which view is currently lifted into introLayer (so it can be restored to
  // charLayer at the next beat / on cleanup). null between beats / when idle.
  let introLifted: RacerView | null = null;

  /** Move a racer's body + tag back down into the normal char layer. */
  function lowerIntroRacer(): void {
    if (!introLifted) return;
    introLifted.tag.root.visible = false; // hide again until the race reveals all tags
    charLayer.addChild(introLifted.character.root, introLifted.tag.root);
    introLifted = null;
  }

  /** Tear down all intro visuals (idempotent). Does NOT fire onDone. */
  function clearIntroVisuals(): void {
    if (introTick) {
      app.ticker.remove(introTick);
      introTick = null;
    }
    lowerIntroRacer();
    introDim?.destroy();
    introDim = null;
    introSpot?.destroy();
    introSpot = null;
    introBanner?.destroy();
    introBanner = null;
    introLayer.removeFromParent();
    // Re-reveal all racer name tags the reel hid (no-op if it never ran).
    if (introActive) for (const vw of views.values()) vw.tag.root.visible = true;
    introActive = false;
  }

  /**
   * Build the intro info card for the racer being introduced — placed right ABOVE
   * the spotlit animal (not a top-of-screen banner) so name, species, and team
   * read in one spot with no up/down eye travel. Rows (top→bottom):
   *   • name (large)            — the participant's (possibly custom) display name
   *   • "🐧 펭귄" species line   — the animal kind from characterCatalog (so a custom
   *                               name is still grounded to its animal)
   *   • "● {팀}팀" team chip     — team mode only, reusing the shared teamPalette
   *                               (same fill/trim as the leaderboard dot / vest)
   * In individual mode the team chip is omitted. The card anchors at its BOTTOM
   * centre (y=0 = card bottom) so the tick can just sit it above the racer's head.
   */
  function makeIntroCard(name: string, species: string, tint: number, team: (typeof teamPalette)[TeamId] | null): Container {
    const c = new Container();
    const nameText = new Text({
      text: name,
      style: { fontFamily: 'sans-serif', fontSize: 28, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x1f2a1c, width: 6 }, align: 'center' },
    });
    nameText.anchor.set(0.5);
    const speciesText = new Text({
      text: species,
      style: { fontFamily: 'sans-serif', fontSize: 17, fontWeight: '800', fill: 0xfff0c0, stroke: { color: 0x1f2a1c, width: 4 }, align: 'center' },
    });
    speciesText.anchor.set(0.5);

    // Team chip (colour dot + "{팀}팀"), sized first so the card width fits it.
    let chip: Container | null = null;
    let chipW = 0;
    if (team) {
      chip = new Container();
      const chipLabel = new Text({
        text: `${team.label}팀`,
        style: { fontFamily: 'sans-serif', fontSize: 15, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x1f2a1c, width: 4 } },
      });
      chipLabel.anchor.set(0.5);
      const dotR = 6;
      const gap = 7;
      chipW = dotR * 2 + gap + chipLabel.width;
      // Colour dot (team fill) + trim ring for white/black readability — the same
      // fill/trim pair the vest + leaderboard use.
      const dot = new Graphics().circle(0, 0, dotR).fill({ color: hexNum(team.fill) });
      dot.stroke({ color: hexNum(team.trim), width: 2 });
      dot.position.set(-chipW / 2 + dotR, 0);
      chipLabel.position.set(-chipW / 2 + dotR * 2 + gap + chipLabel.width / 2, 0);
      chip.addChild(dot, chipLabel);
    }

    const w = Math.max(nameText.width, speciesText.width, chipW) + 36;
    const h = (chip ? 78 : 58);
    // Bottom-anchored card: top at -h, bottom at 0 (sits above the racer's head).
    const bg = new Graphics().roundRect(-w / 2, -h, w, h, 14).fill({ color: tint, alpha: 0.92 });
    bg.stroke({ color: team ? hexNum(team.fill) : 0xffffff, width: team ? 5 : 3 });
    c.addChild(bg);

    // Stack the rows from the top of the card down.
    let y = -h + 22;
    nameText.position.set(0, y);
    c.addChild(nameText);
    y += 23;
    speciesText.position.set(0, y);
    c.addChild(speciesText);
    if (chip) {
      y += 21;
      chip.position.set(0, y);
      c.addChild(chip);
    }
    return c;
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
      app.stage.addChild(iceLayer, boxLayer, decoyLayer, charLayer, bubbles.root, fx.root, commentary.root);
      commentary.root.position.set(width / 2, height - 40);
    },

    buildScene(cfg, opts) {
      config = cfg;
      theme = resolveTheme(opts?.arenaId, cfg.seed);
      clearIntroVisuals(); // drop any stale intro reel before rebuilding the field
      introDone = null;
      clearPodium();
      for (const v of views.values()) v.character.destroy();
      views.clear();
      prevScreenPos.clear();
      curScreenPos = new Map();
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
      for (const dv of decoyViews.values()) dv.char.destroy();
      decoyViews.clear();
      decoyLayer.removeChildren();
      decoyLayer.visible = true;
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
      crowdEase = crowding(fieldSize);

      // Readability dampers, only biting as the field crowds (crowdEase>0):
      //  • Head-bubble cap: ∞ in a small field → ~4 newest fully crowded, so a
      //    burst of activations can't stack into an unreadable wall of bubbles.
      //  • FX intensity: scale transient-particle alpha down (1 → ~0.45) so 16
      //    overlapping sparkle/glow bursts don't sum into one white blob.
      bubbles.setMaxConcurrent(crowdEase > 0 ? Math.round(10 - 6 * crowdEase) : Infinity);
      fx.setIntensity(1 - 0.55 * crowdEase);

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
        views.set(p.id, { character, tag, tint, size: char.renderScale ?? 1, glow, glowUntil: 0, diveAt: -1, diveTargetId: null, reelFrom: null, reelStart: 0, rankBadge: null, relayWalkStart: null, relayWalkTarget: null, relayReturnStart: null, relayReturnTarget: null, relayWasRunning: false });
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
      if (survivorText) survivorText.destroy();
      survivorText = null;
      lastLapTriggered = false;
      if (banner) {
        banner.destroy();
        banner = null;
      }
      if (lanePopup) {
        lanePopup.destroy();
        lanePopup = null;
      }
      laneChangeShown = false;
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
      // Death-match: a "남은 N명" survivor counter just under the lap counter.
      if (cfg.elimination) {
        survivorText = new Text({
          text: `💀 남은 ${cfg.participants.length}명`,
          style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: '800', fill: 0xffe08a, stroke: { color: 0x1f2a1c, width: 4 } },
        });
        survivorText.anchor.set(0.5, 0);
        survivorText.position.set(width / 2, lapText ? 38 : 10);
        app.stage.addChild(survivorText);
      }
    },

    renderFrame(frame) {
      if (!config) return;
      const dt = lastTime ? (frame.time - lastTime) / 1000 : 1 / 60;
      lastTime = frame.time;
      clock += dt;
      curFrameIdx = frame.frame;
      curDecoys = frame.decoys;
      // Roll last frame's body positions into prevScreenPos (lagging one frame) so
      // an abduct:hit this frame can read the target's pre-yank screen spot.
      prevScreenPos.clear();
      for (const [id, p] of curScreenPos) prevScreenPos.set(id, p);
      curScreenPos.clear();
      // Refresh star-invincibility windows so playEvent can branch deflected hits
      // into a "star shield" and the loop below can shimmer active star racers.
      starUntilById.clear();
      for (const r of frame.racers) {
        const su = r.skill.starUntil;
        if (su !== undefined) starUntilById.set(r.id, su);
      }

      // Spider abduct reel-in: seed the yanked target's tween HERE — before the
      // draw loop — so the reel applies on the hit frame itself (no one-frame
      // demoted-spot flash). The engine has already demoted the target's progress
      // for this frame; prevScreenPos still holds its pre-yank spot. playEvent
      // (later this frame) draws the silk FX from that same reelFrom origin.
      for (const e of frame.events) {
        if (e.type !== 'abduct' || e.variant !== 'hit' || !e.targetId || e.targetId === e.racerId) continue;
        const tv = views.get(e.targetId);
        const from = prevScreenPos.get(e.targetId);
        if (tv && from) {
          tv.reelFrom = { x: from.x, y: from.y };
          tv.reelStart = clock;
        }
      }

      // Relay handoff: temporarily disabled due to stability issues
      // for (const e of frame.events) {
      //   if (e.type !== 'relay' || e.variant !== 'handoff' || !e.targetId) continue;
      //   const finisher = e.racerId;
      //   const fv = views.get(finisher);
      //   if (!fv) continue;
      //   const prevState = prevScreenPos.get(finisher);
      //   if (prevState && !fv.relayReturnStart) {
      //     fv.relayReturnStart = clock;
      //     fv.relayReturnTarget = null;
      //   }
      // }

      const posById = new Map<string, Pos>();
      // Live racer states by id so a diving eagle can read its target's CURRENT
      // track spot each frame (the target keeps moving during the plunge).
      const stateById = new Map<string, RacerState>();
      for (const r of frame.racers) stateById.set(r.id, r);
      // Relay: collect waiting teammates so they queue off-track instead of
      // standing on the racing line. Drawn after the main loop, by team.
      const waiting: RacerState[] = [];
      const fieldCount = frame.racers.length;
      // Team mode (on-track finish): only the WINNING team gets the happy emote
      // (hearts/jump/cheer). The winning team = the team of the best-ranked
      // finisher (rank 1). Other teams still coast + settle but stay neutral.
      // undefined in individual mode (every placement keeps its own emote).
      let winningTeamId: string | undefined;
      // Death-match: how many racers are knocked out so far, to size the centre
      // row (each gets a slot ordered by eliminationOrder). Survivors still race.
      const elimTotal = config.elimination
        ? frame.racers.reduce((n, r) => (r.phase === 'eliminated' ? n + 1 : n), 0)
        : 0;
      if (config.teamMode) {
        let bestRank = Infinity;
        for (const r of frame.racers) {
          if (r.rank !== undefined && r.teamId !== undefined && r.rank < bestRank) {
            bestRank = r.rank;
            winningTeamId = r.teamId;
          }
        }
      }
      for (const r of frame.racers) {
        const v = views.get(r.id);
        if (!v) continue;
        // Relay: collect waiting teammates so they queue off-track (return animation
        // is handled inside the waiting block, not in the main loop).
        if (config.relay && r.phase === 'waiting') {
          waiting.push(r);
          continue;
        }
        // Track running→waiting phase transition for relay return detection.
        if (config.relay && r.phase === 'running') v.relayWasRunning = true;
        // ── Post-finish: coast past the line → free-scatter → emote by rank (#33).
        // Display-only: positions are interpolated by (frame - finishedAt) and a
        // deterministic id-hash, so the tableau is reproducible and never feeds
        // back into the simulation. Relay's WAITING runners are already split off
        // above (line ~1195); a relay ANCHOR that has actually FINISHED must coast
        // off the line too — otherwise the `!config.relay` guard left it frozen on
        // the finish tape (the relay "결승 멈춤" bug). So the only exclusion here is
        // waiting runners, handled above; finished racers (relay or not) all coast.
        if (r.phase === 'finished' && r.finishedAt !== undefined) {
          placeFinished(r, v, fieldCount, frame.frame, posById, winningTeamId);
          continue;
        }
        // ── Death-match knock-out: stage the eliminated in the centre row.
        if (r.phase === 'eliminated') {
          placeEliminated(r, v, elimTotal, frame.frame, posById);
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
        let reeling = false; // true while an abduct reel-in tween is dragging the body
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
        // Spider abduct reel-in (display-only): the engine demoted this racer's
        // progress in one frame, so `tp` (= bodyX/bodyY here) already sits behind
        // the spider. Ease the BODY from its pre-yank spot toward that demoted spot
        // over REEL_SECS so it slides back on the silk instead of teleporting. The
        // engine spot keeps advancing each frame, so we lerp toward the LIVE tp.
        if (v.reelFrom) {
          const t = (clock - v.reelStart) / REEL_SECS;
          if (t >= 1) {
            v.reelFrom = null; // settled onto the engine spot
          } else {
            const e = easeOutCubic(t);
            bodyX = v.reelFrom.x + (bodyX - v.reelFrom.x) * e;
            bodyY = v.reelFrom.y + (bodyY - v.reelFrom.y) * e;
            reeling = true;
          }
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
        // The name tag (and bubbles/FX follow below) ride the BODY while a reel-in
        // drags it, so the label stays glued to the racer as it's pulled back.
        const followX = reeling ? bodyX : tp.x;
        const followY = reeling ? bodyY : tp.y;
        v.tag.setPosition(followX, followY - 66 * tp.scale * fieldScale);
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
          // Dampen the wide amber halo as the field crowds (alpha 1× → ~0.5×, and a
          // slightly tighter radius) so 16 overlapping glows don't wash the screen
          // gold. crowdEase 0 ⇒ identical to the small-field look.
          const glowDim = 1 - 0.5 * crowdEase;
          v.glow.alpha = (0.45 + 0.3 * Math.sin(clock * 16)) * glowDim;
          const s = ((starred ? 1.18 : 1) + 0.12 * Math.sin(clock * 16)) * (1 - 0.2 * crowdEase);
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

        posById.set(r.id, { x: followX, y: followY, heading });
        // Record the body's drawn screen spot for THIS frame; swapped into
        // prevScreenPos next frame so an abduct:hit can read the pre-yank spot.
        curScreenPos.set(r.id, { x: bodyX, y: bodyY });
      }

      // Relay waiting queue: park each team's not-yet-running members in the
      // infield by the start/finish line, stacked next-up first. Vests make it
      // obvious whose turn is coming. They never touch the racing line.
      if (config.relay && waiting.length) {
        // For each team, find the runner who is currently running and near the trigger point.
        // Then identify the next runner (leg + 1) who should walk to the start line.
        const teamNextLegInfo = new Map<string, { currentLeg: number; lane: number }>();
        for (const r of frame.racers) {
          if (r.phase !== 'running' || !r.teamId) continue;
          const u = ((r.progress % config.trackLength) + config.trackLength) % config.trackLength / config.trackLength;
          if (u >= RELAY_WALK_TRIGGER) {
            // This runner is at the trigger point; record their leg and lane.
            const currentLeg = r.leg ?? 0;
            const existing = teamNextLegInfo.get(r.teamId);
            if (!existing || currentLeg > existing.currentLeg) {
              teamNextLegInfo.set(r.teamId, { currentLeg, lane: r.lane });
            }
          }
        }

        const byTeam = new Map<string, RacerState[]>();
        for (const r of waiting) {
          const key = r.teamId ?? r.id;
          const arr = byTeam.get(key) ?? [];
          byTeam.set(key, arr);
          arr.push(r);
        }
        // Sort each team's queue by leg so the next runner sits at the front.
        for (const list of byTeam.values()) list.sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
        
        const teams = [...byTeam.keys()];
        // Waiting position: near the baton exchange line (start/finish line area).
        // Start line is at the LEFT end of the bottom straight (u=0).
        const startX = track.geo.cx - track.geo.straightHalf; // start line x
        // Queue area: BELOW the outer edge of the bottom straight (spectator area, not inner field).
        // Bottom straight center y = cy + radius; outer edge = cy + radius + laneSpan/2.
        const startY = track.geo.cy + track.geo.radius + track.geo.laneSpan * 0.7 + 30;
        const colGap = Math.min(96, (track.geo.straightHalf * 1.6) / Math.max(1, teams.length));
        const x0 = startX - (colGap * (teams.length - 1)) / 2;
        
        // Pre-compute natural positions for each team's waiting runners near exchange line.
        // Each team gets a cluster area; runners are scattered naturally within it.
        const teamPositions = new Map<string, Array<{x: number, y: number}>>();
        for (const teamKey of teams) {
          const col = byTeam.get(teamKey)!;
          const positions: Array<{x: number, y: number}> = [];
          const teamX0 = x0 + teams.indexOf(teamKey) * colGap;
          // Cluster area width for this team (near exchange line).
          const clusterWidth = Math.max(80, colGap * 0.8);
          
          col.forEach((r, ri) => {
            // Natural scatter: pseudo-random offset based on racer id.
            const hash = r.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const xOffset = ((hash % 100) - 50) * (clusterWidth / 50); // ±clusterWidth/2
            const yOffset = (ri * 20) + ((hash % 25) - 12); // slight vertical scatter
            positions.push({
              x: teamX0 + xOffset,
              y: startY + yOffset,
            });
          });
          teamPositions.set(teamKey, positions);
        }
        
        // Find the running racer's lane for each team that has a runner at trigger point.
        const teamRunningLane = new Map<string, number>();
        for (const [teamId, legInfo] of teamNextLegInfo.entries()) {
          const runner = frame.racers.find(r => r.teamId === teamId && r.phase === 'running' && (r.leg ?? 0) === legInfo.currentLeg);
          if (runner) {
            teamRunningLane.set(teamId, runner.lane);
          }
        }

        teams.forEach((teamKey) => {
          const col = byTeam.get(teamKey)!;
          const naturalPositions = teamPositions.get(teamKey)!;
          col.forEach((r, ri) => {
            const v = views.get(r.id);
            if (!v) return;

            // Check if this runner should walk to start line.
            // Trigger when: team has a runner at trigger point AND this runner is the NEXT leg AND not already at start line.
            const isWalking = v.relayWalkStart !== null;
            // Already at start line (completed walk).
            const isAtStartLine = v.relayWalkTarget !== null && v.relayWalkStart !== null;
            
            // Get the current leg of this team's runner at trigger point.
            const legInfo = teamNextLegInfo.get(teamKey);
            const nextLeg = legInfo ? legInfo.currentLeg + 1 : -1;
            const isNextRunner = r.leg === nextLeg; // this runner is the next one to run
            
            let targetX: number, targetY: number, heading: number;
            const queuePos = naturalPositions[ri] || naturalPositions[0];

            // ── State machine ─────────────────────────────────────────────────
            // Return trigger: runner was in `running` last frame, now in `waiting`
            // → they just finished a leg. relayWasRunning is set by the main loop
            // and cleared here — purely per-racer, immune to other teams' events.
            if (v.relayWasRunning && v.relayReturnStart === null) {
              v.relayWasRunning = false;
              v.relayReturnStart = clock;
              v.relayReturnTarget = { x: queuePos.x, y: queuePos.y };
              // For the initial runner (never walked): synthesise a start-line "from"
              // so the return lerps from the line rather than popping to queue.
              if (!v.relayWalkTarget && config) {
                const tp = track.place(0, config.trackLength, r.lane);
                v.relayWalkTarget = { x: tp.x, y: tp.y, heading: 1 };
              }
            }
            // Walk trigger: not moving AND it's this runner's turn.
            if (!isWalking && !isAtStartLine && v.relayReturnStart === null && isNextRunner && legInfo) {
              v.relayWalkStart = clock;
              v.relayWalkTarget = null;
            }

            const isReturning = v.relayReturnStart !== null;

            if (isReturning) {
              // ── Return: lerp from start line back to queue position ──────────
              const retProg = Math.min(1, (clock - v.relayReturnStart!) / RELAY_RETURN_SECS);
              const ease = retProg < 0.5
                ? 2 * retProg * retProg
                : 1 - Math.pow(-2 * retProg + 2, 2) / 2; // easeInOutQuad
              const from = v.relayWalkTarget ?? queuePos;
              const toX = v.relayReturnTarget?.x ?? queuePos.x;
              const toY = v.relayReturnTarget?.y ?? queuePos.y;
              targetX = from.x + (toX - from.x) * ease;
              targetY = from.y + (toY - from.y) * ease;
              heading = -1;
              if (retProg >= 1) {
                v.relayReturnStart = null;
                v.relayReturnTarget = null;
                if (isNextRunner && legInfo) {
                  // Seamless: already needed at start line → start walking from queue.
                  v.relayWalkStart = clock;
                  v.relayWalkTarget = null;
                } else {
                  v.relayWalkStart = null;
                  v.relayWalkTarget = null;
                }
                targetX = toX;
                targetY = toY;
              }
            } else if (isWalking && v.relayWalkStart !== null) {
              // ── Walk to start line ───────────────────────────────────────────
              const walkProgress = Math.min(1, (clock - v.relayWalkStart) / RELAY_WALK_SECS);
              const ease = 1 - Math.pow(1 - walkProgress, 3); // easeOutCubic

              if (!v.relayWalkTarget && config) {
                const targetLane = teamRunningLane.get(teamKey) ?? 0.5;
                const tp = track.place(0, config.trackLength, targetLane);
                v.relayWalkTarget = { x: tp.x, y: tp.y, heading: 1 };
              }

              const target = v.relayWalkTarget!;
              targetX = queuePos.x + (target.x - queuePos.x) * ease;
              targetY = queuePos.y + (target.y - queuePos.y) * ease;
              heading = 1;

              if (walkProgress >= 1) {
                targetX = target.x;
                targetY = target.y;
              }
            } else if (isAtStartLine && v.relayWalkTarget) {
              // ── Waiting at start line for baton ─────────────────────────────
              targetX = v.relayWalkTarget.x;
              targetY = v.relayWalkTarget.y;
              heading = 1;
            } else {
              // ── In queue: cheer bounce ────────────────────────────────────────
              // Staggered sin wave per runner (ri offset) so they don't all bounce in sync.
              const bounce = Math.sin(clock * 2.5 * Math.PI * 2 + ri * 1.7) * 6;
              targetX = queuePos.x;
              targetY = queuePos.y + bounce;
              heading = 1;
            }

            v.character.root.position.set(targetX, targetY);
            v.character.root.zIndex = 50 + ri;
            v.character.root.scale.set(CHAR_SCALE * v.size * fieldScale);
            // After race ends: winning team celebrates, others settle.
            const raceOver = frame.finished;
            const isRelayWinner = raceOver && winningTeamId !== undefined && r.teamId === winningTeamId;
            const waitPhase = isWalking || isReturning ? 'running' : raceOver ? (isRelayWinner ? 'celebrate' : 'dejected') : 'waiting';
            v.character.update({
              phase: waitPhase,
              speedNorm: isWalking || isReturning ? 0.1 : (raceOver && isRelayWinner) ? 1 : 0.5,
              clock,
              facing: 0,
              heading,
              reducedMotion,
            });
            v.glow.visible = false;
            v.tag.setPosition(targetX, targetY - 40);
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
      // Gumiho decoys: drawn AFTER the racers (so posById holds the owner's spot)
      // and BEFORE the event loop (so a clone/teleport poof can land on a decoy's
      // freshly-placed spot). Adds each live decoy's screen spot to posById.
      drawDecoys(frame.decoys, posById);

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
        // 🛸 Alien mimic SCAN marker (type 'mimic', actor = alien, targetId = the
        // racer being copied): announce the copy — "외계인이 OO의 △△ 스캔·복제!" — by
        // deriving the copied skill from targetId → characterId → catalog.skill.type.
        // The copied skill's own follow-up events surface their hit/dodge lines below
        // (they show the real effect), so this just adds the "따라하기" flavour.
        const mimicCopy = e.type === 'mimic' && e.variant === 'activate' && !!e.targetId;
        const copiedType = mimicCopy ? characterCatalog[charIdById.get(e.targetId!) ?? '']?.skill.type : undefined;
        // Pass the target name for "{n} did it to {t}" lines. Self-botch uses {n}
        // only, so don't feed it the (self) target name; undefined → '상대' fallback.
        const targetName = !selfBotch && e.targetId ? namesById[e.targetId] : undefined;
        // 하단 자막도 머리 위 버블과 같은 갈래로: 고양이가 회피한 dodge면 냥펀치/캣워크
        // 톤으로 오버라이드(그 외는 기존 generic dodge 라인 유지). 렌더러 전용.
        const catDodge = e.variant === 'dodge' && !!e.targetId && charIdById.get(e.targetId) === 'cat';
        // 💀 데스매치 탈락 자막: 선두탈락(first)이면 약올림, 꼴찌탈락(last)이면 안쓰러움 톤.
        const elimOut = e.type === 'eliminate' && e.variant === 'out';
        const line = elimOut
          ? eliminationLine(config.elimination === 'first' ? 'first' : 'last', n, frame.frame)
          : mimicCopy
          ? mimicLine(n, namesById[e.targetId!] ?? '', copiedType ?? '', frame.frame)
          : catDodge
          ? catDodgeLine(e.type, n, namesById[e.targetId!] ?? '상대', frame.frame)
          : eventLine(e.type, variant, n, frame.frame + (e.targetId ? 7 : 0), targetName);
        if (line) {
          // An event always "claims" the bar this frame (so lead-change defers to
          // it), even when CommentaryBar's rate-limit holds the actual swap so a
          // packed field doesn't flicker the caption faster than it can be read.
          // A death-match knock-out is a once-per-lap headline beat, so FORCE it
          // past the hold (it can't flicker at that low cadence) — otherwise a
          // skill line said <1.4s earlier would swallow "선두 탈락!"/"꼴찌 탈락!".
          commentary.say(line, clock, elimOut);
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

      // Death-match survivor count: total minus the knocked-out (elimTotal above).
      if (survivorText) {
        survivorText.text = `💀 남은 ${Math.max(1, fieldCount - elimTotal)}명`;
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

      // Lane-change popup: fires once per race when the leader (leg=0) crosses
      // the opening straight. Short pill-shaped badge in the centre of the track.
      if (!laneChangeShown && config) {
        const threshold = FINISH_OFFSET_FRAC * config.trackLength;
        const leaderInOpening = frame.racers.find(
          (r) => r.phase === 'running' && (r.leg ?? 0) === 0 && r.progress >= threshold,
        );
        if (leaderInOpening) triggerLaneChange();
      }
      if (lanePopup) {
        const age = clock - lanePopupBornAt;
        if (age > 1.6) {
          lanePopup.destroy();
          lanePopup = null;
        } else {
          const pop = Math.min(1, age * 8);
          lanePopup.scale.set(0.7 + pop * 0.3);
          lanePopup.alpha = age < 1.0 ? 1 : Math.max(0, 1 - (age - 1.0) / 0.6);
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
      if (survivorText) survivorText.visible = false;
      if (banner) {
        banner.destroy();
        banner = null;
      }
      boxLayer.visible = false;
      iceLayer.visible = false;
      decoyLayer.visible = false;
      commentary.hide();
      fx.root.visible = false;
      bubbles.root.visible = false;

      podiumScene = new Container();
      const baseY = height * 0.66;
      podiumScene.addChild(new Graphics().rect(0, 0, width, height).fill(0x4aa3e0));
      podiumScene.addChild(new Graphics().rect(0, baseY, width, height - baseY).fill(0x3f8fd0));
      app.stage.addChildAt(podiumScene, 1); // above track, below characters

      const slotX = [width / 2, width / 2 - 160, width / 2 + 160]; // 1st centre, 2nd left, 3rd right
      const blockH = [150, 108, 80];
      const blockColor = [0xffd23f, 0xc8cbd0, 0xcd8b53];
      const bw = 120;
      const shown = new Set<string>();

      if (config.teamMode) {
        // ── TEAM podium: blocks are TEAMS, ranked by engine team score. ──────────
        // `result.scoring.order` is the authoritative winner-first teamId array for
        // all three team modes (teamRankSum / teamFirstPlace / teamRelay, s24).
        //   • 1·2·3등팀 → blocks 1/2/3 (up to 4 members each, clustered on the block)
        //   • 1등팀만 방방(celebrate); 2·3등팀 서 있음('finished'); 4등팀↓ 단상 밑 좌절.
        // Members of a team are ordered by finish so its best racer leads the cluster.
        const teamOrder = result.scoring.type === 'team' ? result.scoring.order : [];
        const finishRank = new Map<string, number>();
        result.order.forEach((id, i) => finishRank.set(id, i));
        const membersOf = (teamId: string): string[] =>
          config!.participants
            .filter((p) => (p.teamId ?? p.id) === teamId && views.has(p.id))
            .map((p) => p.id)
            .sort((a, b) => (finishRank.get(a) ?? 1e9) - (finishRank.get(b) ?? 1e9));
        const MAX_ON_BLOCK = 4; // crowd cap per block

        teamOrder.forEach((teamId, teamRank) => {
          const allMembers = membersOf(teamId);
          if (!allMembers.length) return;

          if (teamRank < 3) {
            // On a podium block. 1 등팀 깝친다, 2·3 등팀 중립. Up to MAX_ON_BLOCK stand
            // on the block; any overflow (a big team) clusters on the GROUND in
            // front of the block in the SAME pose (winning team still celebrates).
            const onBlock = allMembers.slice(0, MAX_ON_BLOCK);
            const overflow = allMembers.slice(MAX_ON_BLOCK);
            const x = slotX[teamRank];
            const h = blockH[teamRank];
            // Scale block width to team size (wider for bigger teams).
            const teamSpan = allMembers.length;
            const scaledBw = Math.max(bw, bw + (teamSpan - 1) * 20);
            const block = new Graphics().roundRect(x - scaledBw / 2, baseY - h, scaledBw, h, 8).fill(blockColor[teamRank]);
            block.stroke({ color: 0xffffff, width: 3, alpha: 0.65 });
            const num = new Text({ text: `${teamRank + 1}`, style: { fontSize: 46, fontWeight: '900', fill: 0xffffff } });
            num.anchor.set(0.5);
            num.position.set(x, baseY - h / 2);
            podiumScene!.addChild(block, num);
            // Widen the number text anchor area to match the block.
            num.scale.set(scaledBw / bw, 1);

            const phase = teamRank === 0 ? 'celebrate' : 'finished';
            // Fan the on-block members across the block top in a tidy huddle.
            onBlock.forEach((id, i) => {
              const v = views.get(id);
              if (!v) return;
              const span = onBlock.length;
              const t = span > 1 ? i / (span - 1) - 0.5 : 0; // -0.5..0.5
              const px = x + t * Math.min(scaledBw * 0.62, 26 + span * 14);
              const py = baseY - h - 14 + (i % 2) * 12; // slight stagger so they don't fully overlap
              v.character.root.visible = true;
              v.character.root.position.set(px, py);
              v.character.root.scale.set((teamRank === 0 ? 0.72 : 0.6) * v.size);
              v.character.root.zIndex = 1000 + (3 - teamRank) * 10 + i;
              // Show all team members' names on the podium.
              v.tag.root.visible = true;
              v.tag.setPosition(px, py - 78);
              v.tag.root.zIndex = 200000 + i;
              podiumChars.push({ char: v.character, winner: teamRank === 0, phase });
              shown.add(id);
            });
            // Overflow members huddle on the ground hugging the block's base, in
            // the same pose as the team (winning team keeps celebrating).
            overflow.forEach((id, i) => {
              const v = views.get(id);
              if (!v) return;
              const span = overflow.length;
              const t = span > 1 ? i / (span - 1) - 0.5 : 0;
              const px = x + t * Math.min(scaledBw * 0.92, 30 + span * 16);
              const py = baseY + 30 + (i % 2) * 16; // just in front of the block, on the field
              v.character.root.visible = true;
              v.character.root.position.set(px, py);
              v.character.root.scale.set(0.54 * v.size);
              v.character.root.zIndex = 900 + (3 - teamRank) * 10 + i; // in front of the block face
              v.tag.root.visible = true;
              v.tag.setPosition(px, py - 68);
              v.tag.root.zIndex = 200000 + i;
              podiumChars.push({ char: v.character, winner: false, phase });
              shown.add(id);
            });
          } else {
            // 4 등팀 이하: no block — the whole team slumps below the podium, dejected
            // (show all members with names so everyone is recognized).
            const members = allMembers;
            const span = members.length;
            const teamSlot = teamRank - 3; // 0,1,... among the also-rans
            const baseX = width / 2 + (teamSlot - 0.5) * 240; // spread also-ran teams along the front
            members.forEach((id, i) => {
              const v = views.get(id);
              if (!v) return;
              const t = span > 1 ? i / (span - 1) - 0.5 : 0;
              const px = baseX + t * Math.min(120, 50 + span * 20);
              const py = baseY + 56 + (i % 2) * 16; // on the field, below the blocks
              v.character.root.visible = true;
              v.character.root.position.set(px, py);
              v.character.root.scale.set(0.52 * v.size);
              v.character.root.zIndex = 800 + i;
              v.tag.root.visible = true;
              v.tag.setPosition(px, py - 68);
              v.tag.root.zIndex = 200000 + i;
              podiumChars.push({ char: v.character, winner: false, phase: 'dejected' });
              shown.add(id);
            });
          }
        });
      } else {
        // ── INDIVIDUAL podium (unchanged): top-3 racers, all celebrate. ──────────
        const top = result.order.slice(0, Math.min(3, result.order.length));
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
          podiumChars.push({ char: v.character, winner: rank === 0, phase: 'celebrate' });
          shown.add(id);
        });
      }

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
          // 1등팀 깝친다 (celebrate); 2·3등팀 중립 'finished'; 4등팀↓ 'dejected' 좌절.
          pc.char.update({
            phase: pc.phase,
            speedNorm: pc.phase === 'celebrate' ? (pc.winner ? 1 : 0.7) : 0.4,
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

    playLaneIntro(onDone) {
      // Restart cleanly if called while one is already running.
      if (introActive) clearIntroVisuals();
      introActive = true;
      introDone = onDone;

      // Intro order: slot order by default. In TEAM mode, group teammates so each
      // team is introduced back-to-back (team appearance order; slot order kept
      // WITHIN a team) — a stable group sort, so it only reorders, never drops/
      // dupes. Individual mode is untouched (plain slot order). Renderer-only.
      const slotOrder = config ? config.participants.filter((p) => views.has(p.id)) : [];
      let order: string[];
      if (config?.teamMode) {
        const teamRank = new Map<string, number>(); // teamId → first-appearance index
        for (const p of slotOrder) {
          const key = p.teamId ?? p.id;
          if (!teamRank.has(key)) teamRank.set(key, teamRank.size);
        }
        order = slotOrder
          .map((p, i) => ({ id: p.id, rank: teamRank.get(p.teamId ?? p.id)!, i }))
          .sort((a, b) => a.rank - b.rank || a.i - b.i) // group by team, slot order within
          .map((e) => e.id);
      } else {
        order = slotOrder.map((p) => p.id);
      }
      // Nothing to introduce (no scene / empty field) → just signal completion.
      if (!order.length) {
        introActive = false;
        const cb = introDone;
        introDone = null;
        cb?.();
        return;
      }

      // Reduced motion: skip the theatrics, fire onDone next tick so the caller's
      // flow stays async-consistent (no spotlight reel under reduced motion).
      if (reducedMotion) {
        const cb = introDone;
        introDone = null;
        introActive = false;
        queueMicrotask(() => cb?.());
        return;
      }

      // Full-screen shadow + the spotlight live in their own layer above the
      // racers (so the lifted racer + spotlight draw over the dim).
      app.stage.addChild(introLayer);
      introLayer.zIndex = 5; // above charLayer/fx, below commentary added later
      introDim = new Graphics().rect(0, 0, width, height).fill({ color: 0x0a0e16, alpha: 1 });
      introDim.alpha = 0; // ramps up via introDim.alpha in the tick
      introSpot = new Graphics();
      introSpot.zIndex = 1; // under the lifted racer (added at higher z below)
      introLayer.addChildAt(introDim, 0);
      introLayer.addChild(introSpot);
      // Hide every racer's small name tag for the reel — they all start stacked on
      // the same spot, so their tags would bleed through the spotlight. Each
      // racer's tag is revealed only while it is the one under the light (and the
      // big banner names it anyway). Restored on cleanup so the race shows them.
      for (const vw of views.values()) vw.tag.root.visible = false;

      let idx = -1; // current racer index; -1 → not started (forces first setup)
      let beat = 0; // seconds into the current racer's beat
      const DIM_ALPHA = 0.62;

      const startBeat = (i: number): void => {
        lowerIntroRacer();
        const id = order[i];
        const v = views.get(id);
        if (!v) return;
        introLifted = v;
        // Lift this racer above the dim. The small name tag stays hidden — the
        // info card (built below) names the racer right above its head, so the
        // tag would just overlap it.
        introLayer.addChild(v.character.root);
        v.character.root.zIndex = 10;
        v.glow.visible = false;
        // Fresh info card for this racer: name + "🐧 펭귄" species + (team mode)
        // team chip. Positioned above the racer's head each tick (not top-centre)
        // so everything reads in one spot. Team accent reuses the shared teamPalette.
        introBanner?.destroy();
        const teamId = config?.participants.find((p) => p.id === id)?.teamId;
        const team = isTeamId(teamId) ? teamPalette[teamId] : null;
        introBanner = makeIntroCard(namesById[id] ?? id, speciesLabel(charIdById.get(id) ?? id), v.tint, team);
        introBanner.zIndex = 11;
        introLayer.addChild(introBanner);
      };

      introTick = (ticker) => {
        const step = ticker.deltaMS / 1000;
        // First tick: open with the very first racer.
        if (idx < 0) {
          idx = 0;
          beat = 0;
          startBeat(0);
        } else {
          beat += step;
          if (beat >= INTRO_BEAT) {
            idx++;
            beat = 0;
            if (idx >= order.length) {
              // Done — tear down and fire onDone exactly once.
              const cb = introDone;
              introDone = null;
              clearIntroVisuals();
              cb?.();
              return;
            }
            startBeat(idx);
          }
        }

        const v = introLifted;
        if (!v || !introSpot || !introDim) return;
        // Spotlight follows the racer's start-line screen spot (set by the shell's
        // frame-0 render, held in character.root.position).
        const px = v.character.root.position.x;
        const py = v.character.root.position.y;
        const easeIn = Math.min(1, beat / INTRO_IN); // 0→1 over the slide-in

        // Dim ramps up on the first racer, then stays down for the rest.
        introDim.alpha = idx === 0 ? DIM_ALPHA * easeIn : DIM_ALPHA;

        // Spotlight: a bright soft cone of light pooled on the racer. Pops in with
        // the beat, then holds with a gentle breathing pulse.
        const pulse = 1 + Math.sin(beat * 6) * 0.03;
        const rad = (132 + 18 * Math.sin(beat * 4)) * easeIn * pulse;
        introSpot.clear();
        introSpot.circle(px, py + 6, rad * 1.06).fill({ color: 0xfff4c2, alpha: 0.18 * easeIn });
        introSpot.circle(px, py + 6, rad).fill({ color: 0xfff8d8, alpha: 0.3 * easeIn });
        introSpot.circle(px, py + 6, rad * 0.6).fill({ color: 0xffffff, alpha: 0.34 * easeIn });
        introSpot.blendMode = 'add';

        // Info card sits just above the racer's head (bottom-anchored), popping in
        // with a scale overshoot. Riding the racer keeps name+species+team in one
        // spot so the eye doesn't dart to the top of the screen.
        if (introBanner) {
          const pop = Math.min(1, beat / INTRO_IN);
          introBanner.position.set(px, py - 84);
          introBanner.scale.set(0.7 + 0.3 * pop + Math.sin(beat * 10) * 0.02 * (1 - pop));
          introBanner.alpha = pop;
        }
        v.character.greet(beat, easeIn);
      };
      app.ticker.add(introTick);
    },

    skipLaneIntro() {
      const cb = introDone;
      introDone = null;
      clearIntroVisuals();
      cb?.();
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
      if (survivorText) survivorText.position.set(width / 2, lapText ? 38 : 10);
    },

    destroy() {
      clearIntroVisuals();
      introDone = null;
      clearPodium();
      for (const v of views.values()) v.character.destroy();
      views.clear();
      for (const dv of decoyViews.values()) dv.char.destroy();
      decoyViews.clear();
      app.destroy(true, { children: true });
    },
  };

  return renderer;
}
