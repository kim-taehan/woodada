/**
 * Lane-intro ("athlete introduction") reel: a renderer-only spotlight tour over
 * the start-line scene shown BEFORE the race plays. Dims the field, then lifts
 * each racer in turn (participants order = start slots) under a spotlight with a
 * popped name banner + a wave, ~0.8s each. Built once per RaceRenderer instance
 * via `createLaneIntro`; `play`/`skip` are called repeatedly across races (unlike
 * PodiumScene, which is rebuilt per result). Pure display — never touches the
 * simulation; the caller (shell) must already have laid the frame-0 start scene.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import type { RaceConfig } from '../../engine/types.ts';
import type { RacerView } from '../RaceRenderer.ts';
import { teamPalette, type TeamId } from '../../data/teams.ts';
import { speciesLabel, isTeamId, hexNum, laneIntroOrder } from '../renderUtils.ts';

export interface LaneIntroDeps {
  app: Application;
  charLayer: Container;
  views: Map<string, RacerView>;
  charIdById: Map<string, string>;
  getConfig: () => RaceConfig | null;
  getNamesById: () => Record<string, string>;
  getWidth: () => number;
  getHeight: () => number;
  isReducedMotion: () => boolean;
}

export interface LaneIntroHandle {
  /**
   * Play the reel, calling `onDone` once the last racer is introduced and the
   * dim/spotlight are cleared. Restarts cleanly if called while already running.
   */
  play(onDone: () => void): void;
  /** Immediately tear down an in-progress reel and fire `onDone` if pending. */
  skip(): void;
  /** Tear down any intro visuals without firing `onDone` (idempotent). */
  clear(): void;
}

// Per-racer beat timing (seconds): a spotlight slide-in, a hold while the racer
// waves, then move on. introLayer sits above charLayer so the lifted racer + its
// spotlight draw over the dim shadow. Tweak these two to retune the pacing — the
// entrance ease, card pop, and dim ramp all key off INTRO_IN. Beat is ~1.35s
// (a touch leisurely so each racer registers; the skip button covers impatience).
const INTRO_IN = 0.3; // spotlight/card ease-in for each racer (entrance not too snappy)
const INTRO_HOLD = 1.05; // hold (racer waves)
const INTRO_BEAT = INTRO_IN + INTRO_HOLD; // total per racer ≈ 1.35s

/**
 * Build the lane-intro reel controller. Adds nothing to the stage/ticker until
 * `play()` is called; `clear()` (called from RaceRenderer.buildScene/destroy)
 * tears down any in-progress reel.
 */
export function createLaneIntro(deps: LaneIntroDeps): LaneIntroHandle {
  const { app, charLayer, views, charIdById, getConfig, getNamesById, getWidth, getHeight, isReducedMotion } = deps;

  let introActive = false;
  let introTick: ((ticker: { deltaMS: number }) => void) | null = null;
  let introDone: (() => void) | null = null; // onDone, fired exactly once
  let introDim: Graphics | null = null; // full-screen shadow
  let introSpot: Graphics | null = null; // bright spotlight under the current racer
  let introBanner: Container | null = null; // popped name banner for the current racer
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
  function clear(): void {
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
    introDone = null;
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

  function play(onDone: () => void): void {
    // Restart cleanly if called while one is already running.
    if (introActive) clear();
    introActive = true;
    introDone = onDone;

    const config = getConfig();
    // Intro order: slot order by default. In TEAM mode, group teammates so each
    // team is introduced back-to-back (team appearance order; slot order kept
    // WITHIN a team) — a stable group sort, so it only reorders, never drops/
    // dupes. Individual mode is untouched (plain slot order). Renderer-only.
    const order = laneIntroOrder(config ? config.participants : [], (id) => views.has(id), config?.teamMode ?? false);
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
    if (isReducedMotion()) {
      const cb = introDone;
      introDone = null;
      introActive = false;
      queueMicrotask(() => cb?.());
      return;
    }

    const width = getWidth();
    const height = getHeight();

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
      const namesById = getNamesById();
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
            clear();
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
  }

  function skip(): void {
    const cb = introDone;
    clear();
    cb?.();
  }

  return { play, skip, clear };
}
