/**
 * Glues the pure engine loop to the renderer via requestAnimationFrame
 * (spec §8). The engine is fixed-timestep and deterministic; the controller
 * just paces it for display and forwards frames. It can also seek instantly to a
 * frame (deterministic screenshots, spec §13).
 */

import { createRaceEngine, type RaceEngine } from '../engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../engine/scoring/index.ts';
import { DT_MS, type RaceConfig, type RaceResult } from '../engine/types.ts';
import type { RaceRenderer } from '../renderer/RaceRenderer.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

const SLOWMO_MS = 650; // wall-clock duration of the skill slow-motion
const SLOWMO_SCALE = 0.3; // playback speed during a skill

export class RaceController {
  private engine: RaceEngine;
  private raf = 0;
  private running = false;
  private coastRaf = 0;

  constructor(private renderer: RaceRenderer, config: RaceConfig) {
    this.engine = createRaceEngine(config, skills, scoring);
    this.renderer.buildScene(config);
    this.renderer.renderFrame(this.engine.current());
  }

  /**
   * Run the race to the finish, animating with real-time pacing. Playback drops
   * to slow-motion for a moment whenever a skill fires, so each skill is easy to
   * read (this only affects display speed, never the deterministic outcome).
   *
   * On finish it resolves with the result but does NOT switch to the podium —
   * the track keeps showing the post-finish coast/scatter/emote (#33) until the
   * caller starts `coast()` and the user taps "시상식 보러가기" (Feature C).
   */
  run(): Promise<RaceResult> {
    this.running = true;
    return new Promise((resolve) => {
      let acc = 0; // accumulated (scaled) ms toward the next engine step
      let last = 0;
      let slowUntil = 0;

      const tick = (ts: number) => {
        if (!this.running) return;
        if (!last) last = ts;
        const realDt = Math.min(ts - last, 100); // clamp big gaps (tab switches)
        last = ts;

        const scale = ts < slowUntil ? SLOWMO_SCALE : 1;
        acc += realDt * scale;

        let frame = this.engine.current();
        let stepped = false;
        while (acc >= DT_MS && !this.engine.finished) {
          frame = this.engine.step();
          acc -= DT_MS;
          stepped = true;
          if (frame.events.some((e) => e.variant === 'activate' || e.variant === 'hit' || e.variant === 'wake')) {
            slowUntil = ts + SLOWMO_MS;
          }
        }

        if (stepped) this.renderer.renderFrame(frame);

        if (this.engine.finished) {
          this.running = false;
          resolve(this.engine.result()!);
          return;
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  /**
   * After the race finishes, keep the track alive by advancing only the
   * renderer's finish-clock (engine untouched) so the coast/scatter/emote (#33)
   * plays out beneath the "시상식 보러가기" button. Loops until `stop()`. This is
   * the live counterpart of the capture-only `settle()`.
   */
  coast(): void {
    if (!this.engine.finished) return;
    const last = this.engine.current();
    let extra = 0;
    const tick = () => {
      extra += 1;
      this.renderer.renderFrame({ ...last, frame: last.frame + extra, events: [] });
      this.coastRaf = requestAnimationFrame(tick);
    };
    this.coastRaf = requestAnimationFrame(tick);
  }

  /** Switch the track to the podium tableau (called on "시상식 보러가기"). */
  showResult(result: RaceResult): void {
    cancelAnimationFrame(this.coastRaf);
    this.coastRaf = 0;
    this.renderer.showResult(result);
  }

  /** Seek instantly to a given frame index and render it (no animation). */
  seek(targetFrame: number): void {
    while (this.engine.frameIndex < targetFrame && !this.engine.finished) {
      const f = this.engine.step();
      this.renderer.renderFrame(f);
    }
  }

  /**
   * Capture-only (spec §13): once the race is over, re-render the final frame
   * `extraFrames` further along by bumping only its frame index, so the renderer's
   * display-only post-finish coast/scatter/emote (#33) develops into its settled
   * tableau for a deterministic still. The engine is NOT stepped — the simulation
   * is already done — this just advances the renderer's finish-clock.
   */
  settle(extraFrames: number): void {
    if (!this.engine.finished) return;
    const last = this.engine.current();
    this.renderer.renderFrame({ ...last, frame: last.frame + extraFrames, events: [] });
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.coastRaf);
    this.coastRaf = 0;
  }
}
