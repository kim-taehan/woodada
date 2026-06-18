import './shell/styles.css';
import { App } from './shell/App.ts';
import { characterCatalog } from './data/characters/index.ts';
import { createRaceRenderer } from './renderer/RaceRenderer.ts';
import { RaceController } from './shell/RaceController.ts';
import { simulateRace } from './engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from './engine/skills/index.ts';
import { createDefaultScoringRegistry } from './engine/scoring/index.ts';
import type { RaceConfig } from './engine/types.ts';
import { el } from './shell/dom.ts';

const root = document.getElementById('app')!;
const app = new App(root);
app.start();

// ---- Deterministic hooks for Playwright visual verification (spec §13) ----
const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

function configFor(characterIds: string[], seed: number, laps = 1, teamIds?: string[], relay = false): RaceConfig {
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
    scoringId: relay ? 'teamRelay' : team ? 'teamRankSum' : 'individual',
    teamMode: team,
    relay,
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
}

const DEFAULT_IDS = ['penguin', 'dog', 'cat', 'monkey', 'eagle', 'bear'];

const hooks = {
  /** Headless: first frame index of each `${type}:${variant}` event + total frames. */
  simulate(opts: CaptureOpts = {}) {
    const laps = opts.laps ?? 1;
    const cfg = configFor(opts.characterIds ?? DEFAULT_IDS, opts.seed ?? 7, laps, opts.teamIds, opts.relay ?? false);
    const { frames, result } = simulateRace(cfg, skills, scoring);
    const eventFrames: Record<string, number> = {};
    let busiestFrame = 0;
    let busiestCount = 0;
    let finalLapFrame = 0;
    frames.forEach((f) => {
      for (const e of f.events) {
        const key = `${e.type}:${e.variant}`;
        if (!(key in eventFrames)) eventFrames[key] = f.frame;
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
    return { eventFrames, busiestFrame, busiestCount, finalLapFrame, totalFrames: frames.length, order: result.order };
  },

  /** Build a race and seek instantly to a frame index, then render it. */
  async showRaceAt(frame: number, opts: CaptureOpts = {}) {
    const host = el('div', { class: 'canvas-host' });
    const race = el('div', { class: 'race' }, [host]);
    root.replaceChildren(race);
    const renderer = createRaceRenderer();
    renderer.setReducedMotion(opts.reducedMotion ?? false);
    await renderer.mount(host);
    const cfg = configFor(opts.characterIds ?? DEFAULT_IDS, opts.seed ?? 7, opts.laps ?? 1, opts.teamIds, opts.relay ?? false);
    const controller = new RaceController(renderer, cfg);
    controller.seek(frame);
  },
};

declare global {
  interface Window {
    __woodada: typeof hooks;
  }
}
window.__woodada = hooks;
