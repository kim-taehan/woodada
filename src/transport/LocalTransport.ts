/**
 * Single-device transport (spec §12.5). An in-memory event bus that lets the
 * shell talk to "the room" through the same interface a WebSocketTransport will
 * later implement. v1 is always host.
 */

import type { RoomEvent, RoomTransport, Role } from './types.ts';

export function createLocalTransport(role: Role = 'host'): RoomTransport {
  const handlers = new Set<(e: RoomEvent) => void>();
  return {
    role,
    async connect() {
      /* no-op locally */
    },
    send(e) {
      for (const h of handlers) h(e);
    },
    on(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      handlers.clear();
    },
  };
}
