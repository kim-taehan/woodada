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

export class App {
  readonly store = new RoomStore();
  private renderer: RaceRenderer | null = null;
  private controller: RaceController | null = null;
  private reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private root: HTMLElement) {}

  start(): void {
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
    this.controller = new RaceController(this.renderer, config);

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
