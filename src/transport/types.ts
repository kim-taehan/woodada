/**
 * Room state + transport abstraction (spec §12.4, §12.5). The whole room is one
 * serializable JSON. v1 ships only LocalTransport (single device) but the shell
 * talks to it through this interface so a WebSocketTransport drops in later.
 */

import type { CharacterData } from '../data/schema.ts';
import type { RaceParticipant } from '../engine/types.ts';

export type Role = 'host' | 'guest';

/** Lottery mapping (spec §6). */
export interface ResultMapping {
  /** rank (1-based) -> result text, e.g. { 1: "커피 쏘기" }. */
  byRank: Record<number, string>;
  /** team rank -> result text (team mode). */
  byTeamRank: Record<number, string>;
}

export interface RoomState {
  version: 1;
  roomId: string;
  hostId: string;
  participants: RaceParticipant[];
  /** Resolved character snapshot for replay portability. */
  characters: Record<string, CharacterData>;
  /** Reserved for v2 skins. */
  skins: Record<string, unknown>;
  modeId: string;
  scoringId: string;
  resultMapping: ResultMapping;
  seed: number;
  laps: number;
  /**
   * Selected arena (track theme) id, or 'random' to resolve from the seed at
   * render time. Purely visual — never part of the engine RaceConfig. Optional
   * for backward-compatible deserialization (absent = 'random').
   */
  arenaId?: string;
  /**
   * Individual-mode deathmatch (#dm): 'first' = 선두탈락, 'last' = 꼴찌탈락.
   * Mirrors `RaceConfig.elimination`; undefined = classic race. Part of the
   * serializable state so a replayed room reproduces the same eliminations.
   */
  elimination?: 'first' | 'last';
}

export type RoomEvent =
  | { t: 'join'; participant: RaceParticipant }
  | { t: 'leave'; id: string }
  | { t: 'update'; state: Partial<RoomState> }
  | { t: 'start'; seed: number }
  | { t: 'state'; state: RoomState };

export interface RoomTransport {
  readonly role: Role;
  connect(): Promise<void>;
  send(e: RoomEvent): void;
  /** Subscribe; returns an unsubscribe function. */
  on(handler: (e: RoomEvent) => void): () => void;
  close(): void;
}
