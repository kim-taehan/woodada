import './shell/styles.css';
import { App } from './shell/App.ts';
import { characterCatalog } from './data/characters/index.ts';
import { createRaceRenderer } from './renderer/RaceRenderer.ts';
import { RaceController } from './shell/RaceController.ts';
import { simulateRace } from './engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from './engine/skills/index.ts';
import { createDefaultScoringRegistry } from './engine/scoring/index.ts';
import type { RaceConfig } from './engine/types.ts';
import { TEAM_SCORING_TO_ID } from './data/schema.ts';
import { el } from './shell/dom.ts';

const root = document.getElementById('app')!;
const app = new App(root);
app.start();

// ---- Deterministic hooks for Playwright visual verification (spec §13) ----
const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

function configFor(
  characterIds: string[],
  seed: number,
  laps = 1,
  teamIds?: string[],
  relay = false,
  elimination?: 'first' | 'last',
): RaceConfig {
  const team = relay || (teamIds?.some(Boolean) ?? false);
  return {
    participants: characterIds.map((cid, i) => ({
      id: `p${i}`,
      name: `${characterCatalog[cid].name}${i + 1}`,
      characterId: cid,
      teamId: teamIds?.[i],
    })),
    characters: characterCatalog,
    seed,
    laps,
    trackLength: 1000,
    modeId: team ? 'team' : 'individual',
    // Team flavor mirrors the shell path; this capture hook only distinguishes
    // relay vs rank-sum, so derive the flavor from `relay`.
    scoringId: team ? TEAM_SCORING_TO_ID[relay ? 'relay' : 'rankSum'] : 'individual',
    teamMode: team,
    relay,
    // Death-match (개인전): 'first'|'last' eliminations; omitted = classic race.
    elimination,
  };
}

interface CaptureOpts {
  characterIds?: string[];
  seed?: number;
  laps?: number;
  reducedMotion?: boolean;
  /** Per-participant team ids (for team-vest visual capture). */
  teamIds?: string[];
  /** Relay (이어달리기) mode (waiting queue, baton hand-off, leg counter). */
  relay?: boolean;
  /**
   * Death-match (개인전 탈락전): 'first' = 선두탈락, 'last' = 꼴찌탈락. Omitted =
   * classic race. Lets the renderer's center-pile / elimination FX be captured.
   */
  elimination?: 'first' | 'last';
  /**
   * Capture-only: after seeking to the end, advance the renderer's post-finish
   * coast/scatter/emote clock by this many frames (engine untouched) so the
   * settled celebration tableau (#33) can be shot. Ignored mid-race.
   */
  settleFrames?: number;
  /**
   * Arena theme id for the capture (feat/arenas). DEFAULTS TO 'grassland' for
   * the capture hook so the existing character/FX golden shots stay on the
   * classic look (no theme drift) unless a showcase shot explicitly asks for a
   * different arena. The live game defaults to 'random' (store), not here.
   */
  arenaId?: string;
}

const DEFAULT_IDS = ['penguin', 'dog', 'cat', 'monkey', 'bear', 'hedgehog', 'spider', 'alien', 'fox'];

