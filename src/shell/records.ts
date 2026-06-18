/**
 * Per-mode best-time records in localStorage (Feature B). The clock is the
 * deterministic sim time of the winner crossing the line — winner's finish frame
 * × DT_MS — so the same (config + seed) always yields the same time and a fair
 * record. Keyed by `${mode}-${laps}lap` (participant count irrelevant).
 */

import { DT_MS, type RaceConfig, type RaceResult } from '../engine/types.ts';

const STORE_KEY = 'woodada:records';

export type RaceMode = 'individual' | 'team' | 'relay';

/** Derive the mode from the race config (relay wins over plain team). */
export function modeOf(config: RaceConfig): RaceMode {
  if (config.relay) return 'relay';
  if (config.teamMode) return 'team';
  return 'individual';
}

/** Record key = `${mode}-${laps}lap`, e.g. `individual-10lap`. */
export function recordKey(config: RaceConfig): string {
  return `${modeOf(config)}-${config.laps}lap`;
}

/**
 * Winner's deterministic finish time in ms = winner finish frame × DT_MS.
 * Falls back to 0 if the order/finishFrame is somehow empty (defensive only).
 */
export function winnerTimeMs(result: RaceResult): number {
  const winnerId = result.order[0];
  const frame = winnerId !== undefined ? result.finishFrame[winnerId] : undefined;
  return (frame ?? 0) * DT_MS;
}

/** Seconds with one decimal, e.g. 23.4. */
export function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

type RecordMap = Record<string, number>;

function readAll(): RecordMap {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as RecordMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: RecordMap): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable (private mode / quota) — records are best-effort. */
  }
}

export interface RecordOutcome {
  /** This race's time (ms). */
  timeMs: number;
  /** Best time on record for this key (ms) — equals timeMs when it's a new record. */
  bestMs: number;
  /** True when this race set a new record (no prior record, or strictly faster). */
  isNew: boolean;
}

/**
 * Compare this race's time against the stored best for its key, persisting it
 * when it's a first or strictly-faster result. Returns both times + the flag so
 * the result screen can show "이번/최고" and fire the world-record celebration.
 */
export function recordOutcome(config: RaceConfig, result: RaceResult): RecordOutcome {
  const key = recordKey(config);
  const timeMs = winnerTimeMs(result);
  const all = readAll();
  const prev = all[key];
  const isNew = prev === undefined || timeMs < prev;
  if (isNew) {
    all[key] = timeMs;
    writeAll(all);
  }
  return { timeMs, bestMs: isNew ? timeMs : prev, isNew };
}
