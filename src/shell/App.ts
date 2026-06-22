/**
 * Screen state machine (spec §0): setup → countdown → race → result. Keeps the
 * default path friction-free and wires the renderer + controller to the store.
 */

import { clear, el } from './dom.ts';
import { RoomStore } from './store.ts';
import { buildSetupScreen } from './screens/SetupScreen.ts';
import { buildResultScreen } from './screens/ResultScreen.ts';
import { recordOutcome } from './records.ts';
import { RaceController } from './RaceController.ts';
import { createRaceRenderer, type RaceRenderer } from '../renderer/RaceRenderer.ts';
import type { RaceConfig, RaceResult } from '../engine/types.ts';

/**
 * Lane-intro seam (athletics-style "who's in each lane" walk-on before GO).
 * The renderer (introfx) owns the Pixi spotlight animation; the shell only
 * inserts the step + skip button. These methods live on the renderer impl but
 * not on the RaceRenderer interface (that file is owned elsewhere), so the
 * shell reads them through this optional view and falls straight through to the
 * countdown if they're absent.
 */
type LaneIntroRenderer = {
  playLaneIntro?(onDone: () => void): void;
  skipLaneIntro?(): void;
};

export class App {
  readonly store = new RoomStore();
  private renderer: RaceRenderer | null = null;
  private controller: RaceController | null = null;
  private reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private root: HTMLElement) {}

  start(): void {
    // First launch opens with a ready-to-go roster (spec §0); no-op once the
    // user has added/cleared anyone, so this never overwrites their state.
    this.store.seedDefaults();
    this.showSetup();
  }

  private showSetup(): void {
    this.teardownRace();
    clear(this.root);
    this.root.append(buildSetupScreen(this.store, () => void this.startRace()));
  }

  private async startRace(seed?: number): Promise<void> {
    this.teardownRace();
    if (seed === undefined) this.store.newSeed();
    else this.store.seed = seed;

    const host = el('div', { class: 'canvas-host' });
    const countdown = el('div', { class: 'countdown' });
    const skip = el('button', { class: 'skip', textContent: '건너뛰기' });
    const race = el('div', { class: 'race' }, [host, countdown, skip]);
    clear(this.root);
    this.root.append(race);

    this.renderer = createRaceRenderer();
    this.renderer.setReducedMotion(this.reducedMotion);
    await this.renderer.mount(host);
    window.addEventListener('resize', this.onResize);

    const config = this.store.buildRaceConfig();
    // Constructing the controller builds the scene + renders frame 0, so the
    // starting-line tableau is on screen before anything else runs.
    this.controller = new RaceController(this.renderer, config, this.store.arenaId);

    // Athletics-style lane intro over the (now visible) starting line, then the
    // countdown. Skipped under reduced-motion to match the countdown's behavior.
    await this.runLaneIntro(race);

    await this.runCountdown(countdown, skip);
    countdown.remove();
    skip.remove();

    const result = await this.controller.run();
    // Don't jump to the podium: let the track keep showing the finish coast/
    // scatter/emote (#33) and offer a big "시상식 보러가기" button (Feature C).
    this.controller.coast();
    this.showFinishGate(race, config, result);
  }

  /**
   * Center overlay shown the moment the race ends. The track keeps animating
   * underneath (controller.coast()); tapping the button switches to the podium
   * + result card.
   */
  private showFinishGate(race: HTMLElement, config: RaceConfig, result: RaceResult): void {
    const btn = el('button', { class: 'podium-gate', textContent: '🏆 시상식 보러가기' });
    const gate = el('div', { class: 'finish-gate' }, [btn]);
    btn.addEventListener('click', () => {
      gate.remove();
      this.controller?.showResult(result);
      this.showResult(race, config, result);
    });
    race.append(gate);
  }

  /**
   * Athletics-style lane introduction: the renderer spotlights each lane's
   * racer in turn over the starting-line scene; meanwhile the shell shows a
   * "건너뛰기 ⏭" overlay. Resolves when the intro finishes or is skipped — a
   * single `done` guard ensures we advance to the countdown exactly once even
   * if both the renderer's onDone and a skip click land. No-op (resolves at
   * once) under reduced-motion or if the renderer lacks the intro seam.
   */
  private runLaneIntro(race: HTMLElement): Promise<void> {
    const renderer = this.renderer as (RaceRenderer & LaneIntroRenderer) | null;
    const playLaneIntro = renderer?.playLaneIntro;
    if (this.reducedMotion || !playLaneIntro) return Promise.resolve();

    return new Promise((resolve) => {
      const intro = el('button', { class: 'skip intro-skip', textContent: '건너뛰기 ⏭' });
      race.append(intro);

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        intro.remove();
        resolve();
      };
      // onDone runs when the intro plays out naturally; skip cleans up the
      // renderer's intro (idempotent) and also routes through `finish`.
      playLaneIntro.call(renderer, finish);
      intro.addEventListener('click', () => {
        renderer.skipLaneIntro?.();
        finish();
      });
    });
  }

  private runCountdown(host: HTMLElement, skip: HTMLButtonElement): Promise<void> {
    if (this.reducedMotion) {
      host.textContent = '';
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let n = 3;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        resolve();
      };
      host.textContent = String(n);
      const timer = setInterval(() => {
        n -= 1;
        host.textContent = n > 0 ? String(n) : 'GO!';
        if (n < 0) finish();
      }, 650);
      skip.addEventListener('click', finish);
    });
  }

  private showResult(race: HTMLElement, config: RaceConfig, result: RaceResult): void {
    // Compare + persist the per-mode best time (Feature B). Done once here, on
    // the transition to the podium, so a new record is recorded exactly once.
    const record = recordOutcome(config, result);
    const overlay = buildResultScreen(
      result,
      config,
      this.store.resultMapping,
      record,
      () => {
        overlay.remove();
        void this.startRace();
      },
      () => {
        // Keep roster + settings so the next round needs no re-setup; the setup
        // screen's reset button clears them on demand.
        this.showSetup();
      },
    );
    race.append(overlay);
  }

  private onResize = (): void => {
    if (!this.renderer) return;
    this.renderer.resize(this.root.clientWidth, this.root.clientHeight);
  };

  private teardownRace(): void {
    window.removeEventListener('resize', this.onResize);
    this.controller?.stop();
    this.controller = null;
    this.renderer?.destroy();
    this.renderer = null;
  }
}