const hooks = {
  /** Headless: first frame index of each `${type}:${variant}` event + total frames. */
  simulate(opts: CaptureOpts = {}) {
    const laps = opts.laps ?? 1;
    const cfg = configFor(opts.characterIds ?? DEFAULT_IDS, opts.seed ?? 7, laps, opts.teamIds, opts.relay ?? false, opts.elimination);
    const { frames, result } = simulateRace(cfg, skills, scoring);
    const eventFrames: Record<string, number> = {};
    let busiestFrame = 0;
    let busiestCount = 0;
    let finalLapFrame = 0;
    // Eagle divebomb self-botch: a 'hit' whose target is the actor (lost gamble).
    // Captured separately so the renderer's distinct self-crash FX can be shot.
    let divebombSelfFrame = -1;
    // First frame a penguin is inside an active icefield zone (belly-slide pose).
    let penguinIceFrame = -1;
    // First frame a cat is hopping clear over an icefield zone (engine-flagged
    // iceJumping → renderer jump pose). Captured for the cat ice-hop proof shot.
    let catJumpFrame = -1;
    const penguinIds = new Set(cfg.participants.filter((p) => p.characterId === 'penguin').map((p) => p.id));
    const catIds = new Set(cfg.participants.filter((p) => p.characterId === 'cat').map((p) => p.id));
    const inAnyZone = (progress: number, zones: { startProgress: number; length: number }[]): boolean => {
      const lapPos = ((progress % cfg.trackLength) + cfg.trackLength) % cfg.trackLength;
      return zones.some((z) => {
        const end = z.startProgress + z.length;
        return end <= cfg.trackLength ? lapPos >= z.startProgress && lapPos < end : lapPos >= z.startProgress || lapPos < end - cfg.trackLength;
      });
    };
    frames.forEach((f) => {
      for (const e of f.events) {
        const key = `${e.type}:${e.variant}`;
        if (!(key in eventFrames)) eventFrames[key] = f.frame;
        if (divebombSelfFrame < 0 && e.type === 'divebomb' && e.variant === 'hit' && e.targetId === e.racerId) {
          divebombSelfFrame = f.frame;
        }
      }
      if (penguinIceFrame < 0 && f.iceZones.length) {
        for (const r of f.racers) {
          if (penguinIds.has(r.id) && r.phase === 'running' && inAnyZone(r.progress, f.iceZones)) {
            penguinIceFrame = f.frame;
            break;
          }
        }
      }
      if (catJumpFrame < 0 && f.iceZones.length) {
        for (const r of f.racers) {
          if (catIds.has(r.id) && r.phase === 'running' && r.skill.iceJumping === true) {
            catJumpFrame = f.frame;
            break;
          }
        }
      }
      if (f.events.length > busiestCount) {
        busiestCount = f.events.length;
        busiestFrame = f.frame;
      }
      if (!finalLapFrame) {
        const maxP = Math.max(...f.racers.map((r) => r.progress));
        if (maxP >= cfg.trackLength * (laps - 1) && laps > 1) finalLapFrame = f.frame;
      }
    });
    return { eventFrames, busiestFrame, busiestCount, finalLapFrame, divebombSelfFrame, penguinIceFrame, catJumpFrame, totalFrames: frames.length, order: result.order };
  },

  /** Build a race and seek instantly to a frame index, then render it. */
  async showRaceAt(frame: number, opts: CaptureOpts = {}) {
    const host = el('div', { class: 'canvas-host' });
    const race = el('div', { class: 'race' }, [host]);
    root.replaceChildren(race);
    const renderer = createRaceRenderer();
    renderer.setReducedMotion(opts.reducedMotion ?? false);
    await renderer.mount(host);
    const cfg = configFor(opts.characterIds ?? DEFAULT_IDS, opts.seed ?? 7, opts.laps ?? 1, opts.teamIds, opts.relay ?? false, opts.elimination);
    // Capture pins the arena (default grassland) so existing golden shots don't
    // drift; showcase shots pass an explicit arenaId. Game default is 'random'.
    const controller = new RaceController(renderer, cfg, opts.arenaId ?? 'grassland');
    controller.seek(frame);
    // Capture-only: develop the post-finish coast/scatter/emote into its settled
    // state (display-only; engine untouched). No-op unless the race has finished.
    if (opts.settleFrames) controller.settle(opts.settleFrames);
    // Let the just-spawned FX develop a few frames (grow rings, dizzy swirl,
    // motion) so the deterministic still actually shows the effect, not its
    // age-0 seed. Display-only; the simulation is untouched.
    renderer.pumpFx(0.18);
  },
};

declare global {
  interface Window {
    __woodada: typeof hooks;
  }
}
window.__woodada = hooks;
