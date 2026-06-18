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

  constructor(private renderer: RaceRenderer, config: RaceConfig) {
    this.engine = createRaceEngine(config, skills, scoring);
    this.renderer.buildScene(config);
    this.renderer.renderFrame(this.engine.current());
  }

  /**
   * Run the race to the finish, animating with real-time pacing. Playback drops
   * to slow-motion for a moment whenever a skill fires, so each skill is easy to
   * read (this only affects display speed, never the deterministic outcome).
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
          const result = this.engine.result()!;
          this.renderer.showResult(result);
          resolve(result);
          return;
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  /** Seek instantly to a given frame index and render it (no animation). */
  seek(targetFrame: number): void {
    while (this.engine.frameIndex < targetFrame && !this.engine.finished) {
      const f = this.engine.step();
      this.renderer.renderFrame(f);
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
